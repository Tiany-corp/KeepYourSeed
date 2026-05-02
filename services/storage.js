import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { get, set, del } from 'idb-keyval';
import * as FileSystem from 'expo-file-system/legacy';

export const STORAGE_KEY = '@recordings_v2';

// --- UTILITIES ---
async function computeHash(uri) {
    try {
        if (Platform.OS === 'web') {
            const audioId = uri.replace('indexeddb://', '');
            const blob = await get(`audio_file_${audioId}`); 
            if (!blob) return null;
            const arrayBuffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists) return null;
            const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fileData);
        }
    } catch (e) {
        console.warn('Hash failed', e);
        return null;
    }
}

// --- ADAPTATEUR DE STOCKAGE UNIVERSEL ---
const universalStorage = {
    saveData: async (key, value) => {
        const stringValue = JSON.stringify(value);
        if (Platform.OS === 'web') {
            await set(key, stringValue);
        } else {
            await AsyncStorage.setItem(key, stringValue);
        }
    },
    getData: async (key) => {
        if (Platform.OS === 'web') {
            const data = await get(key);
            return data ? JSON.parse(data) : null;
        } else {
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }
    },
    removeData: async (key) => {
        if (Platform.OS === 'web') {
            await del(key);
        } else {
            await AsyncStorage.removeItem(key);
        }
    },
    saveAudioBlob: async (id, audioData) => {
        if (Platform.OS === 'web') {
            await set(`audio_file_${id}`, audioData);
        } else {
            await AsyncStorage.setItem(`audio_path_${id}`, audioData);
        }
    },
    getAudioBlobUrl: async (id) => {
        if (Platform.OS === 'web') {
            const blob = await get(`audio_file_${id}`);
            if (!blob) return null;
            return URL.createObjectURL(blob);
        } else {
            return await AsyncStorage.getItem(`audio_path_${id}`);
        }
    },
    removeAudioBlob: async (id) => {
        if (Platform.OS === 'web') {
            await del(`audio_file_${id}`);
        } else {
            await AsyncStorage.removeItem(`audio_path_${id}`);
        }
    },
    getAudioSize: async (uriOrId) => {
        try {
            if (Platform.OS === 'web') {
                const id = uriOrId.replace('indexeddb://', '');
                const blob = await get(`audio_file_${id}`);
                return blob ? blob.size : 0;
            } else {
                const info = await FileSystem.getInfoAsync(uriOrId);
                return info.exists ? (info.size || 0) : 0;
            }
        } catch { return 0; }
    }
};

// --- CACHE AUDIO DEPUIS SUPABASE VERS LOCAL ---
const cacheSupabaseAudioLocally = async (recordings) => {
    if (!recordings || recordings.length === 0) return;

    try {
        const { getSignedAudioUrl } = require('./cloud');
        
        // On ne traite que ceux qui ont besoin d'être téléchargés
        const toDownload = recordings
            .filter(rec => rec.remoteUrl && !rec.localUri)
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Priorité aux plus récents

        if (toDownload.length === 0) return;

        console.log(`[Cache] Lancement du téléchargement de ${toDownload.length} fichiers...`);

        // Fonction de téléchargement unitaire
        const downloadOne = async (rec) => {
            try {
                const { url: signedUrl, error } = await getSignedAudioUrl(rec.remoteUrl);
                
                if (error === 'NOT_FOUND') {
                    if (rec.localUri) {
                        await updateRecording(rec.id, { remoteUrl: null, status: 'pending' });
                    } else {
                        await updateRecording(rec.id, { remoteUrl: null });
                    }
                    return;
                }
                
                if (!signedUrl) return;

                if (Platform.OS === 'web') {
                    const response = await fetch(signedUrl);
                    if (!response.ok) return;
                    const blob = await response.blob();
                    const audioId = `audio_${rec.id}`;
                    await universalStorage.saveAudioBlob(audioId, blob);
                    await updateRecording(rec.id, { localUri: `indexeddb://${audioId}` });
                } else {
                    const fileExt = rec.remoteUrl.split('.').pop() || 'm4a';
                    const localFileName = `rec_${rec.id}.${fileExt}`;
                    const localFilePath = `${FileSystem.documentDirectory}${localFileName}`;
                    const downloadResult = await FileSystem.downloadAsync(signedUrl, localFilePath);
                    if (downloadResult.status === 200) {
                        await updateRecording(rec.id, { localUri: downloadResult.uri });
                    }
                }
            } catch (err) {
                console.warn(`[Cache] Échec pour ${rec.title}:`, err.message);
            }
        };

        // Exécution par paquets (Concurrency control)
        const CONCURRENCY = 5;
        for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
            const chunk = toDownload.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(rec => downloadOne(rec)));
        }

        console.log(`[Cache] Cycle de téléchargement terminé.`);
    } catch (e) {
        console.warn('Cache audio échoué:', e.message);
    }
};

