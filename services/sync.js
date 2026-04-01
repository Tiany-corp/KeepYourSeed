import { getRecordings, updateRecording, cacheSupabaseAudioLocally } from './storage';
import { uploadRecordingToCloud, saveRecordingToDatabase, fetchCloudRecordings } from './cloud';
import { supabase } from './supabase';

/**
 * Synchronisation complète : Push (Local -> Cloud) + Pull (Cloud -> Local)
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<{success: boolean, pushed: number, pulled: number}>}
 */
export const syncAll = async (userId) => {
    try {
        if (!userId) return { success: false, pushed: 0, pulled: 0 };

        console.log('--- DÉBUT SYNCHRONISATION GLOBALE ---');

        // 1. PUSH : Envoyer ce qui est nouveau en local
        const pushedCount = await pushLocalRecordings(userId);

        // 2. PULL : Récupérer ce qui est nouveau sur le cloud
        const pulledCount = await pullCloudRecordings(userId);

        console.log(`--- FIN SYNCHRONISATION : Envois: ${pushedCount}, Récupérations: ${pulledCount} ---`);
        
        return { success: true, pushed: pushedCount, pulled: pulledCount };
    } catch (error) {
        console.error('Erreur syncAll:', error);
        return { success: false, pushed: 0, pulled: 0 };
    }
};

/**
 * Envoie les enregistrements marqués 'pending' vers Supabase.
 */
const pushLocalRecordings = async (userId) => {
    const localRecordings = await getRecordings();
    const toSync = localRecordings.filter(r => r.status !== 'synced');
    let count = 0;

    for (const rec of toSync) {
        try {
            const remoteUrl = await uploadRecordingToCloud(rec.id, rec.localUri, userId);
            if (remoteUrl) {
                await saveRecordingToDatabase(
                    userId, rec.title, remoteUrl, rec.duration, 
                    rec.type || 'note', rec.deliverDate, rec.tags || [], rec.parentId
                );
                await updateRecording(rec.id, { status: 'synced' });
                count++;
            }
        } catch (err) {
            console.error(`Erreur push "${rec.title}":`, err);
            await updateRecording(rec.id, { status: 'error' });
        }
    }
    return count;
};

/**
 * Récupère les métadonnées depuis le cloud et les fusionne en local.
 * Déclenche ensuite le téléchargement des fichiers audio manquants.
 */
const pullCloudRecordings = async (userId) => {
    try {
        const cloudRecordings = await fetchCloudRecordings(userId);
        const localRecordings = await getRecordings();
        
        // Maps for quick lookup
        const localByRemote = new Map(
            localRecordings.filter(r => r.remoteUrl).map(r => [r.remoteUrl, r])
        );
        const localByHash = new Map(
            // Assume recordings may have a `hash` field (e.g., SHA256 of audio)
            localRecordings.filter(r => r.hash).map(r => [r.hash, r])
        );
        
        let newItems = [];
        for (const cloudRec of cloudRecordings) {
            const alreadyByUrl = cloudRec.remoteUrl && localByRemote.has(cloudRec.remoteUrl);
            const alreadyByHash = cloudRec.hash && localByHash.has(cloudRec.hash);
            if (alreadyByUrl || alreadyByHash) {
                // Duplicate – skip
                continue;
            }
            // New recording from cloud
            newItems.push({
                ...cloudRec,
                id: `cloud_${cloudRec.dbId || Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                status: 'synced',
                localUri: null
            });
        }

        if (newItems.length > 0) {
            const { STORAGE_KEY } = require('./storage');
            const { set } = require('idb-keyval');
            const { Platform } = require('react-native');
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            
            const merged = [...newItems, ...localRecordings];
            // Tri par date décroissante
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Sauvegarde directe pour éviter les boucles d'updateRecording
            const stringValue = JSON.stringify(merged);
            if (Platform.OS === 'web') {
                await set(STORAGE_KEY, stringValue);
            } else {
                await AsyncStorage.setItem(STORAGE_KEY, stringValue);
            }
            
            // Lancer le téléchargement des audios manquants en arrière-plan
            cacheSupabaseAudioLocally(merged);
            return newItems.length;
        }
        
        // Même si pas de nouveaux items, on vérifie si certains audios distants ne sont pas encore cachés
        cacheSupabaseAudioLocally(localRecordings);
        return 0;
    } catch (e) {
        console.error('Erreur pullCloudRecordings:', e);
        return 0;
    }
};
