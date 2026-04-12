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
 * Cooldown : timestamp du dernier sync réussi.
 * Empêche les syncs automatiques trop rapprochés (< 5 min).
 */
let _lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Synchronisation complète : Push (Local -> Cloud) + Pull (Cloud -> Local)
 * @param {string} userId - UUID de l'utilisateur
 * @param {boolean} isManual - Si true, bypass le cooldown et certaines restrictions réseau
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

        // Cooldown : si le dernier sync date de moins de 5 min, on skip (sauf manual)
        const now = Date.now();
        if (!isManual && (now - _lastSyncTime) < SYNC_COOLDOWN_MS) {
            console.log(`syncAll ignoré : cooldown actif (${Math.round((SYNC_COOLDOWN_MS - (now - _lastSyncTime)) / 1000)}s restantes)`);
            return { success: false, pushed: 0, pulled: 0, status: 'cooldown' };
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
        _lastSyncTime = Date.now();
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
 * Push-only : envoie les enregistrements en attente sans faire de Pull.
 * Utilisé après un nouvel enregistrement pour ne pas alourdir l'UX.
 * Ignore le cooldown car c'est une action déclenchée par l'utilisateur.
 * @param {string} userId
 */
export const pushOnly = async (userId) => {
    try {
        if (!userId || _isSyncing) return { success: false, pushed: 0 };
        _isSyncing = true;

        const NetInfo = require('@react-native-community/netinfo');
        const { getWifiOnlyPreference } = require('./storage');
        const netState = await NetInfo.fetch();
        const isConnected = netState.isConnected;
        const isWifi = netState.type === 'wifi' || netState.type === 'ethernet';
        const wifiOnly = await getWifiOnlyPreference();

        if (!isConnected || (wifiOnly && !isWifi)) {
            return { success: false, pushed: 0, status: 'skipped' };
        }

        const pushed = await pushLocalRecordings(userId);
        return { success: true, pushed };
    } catch (error) {
        console.error('Erreur pushOnly:', error);
        return { success: false, pushed: 0 };
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

        // Maps pour recherche rapide
        const localByDbId = new Map(
            localRecordings.filter(r => r.dbId).map(r => [r.dbId, r])
        );
        const localByRemote = new Map(
            localRecordings.filter(r => r.remoteUrl).map(r => [r.remoteUrl, r])
        );
        const localByHash = new Map(
            localRecordings.filter(r => r.hash).map(r => [r.hash, r])
        );
        
        let newItems = [];
        let updatedItems = [];

        for (const cloudRec of cloudRecordings) {
            // MATCHING STABLE : On cherche d'abord par ID de base de données (le plus fiable)
            let localRec = localByDbId.get(cloudRec.dbId);
            
            // Fallback sur l'URL de stockage ou le Hash (pour les vieux records ou le 1er sync)
            if (!localRec) {
                if (cloudRec.remoteUrl && localByRemote.has(cloudRec.remoteUrl)) {
                    localRec = localByRemote.get(cloudRec.remoteUrl);
                } else if (cloudRec.hash && localByHash.has(cloudRec.hash)) {
                    localRec = localByHash.get(cloudRec.hash);
                }
            }
            
            if (localRec) {
                // RÉCONCILIATION : On met à jour l'existant au lieu de dupliquer
                const localTime = new Date(localRec.updatedAt || localRec.date || 0).getTime();
                const cloudTime = new Date(cloudRec.updatedAt || cloudRec.date || 0).getTime();
                
                // Si la version cloud est plus récente OU si le local n'avait pas encore son dbId
                const needsIdUpdate = !localRec.dbId && cloudRec.dbId;

                if (needsIdUpdate || (cloudTime > localTime && localRec.status !== 'pending_update')) {
                    updatedItems.push({
                        ...localRec,
                        dbId: cloudRec.dbId, // On attache l'ID database s'il manquait
                        title: cloudRec.title,
                        type: cloudRec.type,
                        deliverDate: cloudRec.deliverDate,
                        tags: cloudRec.tags,
                        updatedAt: cloudRec.updatedAt,
                        // Si le cloud a une URL et que le local ne l'a plus (réparation après erreur 404), on la restaure
                        remoteUrl: cloudRec.remoteUrl || localRec.remoteUrl 
                    });
                }
                continue;
            }

            // NOUVEL ÉLÉMENT : Réellement absent du téléphone
            newItems.push({
                ...cloudRec,
                id: `cloud_${cloudRec.dbId || Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                status: 'synced',
                localUri: null
            });
        }

        // --- SÉCURITÉ ANTI-DOUBLONS (AUTO-CLEANUP) ---
        // On va filtrer localRecordings pour supprimer ceux qui pointent déjà vers un dbId traité
        const handledDbIds = new Set();
        updatedItems.forEach(u => handledDbIds.add(u.dbId));
        newItems.forEach(n => handledDbIds.add(n.dbId));

        const cleanedLocal = localRecordings.filter(loc => {
            if (!loc.dbId) return true; // On garde les locaux purs (non encore sync)
            if (handledDbIds.has(loc.dbId)) return false; // On dégage car déjà géré dans updatedItems
            handledDbIds.add(loc.dbId); // On marque cet ID comme "vu" pour les suivants
            return true;
        });

        if (newItems.length > 0 || updatedItems.length > 0 || cleanedLocal.length !== localRecordings.length) {
            const { STORAGE_KEY } = require('./storage');
            const { set } = require('idb-keyval');
            const { Platform } = require('react-native');
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            
            // Fusion finale : Nouveaux + Mis à jour + Locaux restants
            let merged = [...newItems, ...updatedItems, ...cleanedLocal];
            
            // Tri par date décroissante
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Sauvegarde atomique (JSON direct pour éviter les boucles d'updateRecording)
            const stringValue = JSON.stringify(merged);
            if (Platform.OS === 'web') {
                await set(STORAGE_KEY, stringValue);
            } else {
                await AsyncStorage.setItem(STORAGE_KEY, stringValue);
            }
            
            // Lancer le cache audio en tâche de fond pour les nouveaux venus
            cacheSupabaseAudioLocally(merged);
            
            console.log(`[Sync] Terminé: ${newItems.length} créés, ${updatedItems.length} mis à jour, ${localRecordings.length - cleanedLocal.length} doublons supprimés.`);
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
