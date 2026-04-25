import { getRecordings, updateRecording, cacheSupabaseAudioLocally, deduplicateLocalStore, saveRawRecordings } from './storage';
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
            pushedCount = await pushLocalChanges(userId);
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
            pulled: pulledCount.count !== undefined ? pulledCount.count : pulledCount,
            newTitles: pulledCount.newTitles || [],
            orphans: pulledCount.orphans || 0,
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

        const pushed = await pushLocalChanges(userId);
        return { success: true, pushed };
    } catch (error) {
        console.error('Erreur pushOnly:', error);
        return { success: false, pushed: 0 };
    } finally {
        _isSyncing = false;
    }
};

/**
 * Fonction de secours pour réparer les notes locales "bloquées".
 * Elle convertit toutes les notes sans ID Cloud en statut 'pending' et force le push.
 */
export const forcePushAllLocalNotes = async (userId) => {
    try {
        if (!userId || _isSyncing) return { success: false, pushed: 0 };
        _isSyncing = true;
        
        const localRecordings = await getRecordings();
        let repairCount = 0;
        
        // 1. Réparation des statuts (faux 'synced' ou erreurs persistantes)
        const repaired = localRecordings.map(rec => {
            const isFalseSynced = !rec.dbId && rec.status === 'synced';
            const isStuckError = !rec.dbId && rec.status === 'error';
            
            if (isFalseSynced || isStuckError) {
                repairCount++;
                return { ...rec, status: 'pending' };
            }
            return rec;
        });

        if (repairCount > 0) {
            await saveRawRecordings(repaired);
            console.log(`[Sync] ${repairCount} notes locales bloquées ont été repassées en 'pending'.`);
        }

        // 2. Lancement du push normal
        const pushed = await pushLocalChanges(userId);
        return { success: true, pushed, repaired: repairCount };
    } catch (error) {
        console.error('Erreur forcePush:', error);
        return { success: false, pushed: 0, error };
    } finally {
        _isSyncing = false;
    }
};


/**
 * Analyse la BDD Cloud et supprime du téléphone tous les enregistrements locaux
 * qui possèdent un dbId mais qui ont été hard-delete (suppression manuelle DB) sur le Cloud.
 */
export const purgeHardDeletedCloudItems = async (userId, specificIdsToPurge = null) => {
    try {
        const { fetchCloudRecordings } = require('./cloud');
        const cloudRecordings = await fetchCloudRecordings(userId);
        if (!cloudRecordings) return { success: false, msg: "Connexion Cloud impossible." };

        const localRecordings = await getRecordings();
        const cloudDbIds = new Set(cloudRecordings.map(c => c.dbId).filter(Boolean));

        const kept = [];
        let deletedCount = 0;

        for (const loc of localRecordings) {
            if (loc.dbId && !cloudDbIds.has(loc.dbId)) {
                // Si on a fourni une liste d'IDs, on ne supprime que ceux-là
                if (specificIdsToPurge && !specificIdsToPurge.includes(loc.id)) {
                    kept.push(loc);
                    continue;
                }
                
                // Ce fichier a été supprimé definitivement du cloud, on le purge localement
                deletedCount++;
                try {
                    const { del } = require('idb-keyval');
                    await del(`audio_file_${loc.id}`);
                } catch(e) {}
                continue;
            }
            kept.push(loc);
        }

        if (deletedCount > 0) {
            await saveRawRecordings(kept);
        }

        return { success: true, count: deletedCount };
    } catch (e) {
        console.error("Erreur purge locale:", e);
        return { success: false, msg: e.message };
    }
};

/**
 * Récupère la liste des enregistrements locaux qui sont orphelins (supprimés du cloud).
 */
export const getOrphanedCloudItems = async (userId) => {
    try {
        const { fetchCloudRecordings } = require('./cloud');
        const cloudRecordings = await fetchCloudRecordings(userId);
        if (!cloudRecordings) return { success: false, orphans: [] };

        const localRecordings = await getRecordings();
        const cloudDbIds = new Set(cloudRecordings.map(c => c.dbId).filter(Boolean));

        const orphans = localRecordings.filter(loc => loc.dbId && !cloudDbIds.has(loc.dbId));
        return { success: true, orphans };
    } catch (e) {
        console.error("Erreur get orphans:", e);
        return { success: false, orphans: [] };
    }
};

