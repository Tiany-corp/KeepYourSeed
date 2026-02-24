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
            await set(key, stringValue); // IndexedDB
        } else {
            await AsyncStorage.setItem(key, stringValue); // SQLite/Fichier natif
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

    // 2. Fallback : générer une URL signée temporaire depuis Supabase
    if (recording.remoteUrl) {
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
        const data = await universalStorage.getData(STORAGE_KEY) ?? [];

        // WEB DEMO: Injecte des données de démo si l'historique est vide sur le web
        if (Platform.OS === 'web' && data.length === 0) {
            console.log('Web Demo: Injecting Fake Data');
            return [
                {
                    id: 'demo-1',
                    localUri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                    remoteUrl: null,
                    status: 'pending',
                    date: new Date(Date.now() - 86400000).toISOString(),
                    duration: 125,
                    title: 'Idée de projet (Demo)',
                },
                {
                    id: 'demo-2',
                    localUri: 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
                    remoteUrl: null,
                    status: 'pending',
                    date: new Date().toISOString(),
                    duration: 60,
                    title: 'Note rapide du matin',
                }
            ];
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
