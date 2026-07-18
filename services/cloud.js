import { supabase } from './supabase';
import { prepareAudioForUpload } from '../utils/audioHelper';
import { updateRecording } from './storage';

/**
 * Uploads an audio recording to Supabase Storage and updates local state.
 * @param {string} recordingId - Local ID of the recording (for updating status)
 * @param {string} localUri - Local URI of the audio file
 * @param {string} userId - ID of the user to organize folders
 * @returns {Promise<string|null>} - The public URL of the uploaded file or null if failed
 */
export const uploadRecordingToCloud = async (recordingId, localUri, userId = 'public') => { // Fonction qui envoie le blob sur le cloud
    try {
        // Marquer comme "en cours d'upload"
        await updateRecording(recordingId, { status: 'uploading' });

        const preparedFile = await prepareAudioForUpload(localUri);

        const timestamp = Date.now();
        const fileExt = preparedFile.extension || 'm4a';
        const fileName = `${userId}/${timestamp}.${fileExt}`;

        const fileDataToUpload = preparedFile.file || preparedFile;

        // Détermination du type MIME correct
        let contentType = 'audio/mp4'; // Par défaut pour .m4a
        if (fileExt === 'wav') contentType = 'audio/wav';
        if (fileExt === 'aac') contentType = 'audio/aac';
        if (fileExt === 'ogg') contentType = 'audio/ogg';

        const uploadOptions = {
            upsert: false,
            contentType: contentType
        };

        let { data, error } = await supabase.storage
            .from('audios')
            .upload(fileName, fileDataToUpload, uploadOptions);

        if (error) {
            console.error('Supabase Upload Error:', error.message);
            await updateRecording(recordingId, { status: 'error' });
            throw error;
        }

        console.log('Upload successful:', data);

        // On stocke le CHEMIN dans le bucket (ex: "userId/timestamp.m4a")
        // Ce chemin servira à générer des URLs signées temporaires à la lecture
        await updateRecording(recordingId, { remoteUrl: fileName, status: 'synced' });

        return fileName;

    } catch (e) {
        console.error('Upload failed:', e.message || e);
        await updateRecording(recordingId, { status: 'error' });
        return null;
    }
};

/**
 * Génère une URL signée temporaire pour lire un fichier audio depuis le bucket.
 * @param {string} storagePath - Chemin dans le bucket (ex: "userId/timestamp.m4a")
 * @param {number} expiresIn - Durée de validité en secondes (défaut: 1 heure)
 * @returns {Promise<{url: string|null, error: string|null}>} - URL signée et erreur éventuelle
 */
export const getSignedAudioUrl = async (storagePath, expiresIn = 3600) => {
    try {
        const { data, error } = await supabase.storage
            .from('audios')
            .createSignedUrl(storagePath, expiresIn);

        if (error) {
            // Si le fichier est physiquement absent du bucket
            if (error.message && error.message.includes('Object not found')) {
                return { url: null, error: 'NOT_FOUND' };
            }
            console.error('Signed URL Error:', error.message);
            return { url: null, error: error.message };
        }
        return { url: data.signedUrl, error: null };
    } catch (e) {
        console.error('Failed to get signed URL:', e);
        return { url: null, error: e.message || 'Unknown error' };
    }
};

/**
 * Saves recording metadata to the Supabase database.
 * @param {string} userId - The user's UUID
 * @param {string} title - Title of the recording
 * @param {string} audioUrl - Public URL of the audio file
 * @param {number} duration - Duration in seconds
 * @param {string} type - 'note' or 'message'
 * @param {string|null} deliverDate - ISO date for message delivery (null for notes)
 * @returns {Promise<Object|null>} - The inserted record or null if failed
 */