export { cacheSupabaseAudioLocally };

/**
 * Calcule la taille totale occupée par les fichiers audio sur le téléphone.
 */
export const calculateStorageSize = async (recordings) => {
    let totalBytes = 0;
    // On fait ça en parallèle par petits lots pour ne pas bloquer
    const CONCURRENCY = 10;
    const itemsWithLocal = recordings.filter(r => r.localUri);
    
    for (let i = 0; i < itemsWithLocal.length; i += CONCURRENCY) {
        const chunk = itemsWithLocal.slice(i, i + CONCURRENCY);
        const sizes = await Promise.all(chunk.map(r => universalStorage.getAudioSize(r.localUri)));
        totalBytes += sizes.reduce((acc, s) => acc + s, 0);
    }
    
    return totalBytes;
};

/**
 * Formate une taille en octets vers une chaîne lisible (Mo, Go).
 */
export const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Mo';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} Mo`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} Go`;
};

/**
 * LOCAL FIRST : Résout la source audio UNIQUEMENT depuis le stockage local.
 * Ne contacte JAMAIS le cloud pendant la lecture.
 * Les fichiers cloud sont téléchargés en amont par cacheSupabaseAudioLocally (via le pull).
 * Si le fichier n'est pas encore en local → null (indisponible, sera dispo après le prochain sync).
 */
export const getAudioSource = async (recording) => {
    if (!recording.localUri) {
        console.log(`Audio "${recording.title}" pas encore disponible en local.`);
        return null;
    }

    if (Platform.OS === 'web' && recording.localUri.startsWith('indexeddb://')) {
        const audioId = recording.localUri.replace('indexeddb://', '');
        const blobUrl = await universalStorage.getAudioBlobUrl(audioId);
        if (blobUrl) return { uri: blobUrl };
        console.warn(`Blob introuvable pour "${recording.title}" (indexeddb key manquante)`);
        return null;
    }
    
    if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(recording.localUri);
        if (fileInfo.exists) return { uri: recording.localUri };
        console.warn(`Fichier local introuvable pour "${recording.title}" : ${recording.localUri}`);
        return null;
    }

    return { uri: recording.localUri };
};

export const saveRecording = async (newRecording) => {
    try {
        let hash = null;
        if (newRecording.localUri) {
            hash = await computeHash(newRecording.localUri);
        }
        const recordingWithHash = { ...newRecording, hash };
        const existingRecordings = await getRecordings();
        const updatedRecordings = [recordingWithHash, ...existingRecordings];
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to save recording', e);
        return [];
    }
};

export const updateRecording = async (id, updates) => {
    try {
        const recordings = await getRecordings();
        const updatedRecordings = recordings.map(rec =>
            rec.id === id ? { ...rec, ...updates } : rec
        );
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to update recording', e);
        return [];
    }
};

/**
 * Détache définitivement un enregistrement du Cloud pour le garder UNIQUEMENT sur le téléphone.
 * Il ne sera plus jamais proposé à la purge des orphelins.
 */
export const markAsKeepLocalOnly = async (id) => {
    try {
        const recordings = await getRecordings();
        const updatedRecordings = recordings.map(rec =>
            rec.id === id ? { 
                ...rec, 
                keepLocalOnly: true, 
                dbId: null, // On coupe le lien cloud
                remoteUrl: null,
                status: 'local_only' // Nouveau statut informatif
            } : rec
        );
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to mark as local only', e);
        return [];
    }
};

export const saveRawRecordings = async (recordings) => {
    try {
        await universalStorage.saveData(STORAGE_KEY, recordings);
        return true;
    } catch (e) {
        console.error('Failed to save raw recordings', e);
        return false;
    }
};

/**
 * Marque un enregistrement comme supprimé (Soft Delete) localement.
 * On garde le fichier physique pour permettre la restauration.
 */
