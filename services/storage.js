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
};

// --- CACHE AUDIO DEPUIS SUPABASE VERS LOCAL ---
const cacheSupabaseAudioLocally = async (recordings) => {
    try {
        const { getSignedAudioUrl } = require('./cloud');
        for (const rec of recordings) {
            if (!rec.remoteUrl || rec.localUri) continue;
            
            const { url: signedUrl, error } = await getSignedAudioUrl(rec.remoteUrl);
            
            if (error === 'NOT_FOUND') {
                console.warn(`Fichier cloud manquant pour "${rec.title}" – Tentative de réparation.`);
                // Si on a quand même un localUri (qui aurait pu être râté par la condition au dessus), on garde,
                // sinon on nettoie le remoteUrl car il est mort.
                if (rec.localUri) {
                    await updateRecording(rec.id, { remoteUrl: null, status: 'pending' });
                } else {
                    await updateRecording(rec.id, { remoteUrl: null });
                }
                continue;
            }
            
            if (!signedUrl) continue;

            if (Platform.OS === 'web') {
                const response = await fetch(signedUrl);
                if (!response.ok) continue;
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
        }
    } catch (e) {
        console.warn('Cache audio échoué:', e.message);
    }
};

export { cacheSupabaseAudioLocally };

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
        return data;
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

export const getDailyMemory = async (userId) => {
    try {
        const todayKey = getTodayKey();
        const cached = await universalStorage.getData(todayKey);
        if (cached) return cached;

        const { fetchPendingMessage, markMessageAsOpened, fetchRandomRecording } = require('./cloud');
        const pendingMessage = await fetchPendingMessage(userId);
        if (pendingMessage) {
            if (pendingMessage.dbId) await markMessageAsOpened(pendingMessage.dbId);
            await universalStorage.saveData(todayKey, pendingMessage);
            return pendingMessage;
        }
        const randomRecording = await fetchRandomRecording(userId);
        if (randomRecording) {
            randomRecording.type = randomRecording.type || 'note';
            await universalStorage.saveData(todayKey, randomRecording);
        }
        return randomRecording;
    } catch (e) { return null; }
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