/**
 * Envoie les créations ('pending') et mises à jour ('pending_update') vers Supabase.
 * Traitement en lot (Batch) pour éviter les sauvegardes répétées du gros tableau JSON.
 */
const pushLocalChanges = async (userId) => {
    const { updateRecordingMetadataInDatabase, deleteRecordingFromCloud, uploadRecordingToCloud, saveRecordingToDatabase } = require('./cloud');
    let localRecordings = await getRecordings();
    
    // On inclut 'error' pour retenter automatiquement les envois qui ont échoué par le passé
    const toSync = localRecordings.filter(r => 
        r.status === 'pending' || 
        r.status === 'pending_update' || 
        r.status === 'error'
    );
    
    if (toSync.length === 0) return 0;
    
    let count = 0;
    let hasChanged = false;

    // On travaille sur une copie fraîche pour éviter les effets de bord
    const workingList = [...localRecordings];

    for (const rec of toSync) {
        try {
            const idx = workingList.findIndex(r => r.id === rec.id);
            if (idx === -1) continue;

            const isCreation = rec.status === 'pending' || (rec.status === 'error' && !rec.dbId);
            const isUpdate = rec.status === 'pending_update' || (rec.status === 'error' && rec.dbId);

            if (isCreation) {
                const remoteUrl = await uploadRecordingToCloud(rec.id, rec.localUri, userId);
                if (remoteUrl) {
                    const dbId = await saveRecordingToDatabase(
                        userId, rec.title, remoteUrl, rec.duration,
                        rec.type || 'note', rec.deliverDate, rec.tags || [], rec.date
                    );
                    if (dbId) {
                        workingList[idx] = { ...workingList[idx], status: 'synced', dbId };
                        count++;
                        hasChanged = true;
                    }
                }
            } else if (rec.status === 'pending_update') {
                let ok = false;
                if (rec.deletedAt) {
                    ok = await deleteRecordingFromCloud({ userId, recording: rec });
                } else {
                    ok = await updateRecordingMetadataInDatabase({
                        userId,
                        recording: rec,
                        title: rec.title,
                        type: rec.type,
                        deliverDate: rec.deliverDate,
                        tags: rec.tags
                    });
                }

                if (ok) {
                    workingList[idx] = { ...workingList[idx], status: 'synced' };
                    count++;
                    hasChanged = true;
                }
            }
        } catch (err) {
            console.error(`Erreur push change pour "${rec.title}":`, err);
            // On ne modifie pas le status ici pour laisser une chance au prochain sycn, 
            // ou on pourrait mettre 'error' mais sans sauvegarder le tableau complet à chaque fois.
        }
    }

    if (hasChanged) {
        await saveRawRecordings(workingList);
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
        // Fallback extrême pour les très vieux enregistrements sans ID/URL (ex: 16 mars)
        const localByTitleAndDuration = new Map(
            localRecordings.filter(r => !r.dbId && r.title && r.duration).map(r => [`${r.title}_${r.duration}`, r])
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
                } else if (cloudRec.title && cloudRec.duration) {
                    const fallbackKey = `${cloudRec.title}_${cloudRec.duration}`;
                    if (localByTitleAndDuration.has(fallbackKey)) {
                        localRec = localByTitleAndDuration.get(fallbackKey);
                        // On le retire pour ne pas matcher plusieurs cloudRecs sur le même vieux local
                        localByTitleAndDuration.delete(fallbackKey);
                    }
                }
            }
            
            // On ne bloque plus ici pour permettre la synchronisation de la corbeille (restauration/suppression)
            
            if (localRec) {
                // RÉCONCILIATION : On met à jour l'existant au lieu de dupliquer
                const localTime = new Date(localRec.updatedAt || localRec.date || 0).getTime();
                const cloudTime = new Date(cloudRec.updatedAt || cloudRec.date || 0).getTime();
                
                // Si la version cloud est plus récente OU si le local n'avait pas encore son dbId
                const needsIdUpdate = !localRec.dbId && cloudRec.dbId;

                if (needsIdUpdate || (cloudTime > localTime && localRec.status !== 'pending_update')) {
                    updatedItems.push({
                        ...localRec,
                        dbId: cloudRec.dbId,
                        title: cloudRec.title,
                        type: cloudRec.type,
                        deliverDate: cloudRec.deliverDate,
                        tags: cloudRec.tags,
                        updatedAt: cloudRec.updatedAt,
                        date: cloudRec.date,
                        deletedAt: cloudRec.deletedAt, // Sync de l'état de la corbeille
                        remoteUrl: cloudRec.remoteUrl || localRec.remoteUrl 
                    });
                } else if (localRec.deletedAt !== cloudRec.deletedAt) {
                    // Sync spécifique de la corbeille si le reste est à jour
                    updatedItems.push({
                        ...localRec,
                        deletedAt: cloudRec.deletedAt
                    });
                } else if (cloudRec.date && localRec.date !== cloudRec.date) {
                    // Si l'élément n'a pas besoin de mise à jour Méta globale, mais que la date du serveur diffère
                    // (souvent suite à un script de correction ou un import décalé), on écrase discrètement la date locale.
                    updatedItems.push({
                        ...localRec,
                        date: cloudRec.date
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
        // OU ceux qui partagent une URL déjà gérée (évite les doublons sans ID).
        const handledDbIds = new Set();
        const handledRemoteUrls = new Set();

        updatedItems.forEach(u => {
            if (u.dbId) handledDbIds.add(u.dbId);
            if (u.remoteUrl) handledRemoteUrls.add(u.remoteUrl);
        });
        newItems.forEach(n => {
            if (n.dbId) handledDbIds.add(n.dbId);
            if (n.remoteUrl) handledRemoteUrls.add(n.remoteUrl);
        });

        const cleanedLocal = localRecordings.filter(loc => {
            // Si on a déjà traité cet élément (par son ID unique cloud)
            if (loc.dbId && handledDbIds.has(loc.dbId)) return false; 
            
            // Si l'URL est déjà gérée par une version cloud plus fraîche
            if (loc.remoteUrl && handledRemoteUrls.has(loc.remoteUrl)) return false;

            // Dédoublonnage interne : si on voit deux fois le même dbId, on dégage les suivants
            if (loc.dbId) {
                if (handledDbIds.has(loc.dbId)) return false;
                handledDbIds.add(loc.dbId);
            }
            return true;
        });

        // --- DÉTECTION DES ORPHELINS (pour alerte utilisateur) ---
        // Un orphelin est un local qui a un dbId, mais qui n'est plus dans le cloud
        const orphansCount = localRecordings.filter(loc => 
            loc.dbId && !handledDbIds.has(loc.dbId)
        ).length;

        if (newItems.length > 0 || updatedItems.length > 0 || cleanedLocal.length !== localRecordings.length) {
            // Fusion finale : Nouveaux + Mis à jour + Locaux restants
            let merged = [...newItems, ...updatedItems, ...cleanedLocal];
            
            // Tri par date décroissante
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Sauvegarde atomique (JSON direct pour éviter les boucles d'updateRecording)
            await saveRawRecordings(merged);
            
            // Lancer le cache audio en tâche de fond pour les nouveaux venus
            cacheSupabaseAudioLocally(merged);
            
            console.log(`[Sync] Terminé: ${newItems.length} créés, ${updatedItems.length} mis à jour, ${localRecordings.length - cleanedLocal.length} doublons supprimés.`);
            return { 
                count: newItems.length + updatedItems.length,
                newTitles: newItems.map(n => n.title || 'Sans titre'),
                orphans: orphansCount
            };
        }

        // Même si pas de nouveaux items, on vérifie si certains audios distants ne sont pas encore cachés
        cacheSupabaseAudioLocally(localRecordings);
        return { count: 0, newTitles: [], orphans: orphansCount };
    } catch (e) {
        console.error('Erreur pullCloudRecordings:', e);
        return { count: 0, newTitles: [], orphans: 0 };
    }
};