export const deleteRecording = async (id) => {
    try {
        const recordings = await getRecordings();
        const updatedRecordings = recordings.map(rec =>
            rec.id === id ? { ...rec, deletedAt: new Date().toISOString(), status: 'pending_update' } : rec
        );
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to soft delete recording', e);
        return [];
    }
};

/**
 * Restaure un enregistrement supprimé localement.
 */
export const restoreRecording = async (id) => {
    try {
        const recordings = await getRecordings();
        const updatedRecordings = recordings.map(rec =>
            rec.id === id ? { ...rec, deletedAt: null, status: 'pending_update' } : rec
        );
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to restore recording', e);
        return [];
    }
};

/**
 * Supprime DEFINITIVEMENT un enregistrement (Fichier physique + Metadata).
 */
export const permanentlyDeleteRecording = async (id) => {
    try {
        const recordings = await getRecordings();
        const recToDelete = recordings.find(r => r.id === id);
        
        if (recToDelete && recToDelete.localUri) {
            if (Platform.OS === 'web' && recToDelete.localUri.startsWith('indexeddb://')) {
                const audioId = recToDelete.localUri.replace('indexeddb://', '');
                await universalStorage.removeAudioBlob(audioId);
            } else if (Platform.OS !== 'web') {
                try {
                    await FileSystem.deleteAsync(recToDelete.localUri, { idempotent: true });
                } catch (e) { console.warn('File delete failed', e.message); }
            }
        }
        
        const updatedRecordings = recordings.filter(rec => rec.id !== id);
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to permanently delete recording', e);
        return [];
    }
};


export const getRecordings = async () => {
    try {
        const data = await universalStorage.getData(STORAGE_KEY) ?? [];
        if (Platform.OS === 'web' && data.length === 0) {
            const demoRecordings = [{
                id: 'demo-1',
                localUri: null,
                remoteUrl: 'public/WelcomeInKYS.mp3',
                status: 'synced',
                date: new Date(Date.now() - 86400000).toISOString(),
                duration: 125,
                title: 'Présentation de KeepYourSeed',
            }];
            await universalStorage.saveData(STORAGE_KEY, demoRecordings);
            cacheSupabaseAudioLocally(demoRecordings);
            return demoRecordings;
        }

        // === SANITISATION : Corrige les dbId corrompus (objets au lieu de UUID string) ===
        let hasFixed = false;
        const sanitized = data.map(rec => {
            if (rec.dbId && typeof rec.dbId === 'object') {
                hasFixed = true;
                return { ...rec, dbId: rec.dbId.id || null };
            }
            return rec;
        });

        if (hasFixed) {
            await universalStorage.saveData(STORAGE_KEY, sanitized);
            console.log('[Storage] Données corrompues nettoyées.');
        }

        return sanitized;
    } catch (e) {
        console.error('Failed to load recordings', e);
        return [];
    }
};


/**
 * Nettoie le stockage local des doublons (ID, URL ou Hash identiques).
 * Priorise les versions avec dbId et remoteUrl.
 */
export const deduplicateLocalStore = async () => {
    try {
        const recordings = await universalStorage.getData(STORAGE_KEY) || [];
        if (recordings.length === 0) return [];

        const cleanedRecordings = [];
        const duplicatesIds = new Set();

        for (const rec of recordings) {
            // On cherche un doublon existant dans la liste nettoyée
            const existingIdx = cleanedRecordings.findIndex(existing => {
                if (rec.dbId && existing.dbId && rec.dbId === existing.dbId) return true;
                if (rec.remoteUrl && existing.remoteUrl && rec.remoteUrl === existing.remoteUrl) return true;
                // Fallback extrême pour les très vieux enregistrements sans ID: même titre et même durée
                if (!rec.dbId && !existing.dbId && rec.title && existing.title && rec.title === existing.title && rec.duration === existing.duration) return true;
                return false;
            });

            if (existingIdx !== -1) {
                const existing = cleanedRecordings[existingIdx];
                // Fusion: on conserve la version qui a le plus d'identifiants cloud (le dbId prime)
                if (!existing.dbId && rec.dbId) {
                    cleanedRecordings[existingIdx] = rec;
                    duplicatesIds.add(existing.id);
                } else {
                    duplicatesIds.add(rec.id);
                }
            } else {
                cleanedRecordings.push(rec);
            }
        }

        if (duplicatesIds.size > 0) {
            await universalStorage.saveData(STORAGE_KEY, cleanedRecordings);
            console.log(`[Storage] ${duplicatesIds.size} doublons supprimés localement par fusion croisée.`);
            return cleanedRecordings;
        }
        return recordings;
    } catch (e) {
        console.error('Deduplication failed', e);
        return [];
    }
};

