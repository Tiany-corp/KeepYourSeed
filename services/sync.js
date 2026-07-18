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

        // Si la synchro auto est désactivée et que ce n'est pas un sync manuel, on skip
        if (!isManual) {
            const { getAutoSyncPreference } = require('./storage');
            const autoSyncEnabled = await getAutoSyncPreference();
            if (!autoSyncEnabled) {
                console.log('syncAll ignoré : synchro auto désactivée');
                return { success: false, pushed: 0, pulled: 0, status: 'auto-sync-disabled' };
            }
        }

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

        // 2. PULL : Toujours autorisé pour les métadonnées (texte)
        // Le téléchargement audio en tâche de fond dépend des restrictions Wi-Fi
        const canDownloadAudio = isManual || isWifi || !wifiOnly;
        pulledCount = await pullCloudRecordings(userId, canDownloadAudio);

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
 * Fonction de secours pour réparer les notes locales "bloquées".
 * Elle convertit toutes les notes sans ID Cloud en statut 'pending' et force le push.
 */
export const forcePushAllLocalNotes = async (userId) => {
    try {
        if (!userId || _isSyncing) return { success: false, pushed: 0 };
        _isSyncing = true;
        
        const localRecordings = await getRecordings();
        let repairCount = 0;
        
        // 1. Réparation des statuts (faux 'synced', erreurs, ou perte de données cloud)
        const repaired = localRecordings.map(rec => {
            const isFalseSynced = !rec.dbId && rec.status === 'synced';
            const isStuckError = !rec.dbId && rec.status === 'error';
            
            // NOUVEAU : Si la note a un ID mais qu'on veut forcer sa resynchro (ex: perte cloud)
            // On peut détecter ici si elle est orpheline ou simplement tout forcer si demandé.
            const isPotentialOrphan = rec.dbId && rec.status === 'synced'; 

            if (isFalseSynced || isStuckError || isPotentialOrphan) {
                repairCount++;
                // On retire le dbId car il n'est plus valide sur le serveur
                return { ...rec, status: 'pending', dbId: null, remoteUrl: null };
            }
            return rec;
        });

        if (repairCount > 0) {
            await saveRawRecordings(repaired);
            console.log(`[Sync] ${repairCount} notes locales ont été réinitialisées pour un nouvel envoi.`);
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
        if (cloudRecordings === null) return { success: false, orphans: [], error: "Erreur de connexion au Cloud" };
        if (!cloudRecordings) return { success: false, orphans: [] };

        const localRecordings = await getRecordings();
        const localWithDbId = localRecordings.filter(r => r.dbId);
        
        // On force la conversion en String pour éviter les problèmes de type (Number vs String)
        const cloudDbIds = new Set(cloudRecordings.map(c => String(c.dbId)).filter(Boolean));

        console.log(`[OrphanCheck] User: ${userId}`);
        console.log(`[OrphanCheck] Cloud count: ${cloudRecordings.length}`);
        console.log(`[OrphanCheck] Local with DBID count: ${localWithDbId.length}`);

        const orphans = localRecordings.filter(loc => {
            if (!loc.dbId || loc.keepLocalOnly) return false;
            const isMissing = !cloudDbIds.has(String(loc.dbId));
            return isMissing;
        });
        
        return { 
            success: true, 
            orphans,
            debug: {
                cloudCount: cloudRecordings.length,
                localWithDbIdCount: localWithDbId.length
            }
        };
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
    const { updateRecordingMetadataInDatabase, deleteRecordingFromCloud, uploadRecordingToCloud, saveRecordingToDatabase, fetchTotalCloudUsage } = require('./cloud');
    let localRecordings = await getRecordings();
    
    // On inclut 'error' pour retenter automatiquement les envois qui ont échoué par le passé
    const toSync = localRecordings.filter(r => 
        r.status === 'pending' || 
        r.status === 'pending_update' || 
        r.status === 'error' ||
        r.status === 'local_only'
    );
    
    if (toSync.length === 0) return 0;
    
    let count = 0;
    let hasChanged = false;

    // --- VÉRIFICATION DU QUOTA CLOUD (Limite dynamique) ---
    const { getCloudQuota } = require('./storage');
    const MAX_QUOTA_BYTES = await getCloudQuota();
    let currentUsage = await fetchTotalCloudUsage(userId);
    let quotaReached = currentUsage >= MAX_QUOTA_BYTES;

    // On travaille sur une copie fraîche pour éviter les effets de bord
    const workingList = [...localRecordings];

    for (const rec of toSync) {
        try {
            const idx = workingList.findIndex(r => r.id === rec.id);
            if (idx === -1) continue;

            const isCreation = rec.status === 'pending' || rec.status === 'local_only' || (rec.status === 'error' && !rec.dbId);
            const isUpdate = rec.status === 'pending_update' || (rec.status === 'error' && rec.dbId);

            if (isCreation) {
                // Si le quota est atteint, on annule l'upload et on force le fichier à rester en local
                if (quotaReached) {
                    console.log(`[Quota] Limite de 30 Mo atteinte. ${rec.title} restera en local.`);
                    workingList[idx] = { 
                        ...workingList[idx], 
                        keepLocalOnly: true, 
                        dbId: null, 
                        remoteUrl: null, 
                        status: 'local_only' 
                    };
                    hasChanged = true;
                    continue; // On passe au suivant sans uploader
                }

                const remoteUrl = await uploadRecordingToCloud(rec.id, rec.localUri, userId);
                if (remoteUrl) {
                    // RÉSOLUTION DU PARENT : Si on a un parentId local, on cherche son dbId Cloud
                    let cloudParentId = rec.parentId;
                    if (rec.parentId && (String(rec.parentId).startsWith('cloud_') || !String(rec.parentId).includes('-'))) {
                        const parent = workingList.find(r => r.id === rec.parentId);
                        cloudParentId = parent ? (parent.dbId || null) : null;
                    }

                    const dbRecord = await saveRecordingToDatabase(
                        userId, rec.title, remoteUrl, rec.duration,
                        rec.type || 'note', rec.deliverDate, rec.tags || [], rec.date,
                        cloudParentId
                    );
                    if (dbRecord) {
                        // Extraire le vrai UUID (saveRecordingToDatabase retourne l'objet complet)
                        const actualDbId = typeof dbRecord === 'object' ? dbRecord.id : dbRecord;
                        workingList[idx] = { 
                            ...workingList[idx], 
                            status: 'synced', 
                            dbId: actualDbId, 
                            remoteUrl: remoteUrl,
                            keepLocalOnly: false 
                        };
                        count++;
                        hasChanged = true;
                        
                        // Estimation rapide pour ne pas dépasser le quota pendant cette même boucle
                        // High Quality = ~1 Mo par minute
                        const estimatedSize = rec.duration ? (rec.duration / 60) * 1024 * 1024 : 1024 * 1024;
                        currentUsage += estimatedSize;
                        if (currentUsage >= MAX_QUOTA_BYTES) quotaReached = true;
                    }
                }
            } else if (rec.status === 'pending_update') {
                let resolvedParentId = rec.parentId;
                // Si le parentId est un ID local (commence par cloud_ ou n'est pas un UUID = pas de tiret)
                if (rec.parentId && (String(rec.parentId).startsWith('cloud_') || !String(rec.parentId).includes('-'))) {
                    const parent = workingList.find(r => r.id === rec.parentId);
                    resolvedParentId = parent ? (parent.dbId || null) : null;
                }

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
                        tags: rec.tags,
                        parentId: resolvedParentId
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
const pullCloudRecordings = async (userId, canDownloadAudio = true) => {
    try {
        const cloudRecordings = await fetchCloudRecordings(userId);
        const localRecordings = await getRecordings();

        // === ÉTAPE 1 : Construire un Map de TOUT le local, indexé par ID ===
        const resultMap = new Map();
        localRecordings.forEach(rec => resultMap.set(rec.id, { ...rec }));

        // === ÉTAPE 2 : Index de recherche pour le matching ===
        const localByDbId = new Map(
            localRecordings.filter(r => r.dbId).map(r => [r.dbId, r.id])
        );
        const localByRemote = new Map(
            localRecordings.filter(r => r.remoteUrl).map(r => [r.remoteUrl, r.id])
        );
        const localByDate = new Map(
            localRecordings.filter(r => r.date).map(r => [r.date?.replace('T', ' ').substring(0, 19), r.id])
        );
        const localByTitleDur = new Map(
            localRecordings.filter(r => !r.dbId && r.title && r.duration).map(r => [`${r.title}_${r.duration}`, r.id])
        );

        let newCount = 0;
        let updatedCount = 0;
        const newTitles = [];

        // === ÉTAPE 3 : Pour chaque item cloud, matcher ou créer ===
        for (const cloudRec of cloudRecordings) {
            // Chercher un match local (par priorité)
            let localId = localByDbId.get(cloudRec.dbId);
            
            if (!localId && cloudRec.remoteUrl) {
                localId = localByRemote.get(cloudRec.remoteUrl);
            }
            if (!localId && cloudRec.date) {
                const dateKey = cloudRec.date?.replace('T', ' ').substring(0, 19);
                localId = localByDate.get(dateKey);
            }
            if (!localId && cloudRec.title && cloudRec.duration) {
                const key = `${cloudRec.title}_${cloudRec.duration}`;
                localId = localByTitleDur.get(key);
                if (localId) localByTitleDur.delete(key);
            }

            if (localId && resultMap.has(localId)) {
                // MATCH TROUVÉ → Mettre à jour en place
                const existing = resultMap.get(localId);
                const localTime = new Date(existing.updatedAt || existing.date || 0).getTime();
                const cloudTime = new Date(cloudRec.updatedAt || cloudRec.date || 0).getTime();
                const needsIdUpdate = !existing.dbId && cloudRec.dbId;

                if (needsIdUpdate || (cloudTime > localTime && existing.status !== 'pending_update')) {
                    resultMap.set(localId, {
                        ...existing,
                        dbId: cloudRec.dbId,
                        title: cloudRec.title,
                        type: cloudRec.type,
                        deliverDate: cloudRec.deliverDate,
                        tags: cloudRec.tags,
                        updatedAt: cloudRec.updatedAt,
                        date: cloudRec.date,
                        deletedAt: cloudRec.deletedAt,
                        parentId: cloudRec.parentId,
                        graftType: cloudRec.graftType,
                        waterCount: cloudRec.waterCount,
                        remoteUrl: cloudRec.remoteUrl || existing.remoteUrl,
                        status: 'synced',
                    });
                    updatedCount++;
                } else if (existing.deletedAt !== cloudRec.deletedAt) {
                    resultMap.set(localId, { ...existing, deletedAt: cloudRec.deletedAt });
                    updatedCount++;
                } else if (!existing.dbId && cloudRec.dbId) {
                    // Au minimum, on récupère toujours le dbId
                    resultMap.set(localId, { ...existing, dbId: cloudRec.dbId, remoteUrl: cloudRec.remoteUrl || existing.remoteUrl, status: 'synced' });
                }
            } else {
                // PAS DE MATCH → Nouvel élément
                const newId = `cloud_${cloudRec.dbId || Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                resultMap.set(newId, {
                    ...cloudRec,
                    id: newId,
                    status: 'synced',
                    localUri: null,
                });
                newCount++;
                newTitles.push(cloudRec.title || 'Sans titre');
            }
        }

        // === ÉTAPE 4 : Déduplication finale par dbId (un seul local par cloud ID) ===
        const seenDbIds = new Set();
        const seenUrls = new Set();
        let merged = [];
        for (const [, item] of resultMap) {
            if (item.dbId) {
                if (seenDbIds.has(item.dbId)) continue;
                seenDbIds.add(item.dbId);
            }
            if (item.remoteUrl) {
                if (seenUrls.has(item.remoteUrl)) continue;
                seenUrls.add(item.remoteUrl);
            }
            merged.push(item);
        }

        // Tri par date décroissante
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Orphelins : items locaux avec un dbId qui n'est plus dans le cloud
        const cloudDbIdsSet = new Set(cloudRecordings.map(c => String(c.dbId)).filter(Boolean));
        const orphansCount = merged.filter(loc =>
            loc.dbId && !cloudDbIdsSet.has(String(loc.dbId)) && !loc.keepLocalOnly
        ).length;

        // Sauvegarder si quelque chose a changé
        if (newCount > 0 || updatedCount > 0 || merged.length !== localRecordings.length) {
            await saveRawRecordings(merged);

            if (canDownloadAudio) {
                cacheSupabaseAudioLocally(merged);
            } else {
                console.log(`[Sync] Métadonnées à jour. Cache audio ignoré (Wi-Fi requis).`);
            }

            console.log(`[Sync] Terminé: ${newCount} créés, ${updatedCount} mis à jour, ${localRecordings.length - merged.length} doublons supprimés.`);
        } else {
            cacheSupabaseAudioLocally(localRecordings);
        }

        return { count: newCount + updatedCount, newTitles, orphans: orphansCount };
    } catch (e) {
        console.error('Erreur pullCloudRecordings:', e);
        return { count: 0, newTitles: [], orphans: 0 };
    }
};


