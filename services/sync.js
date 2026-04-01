import { getRecordings, updateRecording, cacheSupabaseAudioLocally } from './storage';
import { uploadRecordingToCloud, saveRecordingToDatabase, fetchCloudRecordings } from './cloud';
import { supabase } from './supabase';

/**
 * Synchronisation complète : Push (Local -> Cloud) + Pull (Cloud -> Local)
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<{success: boolean, pushed: number, pulled: number}>}
 */
/**
 * Synchronisation complète : Push (Local -> Cloud) + Pull (Cloud -> Local)
 * @param {string} userId - UUID de l'utilisateur
 * @param {boolean} isManual - Si true, bypass certaines restrictions
 * @returns {Promise<{success: boolean, pushed: number, pulled: number, status: string}>}
 */
export const syncAll = async (userId, isManual = false) => {
    try {
        if (!userId) return { success: false, pushed: 0, pulled: 0 };

        const NetInfo = require('@react-native-community/netinfo');
        const { getWifiOnlyPreference } = require('./storage');
        
        const netState = await NetInfo.fetch();
        const isWifi = netState.type === 'wifi' || netState.type === 'ethernet';
        const isConnected = netState.isConnected;
        const wifiOnly = await getWifiOnlyPreference();

        if (!isConnected) return { success: false, pushed: 0, pulled: 0, status: 'no-connection' };

        console.log(`--- DÉBUT SYNCHRONISATION (Wifi: ${isWifi}, WifiOnly: ${wifiOnly}, Manual: ${isManual}) ---`);

        let pushedCount = 0;
        let pulledCount = 0;

        // 1. PUSH : Autorisé si (Wifi) OR (4G ET !wifiOnly) OR (Manual)
        const canPush = isManual || isWifi || !wifiOnly;
        if (canPush) {
            pushedCount = await pushLocalRecordings(userId);
        } else {
            console.log('Push sauté (Wi-Fi requis)');
        }

        // 2. PULL : Autorisé si (Wifi) OR (Manual)
        // Note: Le pull télécharge des fichiers audio, donc on le restreint plus strictement
        const canPull = isManual || isWifi;
        if (canPull) {
            pulledCount = await pullCloudRecordings(userId);
        } else {
            console.log('Pull sauté (Wi-Fi requis pour téléchargement)');
        }

        return { 
            success: true, 
            pushed: pushedCount, 
            pulled: pulledCount,
            status: (!isWifi && wifiOnly && !isManual) ? 'wifi-required' : 'done'
        };
    } catch (error) {
        console.error('Erreur syncAll:', error);
        return { success: false, pushed: 0, pulled: 0, error: error.message };
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