export const clearRecordings = async () => {
    try { await universalStorage.removeData(STORAGE_KEY); } catch (e) { console.error('Failed to clear recordings', e); }
};

export const saveAudioBlobWeb = universalStorage.saveAudioBlob;
export const getAudioBlobUrlWeb = universalStorage.getAudioBlobUrl;
export const removeAudioBlobWeb = universalStorage.removeAudioBlob;

const PINNED_THOUGHT_KEY = '@pinned_thought_v1';
export const getPinnedThought = async () => { try { return await universalStorage.getData(PINNED_THOUGHT_KEY); } catch { return null; } };
export const setPinnedThought = async (recording) => { try { await universalStorage.saveData(PINNED_THOUGHT_KEY, recording); } catch (e) { console.warn('Failed to pin thought', e); } };
export const clearPinnedThought = async () => { try { await universalStorage.removeData(PINNED_THOUGHT_KEY); } catch (e) { console.warn('Failed to clear pinned thought', e); } };

export const getWifiOnlyPreference = async () => {
  try {
    const value = await universalStorage.getData('@wifi_only_sync');
    return value === true;
  } catch (e) { return false; }
};
export const setWifiOnlyPreference = async (enabled) => {
  try { await universalStorage.saveData('@wifi_only_sync', enabled); } catch (e) { console.warn('Failed to set wifi preference', e); }
};

export const getChildRecordings = async (parentId) => {
    try {
        const all = await getRecordings();
        return all.filter(r => r.parentId === parentId);
    } catch { return []; }
};

const DAILY_MEMORY_PREFIX = '@daily_memory_';
const SEEN_DAILY_MEMORY_PREFIX = '@seen_daily_memory_';
const getTodayKey = () => `${DAILY_MEMORY_PREFIX}${new Date().toISOString().split('T')[0]}`;
const getSeenDailyMemoryKey = (userId) => `${SEEN_DAILY_MEMORY_PREFIX}${userId || 'guest'}`;

export const clearDailyMemoriesCache = async () => {
    try {
        const todayKey = getTodayKey();
        await universalStorage.removeData(todayKey);
    } catch (e) {
        console.log('[DailyMemories] Erreur suppression cache');
    }
};

export const updateDailyMemoryInCache = async (id, updates) => {
    try {
        const todayKey = getTodayKey();
        const cached = await universalStorage.getData(todayKey);
        if (cached && Array.isArray(cached)) {
            const updatedCache = cached.map(memory => 
                memory.id === id ? { ...memory, ...updates } : memory
            );
            await universalStorage.saveData(todayKey, updatedCache);
        }
    } catch (e) {
        console.log('[DailyMemories] Erreur mise à jour cache', e);
    }
};

