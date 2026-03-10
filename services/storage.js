import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { get, set, del } from 'idb-keyval'; // Wrapper léger et propre pour IndexedDB sur le Web

const STORAGE_KEY = '@recordings_v2'; // V2 : nouvelle structure localUri/remoteUrl/status

// --- ADAPTATEUR DE STOCKAGE UNIVERSEL ---
// Cette interface unique fonctionne sur Web (IndexedDB via idb-keyval) et Mobile (AsyncStorage).
const universalStorage = {
    saveData: async (key, value) => {
        const stringValue = JSON.stringify(value);
        if (Platform.OS === 'web') {
            await set(key, stringValue); // IndexedDB => fonction prédéfinie qui stocke une valeur dans le cache 
        } else {
            await AsyncStorage.setItem(key, stringValue); // SQLite/Fichier natif
        }
    },

    getData: async (key) => { // D'ou viens la clé qu'on lui donne ? c'est l'id du user ? ou son cookie
        if (Platform.OS === 'web') {
            const data = await get(key); // Fonction prédéfinie qui prend toutes les valeurs correspondant à une clé donnée en entrée 
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

    // Stocke un fichier AUDIO (Blob sur Web, Chemin sous forme de string sur Mobile)
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
            return URL.createObjectURL(blob); // Crée une URL blob:// temporaire jouable
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
// Télécharge les fichiers audio Supabase en arrière-plan et les stocke en local (IndexedDB web)
// pour une lecture instantanée sans réseau aux prochains accès.
const cacheSupabaseAudioLocally = async (recordings) => {
    try {
        const { getSignedAudioUrl } = require('./cloud');

        for (const rec of recordings) {
            // Seulement si c'est un fichier Supabase sans copie locale
            if (!rec.remoteUrl || rec.localUri) continue;

            console.log('Cache audio en arrière-plan:', rec.remoteUrl);
            const signedUrl = await getSignedAudioUrl(rec.remoteUrl);
            if (!signedUrl) continue;

            const response = await fetch(signedUrl);
            if (!response.ok) continue;

            const blob = await response.blob();
            const audioId = `demo_${rec.id}`;

            // Stocker le blob dans IndexedDB
            await universalStorage.saveAudioBlob(audioId, blob);

            // Mettre à jour l'enregistrement avec le chemin local
            await updateRecording(rec.id, { localUri: `indexeddb://${audioId}` });
            console.log('Audio mis en cache local:', audioId, `(${blob.size} octets)`);
        }
    } catch (e) {
        // Erreur non-critique : la lecture cloud continue de fonctionner
        console.warn('Cache audio en arrière-plan échoué (non-bloquant):', e.message);
    }
};

// --- SÉLECTEUR INTELLIGENT D'URL AUDIO ---
// Choisit automatiquement la meilleure source audio pour la lecture :
//   1. Local d'abord (zéro latence)
//   2. Cloud ensuite (si le local n'est plus dispo)
export const getAudioSource = async (recording) => {
    // 1. Essayer le fichier local
    if (recording.localUri) {
        // Sur Web, les indexeddb:// doivent être résolues en blob:// temporaire jouable
        if (Platform.OS === 'web' && recording.localUri.startsWith('indexeddb://')) {
            const audioId = recording.localUri.replace('indexeddb://', '');
            const blobUrl = await universalStorage.getAudioBlobUrl(audioId);
            if (blobUrl) return { uri: blobUrl };
            // Si le blob local a disparu, on tombe sur le cloud ci-dessous
        } else {
            return { uri: recording.localUri }; // Mobile file:// ou autre URL directe
        }
    }

    // 2. Fallback : cloud URL
    if (recording.remoteUrl) {
        // CORRECTION DEMO : Si c'est déjà une URL web absolue (http://...), on la retourne directement
        if (recording.remoteUrl.startsWith('http')) {
            return { uri: recording.remoteUrl };
        }

        // Sinon, c'est un fichier dans notre bucket Supabase, il faut générer l'URL signée temporaire
        // Import dynamique pour éviter les imports circulaires (cloud.js importe storage.js)
        const { getSignedAudioUrl } = require('./cloud');
        const signedUrl = await getSignedAudioUrl(recording.remoteUrl);
        if (signedUrl) return { uri: signedUrl };
    }

    // 3. Rien trouvé
    return null;
};

// --- EXPORTS PUBLICS ---

export const saveRecording = async (newRecording) => {
    try {
        const existingRecordings = await getRecordings();
        const updatedRecordings = [newRecording, ...existingRecordings];
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to save recording', e);
        return [];
    }
};

// Met à jour un enregistrement existant par son ID (ex: après upload cloud)
export const updateRecording = async (id, updates) => {
    try {
        const recordings = await getRecordings();
        const updatedRecordings = recordings.map(rec =>
            rec.id === id ? { ...rec, ...updates } : rec // Des que c'est le bon enregistrement fusionne les données avec ce qui se trouve dans update
        );
        await universalStorage.saveData(STORAGE_KEY, updatedRecordings);
        return updatedRecordings;
    } catch (e) {
        console.error('Failed to update recording', e);
        return [];
    }
};

export const getRecordings = async () => {
    try {
        const data = await universalStorage.getData(STORAGE_KEY) ?? []; // Je charge mes audios locaux + remote qui sont renvoyé sous forme de json

        // WEB DEMO: Injecte des données de démo si l'historique est vide sur le web
        if (Platform.OS === 'web' && data.length === 0) {
            console.log('Web Demo: Injecting demo data from Supabase');
            const demoRecordings = [ // Je stocke un record de la base de donnée supabase
                {
                    id: 'demo-1',
                    localUri: null,
                    remoteUrl: 'public/WelcomeInKYS.mp3', // Chemin dans le bucket Supabase "audios"
                    status: 'synced',
                    date: new Date(Date.now() - 86400000).toISOString(),
                    duration: 125,
                    title: 'Présentation de KeepYourSeed',
                },
            ];

            // Sauvegarder les démo en local, puis télécharger l'audio en arrière-plan
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

export const clearRecordings = async () => {
    try {
        await universalStorage.removeData(STORAGE_KEY);
    } catch (e) {
        console.error('Failed to clear recordings', e);
    }
};

// Pour stocker / relire les vrais fichiers audio binaires (utilisé par useAudioRecorder)
export const saveAudioBlobWeb = universalStorage.saveAudioBlob;
export const getAudioBlobUrlWeb = universalStorage.getAudioBlobUrl;
export const removeAudioBlobWeb = universalStorage.removeAudioBlob;

// --- PENSÉE ÉPINGLÉE ---
const PINNED_THOUGHT_KEY = '@pinned_thought_v1';

export const getPinnedThought = async () => {
    try {
        return await universalStorage.getData(PINNED_THOUGHT_KEY);
    } catch { return null; }
};

export const setPinnedThought = async (recording) => {
    try {
        await universalStorage.saveData(PINNED_THOUGHT_KEY, recording);
    } catch (e) { console.warn('Failed to pin thought', e); }
};

export const clearPinnedThought = async () => {
    try {
        await universalStorage.removeData(PINNED_THOUGHT_KEY);
    } catch (e) { console.warn('Failed to clear pinned thought', e); }
};

// --- ENFANTS D'UNE PENSÉE ---
export const getChildRecordings = async (parentId) => {
    try {
        const all = await getRecordings();
        return all.filter(r => r.parentId === parentId);
    } catch { return []; }
};

// --- SOUVENIR DU JOUR ---
// Cache un enregistrement aléatoire pour la journée entière.
// Clé de stockage : @daily_memory_YYYY-MM-DD
const DAILY_MEMORY_PREFIX = '@daily_memory_';

const getTodayKey = () => {
    const today = new Date().toISOString().split('T')[0]; // "2026-02-27"
    return `${DAILY_MEMORY_PREFIX}${today}`;
};

/**
 * Récupère le contenu du jour : un message reçu en priorité, sinon un souvenir aléatoire.
 * @param {string} userId - UUID de l'utilisateur connecté
 * @returns {Promise<Object|null>} - Un recording au format app, ou null
 */
export const getDailyMemory = async (userId) => {
    try {
        const todayKey = getTodayKey();

        // 1. Vérifier le cache local
        const cached = await universalStorage.getData(todayKey);
        if (cached) {
            console.log('Souvenir du jour trouvé en cache');
            return cached;
        }

        // 2. Vérifier s'il y a un message en attente (prioritaire)
        const { fetchPendingMessage, markMessageAsOpened, fetchRandomRecording } = require('./cloud');
        const pendingMessage = await fetchPendingMessage(userId);

        if (pendingMessage) {
            if (pendingMessage.dbId) await markMessageAsOpened(pendingMessage.dbId);
            await universalStorage.saveData(todayKey, pendingMessage);
            console.log('Message du passé reçu:', pendingMessage.title);
            return pendingMessage;
        }

        // 3. Sinon → souvenir aléatoire
        const randomRecording = await fetchRandomRecording(userId);

        if (randomRecording) {
            randomRecording.type = randomRecording.type || 'note';
            await universalStorage.saveData(todayKey, randomRecording);
            console.log('Souvenir du jour mis en cache:', randomRecording.title);
        }

        return randomRecording;

    } catch (e) {
        console.error('Erreur getDailyMemory:', e);
        return null;
    }
};

// --- STREAK DU JOUEUR (FRONT-END ALGO) ---
// Calcule la série de jours consécutifs où l'utilisateur a enregistré une pensée
export const getCurrentStreak = async () => {
    try {
        const recordings = await getRecordings();
        if (!recordings || recordings.length === 0) return 0;

        // Fonction utilitaire pour extraire la date locale au format YYYY-MM-DD
        // (Évite les bugs de décalage horaire liés à toISOString/UTC)
        const toLocalDateString = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const uniqueDates = new Set();
        recordings.forEach(rec => {
            if (rec.date) {
                const dateObj = new Date(rec.date);
                if (!isNaN(dateObj)) {
                    uniqueDates.add(toLocalDateString(dateObj));
                }
            }
        });

        if (uniqueDates.size === 0) return 0;

        let streak = 0;
        const today = new Date();
        const todayStr = toLocalDateString(today);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDateString(yesterday);

        let currentDate = new Date(today);
        let dateToCheck = todayStr;

        // Si pas d'enregistrement aujourd'hui, on vérifie hier.
        // (La streak n'est pas brisée si l'utilisateur n'a pas *encore* enregistré aujourd'hui)
        if (!uniqueDates.has(todayStr)) {
            if (!uniqueDates.has(yesterdayStr)) {
                return 0; // Streak brisée
            }
            // La streak est toujours en vie depuis hier
            currentDate = yesterday;
            dateToCheck = yesterdayStr;
        }

        // Remonter les jours un par un pour compter
        while (uniqueDates.has(dateToCheck)) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
            dateToCheck = toLocalDateString(currentDate);
        }

        return streak;
    } catch (e) {
        console.error('Erreur getCurrentStreak:', e);
        return 0;
    }
};
