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
        const uploadOptions = {
            upsert: false,
            contentType: 'audio/m4a'
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
 * @returns {Promise<string|null>} - URL signée temporaire ou null
 */
export const getSignedAudioUrl = async (storagePath, expiresIn = 3600) => {
    try {
        const { data, error } = await supabase.storage
            .from('audios')
            .createSignedUrl(storagePath, expiresIn);

        if (error) {
            console.error('Signed URL Error:', error.message);
            return null;
        }
        return data.signedUrl;
    } catch (e) {
        console.error('Failed to get signed URL:', e);
        return null;
    }
};

/**
 * Saves recording metadata to the Supabase database.
 * @param {string} userId - The user's UUID
 * @param {string} title - Title of the recording
 * @param {string} audioUrl - Public URL of the audio file
 * @param {number} duration - Duration in seconds
 * @returns {Promise<Object|null>} - The inserted record or null if failed
 */
export const saveRecordingToDatabase = async (userId, title, audioUrl, duration) => {
    try {
        const { data, error } = await supabase
            .from('recordings')
            .insert([
                {
                    user_id: userId,
                    title: title,
                    audio_url: audioUrl,
                    duration_seconds: duration,
                },
            ])
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
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Fetch Error:', error);
            return [];
        }

        // Convertir le format Supabase → format app
        return (data || []).map(row => ({
            id: `cloud_${row.id}`,           // Préfixe pour éviter les collisions d'ID
            localUri: null,                   // Pas de fichier local sur ce device
            remoteUrl: row.audio_url,         // L'URL du bucket audios
            status: 'synced',                 // Déjà synchronisé par définition
            date: row.created_at,             // Date de création Supabase
            duration: row.duration_seconds || 0,
            title: row.title || 'Sans titre',
        }));

    } catch (e) {
        console.error('Failed to fetch cloud recordings:', e);
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