export const getDailyMemories = async (userId = null, forceRefresh = false) => {
    try {
        const todayKey = getTodayKey();
        
        // Si on force le rafraîchissement, on ignore le cache
        let cached = forceRefresh ? null : await universalStorage.getData(todayKey);
        
        // Si on a déjà le cache (tableau d'objets), on le renvoie
        if (cached && Array.isArray(cached)) {
            // Vérification : on s'assure que le cache ne contient que des messages d'aujourd'hui
            const todayStr = new Date().toISOString().split('T')[0];
            const isCacheValid = cached.every(item => {
                if (item.type !== 'message') return true; 
                return item.deliverDate && item.deliverDate.split('T')[0] === todayStr;
            });

            if (isCacheValid) {
                const allLocal = await getRecordings();
                return cached.map(memory => {
                    const localMatch = allLocal.find(r => 
                        (memory.remoteUrl && r.remoteUrl === memory.remoteUrl) || 
                        (r.dbId && memory.id === `cloud_${r.dbId}`)
                    );
                    return localMatch && localMatch.localUri ? { ...memory, localUri: localMatch.localUri } : memory;
                });
            }
        }

        const allLocal = await getRecordings();
        const now = new Date();
        const results = [];

        // 1. Chercher la pensée souvenir locale (le rituel)
        const notes = allLocal.filter(r => 
            !r.deletedAt && r.type === 'note' && (!r.deliverDate || new Date(r.deliverDate) <= now)
        );
        if (notes.length > 0) {
            const start = new Date(now.getFullYear(), 0, 0);
            const diff = now - start;
            const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
            const userHash = (userId || 'guest').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const index = (dayOfYear + userHash) % notes.length;
            results.push({ ...notes[index] });
        }

        // 2. Chercher les messages "reçus" (via le cloud si connecté, ou localement)
        if (userId) {
            try {
                const { fetchPendingMessages, markMessageAsOpened } = require('./cloud');
                // 1. Récupérer les messages du futur arrivés à échéance depuis le cloud
                const pendingMessages = await fetchPendingMessages(userId);
                
                // 2. Les messages renvoyés par Supabase sont déjà filtrés pour la journée d'aujourd'hui
                const todaysMessages = pendingMessages;

                // 3. Récupérer la pensée souvenir du jour (déjà calculée plus haut dans 'results')
                const dailyNote = results.find(r => r.type === 'note');

                // 4. Fusionner (Messages d'abord, puis Note du jour)
                const memories = [...todaysMessages];
                if (dailyNote && !todaysMessages.some(m => m.id === dailyNote.id)) {
                    memories.push(dailyNote);
                }

                // 5. Mettre en cache pour la journée
                await universalStorage.saveData(todayKey, memories);
                return memories;
            } catch (e) {
                console.log('[DailyMemories] Erreur cloud, fallback local.');
            }
        }

        // Compléter avec les messages locaux non ouverts (filtrés sur AUJOURD'HUI)
        const todayStr = new Date().toISOString().split('T')[0];
        const localMessages = allLocal.filter(r => 
            r.type === 'message' && 
            !r.deletedAt && 
            r.deliverDate && 
            r.deliverDate.split('T')[0] === todayStr
        );
        for (const msg of localMessages) {
            if (!results.some(r => r.id === msg.id || (r.dbId && r.dbId === msg.dbId))) {
                results.push(msg);
            }
        }

        // Rattacher les localUri
        const finalResults = results.map(memory => {
            const localMatch = allLocal.find(r => 
                (memory.remoteUrl && r.remoteUrl === memory.remoteUrl) || 
                (r.dbId && memory.id === `cloud_${r.dbId}`)
            );
            return localMatch && localMatch.localUri ? { ...memory, localUri: localMatch.localUri } : memory;
        });

        // Mettre en cache pour la journée
        if (finalResults.length > 0) {
            await universalStorage.saveData(todayKey, finalResults);
        }

        return finalResults;
    } catch (e) {
        console.error('Erreur getDailyMemories:', e);
        return [];
    }
};

export const getDailyMemory = async (userId = null) => {
    const memories = await getDailyMemories(userId);
    return memories.length > 0 ? memories[0] : null;
};

export const getSeenDailyMemoryId = async (userId) => { try { return await universalStorage.getData(getSeenDailyMemoryKey(userId)); } catch (e) { return null; } };
export const setSeenDailyMemoryId = async (userId, memoryId) => { try { await universalStorage.saveData(getSeenDailyMemoryKey(userId), memoryId || null); } catch (e) { } };

export const getCurrentStreak = async () => {
    try {
        const recordings = await getRecordings();
        if (!recordings || recordings.length === 0) return 0;
        const toLocalDateString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const uniqueDates = new Set();
        recordings.forEach(rec => { if (rec.date) { const dateObj = new Date(rec.date); if (!isNaN(dateObj)) uniqueDates.add(toLocalDateString(dateObj)); } });
        if (uniqueDates.size === 0) return 0;
        let streak = 0;
        const today = new Date();
        const todayStr = toLocalDateString(today);
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDateString(yesterday);
        let currentDate = new Date(today);
        let dateToCheck = todayStr;
        if (!uniqueDates.has(todayStr)) { if (!uniqueDates.has(yesterdayStr)) return 0; currentDate = yesterday; dateToCheck = yesterdayStr; }
        while (uniqueDates.has(dateToCheck)) { streak++; currentDate.setDate(currentDate.getDate() - 1); dateToCheck = toLocalDateString(currentDate); }
        return streak;
    } catch (e) { return 0; }
};