export const saveRecordingToDatabase = async (userId, title, audioUrl, duration, type = 'note', deliverDate = null, tags = [], originalDate = null, parentId = null, graftType = null) => {
    try {
        const insertData = {
            user_id: userId,
            title: title,
            audio_url: audioUrl,
            duration_seconds: duration,
            type: type,
        };
        if (deliverDate) {
            insertData.deliver_date = deliverDate;
        }
        if (tags && tags.length > 0) {
            insertData.tags = tags;
        }
        if (originalDate) {
            insertData.created_at = originalDate;
        }
        if (parentId) {
            insertData.parent_id = parentId;
        }
        if (graftType) {
            insertData['graftType'] = graftType;
        }
        insertData['waterCount'] = 0;

        // ANTI-DOUBLONS : Vérifier si une note identique existe déjà pour cet utilisateur
        const { data: existing, error: searchError } = await supabase
            .from('recordings')
            .select('*')
            .eq('user_id', userId)
            .eq('title', title)
            .eq('duration_seconds', duration)
            .is('deleted_at', null)
            .limit(1);

        if (!searchError && existing && existing.length > 0) {
            console.log('Duplicate found, using existing cloud recording:', existing[0].id);
            return existing[0];
        }

        const { data, error } = await supabase
            .from('recordings')
            .insert([insertData])
            .select();

        if (error) {
            console.error('Supabase DB Insert Error:', error);
            throw error;
        }

        console.log('Database save successful:', data);
        return data[0];

    } catch (e) {
        console.error('Database save failed:', e);
        return null;
    }
};

/**
 * Récupère les enregistrements d'un utilisateur depuis la table Supabase.
 * Convertit les données cloud au format local (localUri/remoteUrl/status).
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<Array>} - Liste de recordings au format app
 */
export const fetchCloudRecordings = async (userId) => {
    console.log(`[CloudFetch] Fetching recordings for user: ${userId}`);
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Fetch Error:', error);
            return null; // Retourner null au lieu de [] pour signaler une erreur de lecture
        }

        // Convertir le format Supabase → format app
        return (data || []).map(row => ({
            id: `cloud_${row.id}`,           // Préfixe pour éviter les collisions d'ID
            dbId: row.id,
            localUri: null,                   // Pas de fichier local sur ce device
            remoteUrl: row.audio_url,         // L'URL du bucket audios
            status: 'synced',                 // Déjà synchronisé par définition
            date: row.created_at,             // Date de création Supabase
            updatedAt: row.updated_at || row.created_at, // Last-Write-Wins reference
            duration: row.duration_seconds || 0,
            title: row.title || 'Sans titre',
            type: row.type || 'note',
            deliverDate: row.deliver_date || null,
            tags: row.tags || [],
            deletedAt: row.deleted_at || null,
            parentId: row.parent_id || null,
            graftType: row.graftType || null,
            waterCount: row.waterCount || 0,
        }));

    } catch (e) {
        console.error('Failed to fetch cloud recordings:', e);
        return null;
    }
};

/**
 * Met a jour les metadonnees d'un enregistrement dans Supabase.
 * Cible prioritaire: ID DB si disponible, sinon fallback par audio_url + user_id.
 */
