import { getRecordings, updateRecording, cacheSupabaseAudioLocally } from './storage';
import { uploadRecordingToCloud, saveRecordingToDatabase, fetchCloudRecordings } from './cloud';
import { supabase } from './supabase';

/**
 * Verrou pour empêcher les exécutions concurrentes de syncAll.
 * Sans ce verrou, deux appels simultanés peuvent uploader le même
 * enregistrement deux fois avec des timestamps différents → doublons.
 */
let _isSyncing = false;

/**
 * Synchronisation complète : Push (Local -> Cloud) + Pull (Cloud -> Local)
 * @param {string} userId - UUID de l'utilisateur
 * @param {boolean} isManual - Si true, bypass certaines restrictions
 * @returns {Promise<{success: boolean, pushed: number, pulled: number, status: string}>}
 */
export const syncAll = async (userId, isManual = false) => {
    try {
        if (!userId) return { success: false, pushed: 0, pulled: 0 };

        // Verrou anti-doublons : si un sync est déjà en cours, on skip
        if (_isSyncing) {
            console.log('syncAll ignoré : synchronisation déjà en cours');
            return { success: false, pushed: 0, pulled: 0, status: 'already-syncing' };
        }
        _isSyncing = true;

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
            const pushedCreations = await pushLocalRecordings(userId);
            const pushedUpdates = await pushLocalUpdates(userId);
            pushedCount = pushedCreations + pushedUpdates;
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

        _isSyncing = false;
        return { 
            success: true, 
            pushed: pushedCount, 
            pulled: pulledCount,
            status: (!isWifi && wifiOnly && !isManual) ? 'wifi-required' : 'done'
        };
    } catch (error) {
        console.error('Erreur syncAll:', error);
        return { success: false, pushed: 0, pulled: 0, error: error.message };
    } finally {
        _isSyncing = false;
    }
};

/**
 * Envoie les nouveaux enregistrements ('pending') vers Supabase.
 */
const pushLocalRecordings = async (userId) => {
    const localRecordings = await getRecordings();
    const toSync = localRecordings.filter(r => r.status === 'pending');
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
            console.error(`Erreur push creation "${rec.title}":`, err);
            await updateRecording(rec.id, { status: 'error' });
        }
    }
    return count;
};

/**
 * Envoie les mises à jour locales ('pending_update') vers Supabase.
 */
const pushLocalUpdates = async (userId) => {
    const localRecordings = await getRecordings();
    const toUpdate = localRecordings.filter(r => r.status === 'pending_update');
    let count = 0;
    
    // On importe updateRecordingMetadataInDatabase dynamiquement pour éviter les dépendances circulaires
    const { updateRecordingMetadataInDatabase } = require('./cloud');

    for (const rec of toUpdate) {
        try {
            const ok = await updateRecordingMetadataInDatabase({
                userId,
                recording: rec,
                title: rec.title,
                type: rec.type,
                deliverDate: rec.deliverDate,
                tags: rec.tags,
            });
            if (ok) {
                await updateRecording(rec.id, { status: 'synced' });
                count++;
            }
        } catch (err) {
            console.error(`Erreur push update "${rec.title}":`, err);
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
        let updatedItems = [];
        for (const cloudRec of cloudRecordings) {
            const alreadyByUrl = cloudRec.remoteUrl && localByRemote.has(cloudRec.remoteUrl);
            const alreadyByHash = cloudRec.hash && localByHash.has(cloudRec.hash);
            
            if (alreadyByUrl || alreadyByHash) {
                // LWW (Last-Write-Wins) en cas de doublon
                const localRec = alreadyByUrl ? localByRemote.get(cloudRec.remoteUrl) : localByHash.get(cloudRec.hash);
                
                const localTime = new Date(localRec.updatedAt || localRec.date || 0).getTime();
                const cloudTime = new Date(cloudRec.updatedAt || cloudRec.date || 0).getTime();
                
                if (cloudTime > localTime && localRec.status !== 'pending_update') {
                    // Serveur plus récent et pas de modification locale en attente => Mise à jour du local
                    updatedItems.push({
                        ...localRec,
                        title: cloudRec.title,
                        type: cloudRec.type,
                        deliverDate: cloudRec.deliverDate,
                        tags: cloudRec.tags,
                        updatedAt: cloudRec.updatedAt
                    });
                }
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

        if (newItems.length > 0 || updatedItems.length > 0) {
            const { STORAGE_KEY } = require('./storage');
            const { set } = require('idb-keyval');
            const { Platform } = require('react-native');
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            
            // Mise à jour des éléments existants
            let merged = localRecordings.map(local => {
                const update = updatedItems.find(u => u.id === local.id);
                return update ? update : local;
            });
            
            // Ajout des nouveaux
            merged = [...newItems, ...merged];
            
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
            if (newItems.length > 0) {
                cacheSupabaseAudioLocally(merged);
            }
            return newItems.length + updatedItems.length;
        }
        
        // Même si pas de nouveaux items, on vérifie si certains audios distants ne sont pas encore cachés
        cacheSupabaseAudioLocally(localRecordings);
        return 0;
    } catch (e) {
        console.error('Erreur pullCloudRecordings:', e);
        return 0;
    }
};