export const updateRecordingMetadataInDatabase = async ({
    userId,
    recording,
    title,
    type,
    deliverDate,
    tags,
    parentId,
}) => {
    try {
        if (!userId || !recording) return false;

        const updates = {
            title: title || 'Sans titre',
            type: type || 'note',
            tags: Array.isArray(tags) ? tags : [],
            deliver_date: type === 'message' && deliverDate ? deliverDate : null,
            parent_id: parentId || null,
            updated_at: new Date().toISOString(), // Important pour le LWW
        };
        if (recording.graftType !== undefined) updates['graftType'] = recording.graftType;
        if (recording.waterCount !== undefined) updates['waterCount'] = recording.waterCount;

        let query = supabase.from('recordings').update(updates).eq('user_id', userId);
        if (recording.dbId) {
            query = query.eq('id', recording.dbId);
        } else if (recording.remoteUrl) {
            query = query.eq('audio_url', recording.remoteUrl);
        } else {
            return false;
        }

        const { error } = await query;
        if (error) {
            console.error('Supabase metadata update error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Failed to update recording metadata:', e);
        return false;
    }
};

/**
 * "Supprime" un enregistrement cloud (Soft Delete).
 * Ne supprime pas le fichier du bucket pour permettre la restauration.
 */
export const deleteRecordingFromCloud = async ({ userId, recording }) => {
    try {
        if (!userId || !recording) return false;

        const updates = {
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        let query = supabase.from('recordings').update(updates).eq('user_id', userId);
        if (recording.dbId) {
            query = query.eq('id', recording.dbId);
        } else if (recording.remoteUrl) {
            query = query.eq('audio_url', recording.remoteUrl);
        } else {
            return false;
        }

        const { error } = await query;
        if (error) {
            console.error('Cloud Soft Delete error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Failed to soft delete cloud recording:', e);
        return false;
    }
};

/**
 * Restaure un enregistrement depuis la corbeille.
 */
export const restoreRecordingFromCloud = async ({ userId, recording }) => {
    try {
        if (!userId || !recording) return false;

        const updates = {
            deleted_at: null,
            updated_at: new Date().toISOString(),
        };

        let query = supabase.from('recordings').update(updates).eq('user_id', userId);
        if (recording.dbId) {
            query = query.eq('id', recording.dbId);
        } else if (recording.remoteUrl) {
            query = query.eq('audio_url', recording.remoteUrl);
        }

        const { error } = await query;
        if (error) {
            console.error('Cloud Restore error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Failed to restore cloud recording:', e);
        return false;
    }
};

/**
 * Supprime DEFINITIVEMENT un enregistrement (Ligne DB + Fichier Bucket).
 */
export const permanentlyDeleteFromCloud = async ({ userId, recording }) => {
    try {
        if (!userId || !recording) return false;

        // 1. Suppression du fichier physique
        if (recording.remoteUrl && !recording.remoteUrl.startsWith('http')) {
            const { error: removeError } = await supabase.storage
                .from('audios')
                .remove([recording.remoteUrl]);
            if (removeError) {
                console.error('Permanent file delete error:', removeError);
            }
        }

        // 2. Suppression de la ligne DB
        let query = supabase.from('recordings').delete().eq('user_id', userId);
        if (recording.dbId) {
            query = query.eq('id', recording.dbId);
        } else if (recording.remoteUrl) {
            query = query.eq('audio_url', recording.remoteUrl);
        }

        const { error } = await query;
        if (error) {
            console.error('Permanent DB delete error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Failed to permanently delete cloud recording:', e);
        return false;
    }
};

/**
 * Récupère uniquement les enregistrements supprimés (Corbeille).
 */
export const fetchTrashRecordings = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('*')
            .eq('user_id', userId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Supabase Trash Fetch Error:', error);
            return [];
        }

        return (data || []).map(row => ({
            id: `cloud_${row.id}`,
            dbId: row.id,
            localUri: null,
            remoteUrl: row.audio_url,
            status: 'synced',
            date: row.created_at,
            deletedAt: row.deleted_at,
            updatedAt: row.updated_at || row.created_at,
            duration: row.duration_seconds || 0,
            title: row.title || 'Sans titre',
            type: row.type || 'note',
            deliverDate: row.deliver_date || null,
            tags: row.tags || [],
        }));
    } catch (e) {
        console.error('Failed to fetch trash:', e);
        return [];
    }
};

/**
 * Supprime tous les fichiers audio d'un utilisateur dans le bucket.
 * Utilise list + remove car emptyBucket nécessite la clé admin.
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<boolean>} - true si réussi, false sinon
 */
export const emptyAudiosBucket = async (userId) => {
    try {
        // 1. Lister tous les fichiers dans le dossier de l'utilisateur
        const { data: files, error: listError } = await supabase.storage
            .from('audios')
            .list(userId);

        if (listError) {
            console.error('List files error:', listError.message);
            return false;
        }

        // 2. Supprimer les fichiers du bucket s'il y en a
        if (files && files.length > 0) {
            const filePaths = files.map(file => `${userId}/${file.name}`);
            const { error: removeError } = await supabase.storage
                .from('audios')
                .remove(filePaths);

            if (removeError) {
                console.error('Remove files error:', removeError.message);
                return false;
            }
            console.log(`${filePaths.length} fichier(s) supprimé(s) du bucket`);
        }

        // 3. Supprimer aussi les lignes de la table recordings (sinon elles réapparaissent)
        const { error: dbError } = await supabase
            .from('recordings')
            .delete()
            .eq('user_id', userId);

        if (dbError) {
            console.error('Delete recordings DB error:', dbError.message);
            return false;
        }

        console.log('Toutes les données cloud supprimées (bucket + table)');
        return true;
    } catch (e) {
        console.error('Failed to empty bucket:', e);
        return false;
    }
};

/**
 * Récupère UN enregistrement aléatoire via la fonction RPC PostgreSQL.
 * Utilisé pour la fonctionnalité "Souvenir du jour".
 * Plus performant : 1 seule requête au lieu de 2 (count + select).
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<Object|null>} - Un recording au format app, ou null si rien trouvé
 */
export const fetchRandomRecording = async (userId) => {
    try {
        const { data, error } = await supabase
            .rpc('get_random_recording', { p_user_id: userId });

        if (error) {
            console.error('RPC get_random_recording error:', error);
            return null;
        }

        if (!data || data.length === 0) {
            console.log('Aucun enregistrement trouvé pour le souvenir du jour');
            return null;
        }

        const row = data[0];
        return {
            id: `cloud_${row.id}`,
            dbId: row.id,
            localUri: null,
            remoteUrl: row.audio_url,
            status: 'synced',
            date: row.created_at,
            duration: row.duration_seconds || 0,
            title: row.title || 'Sans titre',
            type: row.type || 'note',
            tags: row.tags || [],
            opened: row.opened || false,
        };

    } catch (e) {
        console.error('Failed to fetch random recording:', e);
        return null;
    }
};

/**
 * Récupère TOUS les messages non ouverts dont la date de livraison est passée.
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<Array>} - Un tableau de recordings de type 'message'
 */
export const fetchPendingMessages = async (userId) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        // On demande à Supabase de ne chercher que les messages dont la date de livraison est comprise dans la journée d'aujourd'hui
        const startOfDay = `${todayStr}T00:00:00.000Z`;
        const endOfDay = `${todayStr}T23:59:59.999Z`;

        const { data, error } = await supabase
            .from('recordings')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'message')
            .eq('opened', false)
            .gte('deliver_date', startOfDay)
            .lte('deliver_date', endOfDay)
            .order('deliver_date', { ascending: true });

        if (error) {
            console.error('fetchPendingMessages error:', error);
            return [];
        }

        if (!data || data.length === 0) return [];

        return data.map(row => ({
            id: `cloud_${row.id}`,
            dbId: row.id,
            localUri: null,
            remoteUrl: row.audio_url,
            status: 'synced',
            date: row.created_at,
            deliverDate: row.deliver_date, // <- Ajout crucial ici
            duration: row.duration_seconds || 0,
            title: row.title || 'Sans titre',
            type: row.type || 'message',
            tags: row.tags || [],
            opened: row.opened || false,
        }));

    } catch (e) {
        console.error('Failed to fetch pending messages:', e);
        return [];
    }
};

/**
 * Marque un message comme ouvert dans Supabase.
 */
export const markMessageAsOpened = async (dbId) => {
    try {
        const { error } = await supabase
            .from('recordings')
            .update({ opened: true })
            .eq('id', dbId);
        if (error) console.error('markMessageAsOpened error:', error);
    } catch (e) {
        console.error('Failed to mark message as opened:', e);
    }
};

/**
 * Récupère la consommation de stockage d'un utilisateur spécifique.
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<number>} - Taille totale en octets
 */
export const fetchTotalCloudUsage = async (userId) => {
    try {
        if (!userId) return 0;
        const { data, error } = await supabase.rpc('get_user_storage_usage', { p_user_id: userId });
        if (error) {
            console.error('RPC Error (Usage):', error.message);
            return 0;
        }
        return data || 0;
    } catch (e) {
        console.error('Failed to fetch cloud usage:', e);
        return 0;
    }
};

