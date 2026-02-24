import { Platform } from 'react-native';
import { getAudioBlobUrlWeb } from '../services/storage';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Prepares an audio file for upload to a backend (e.g., Supabase).
 * 
 * @param {string} uri - The local URI of the audio file.
 * @returns {Promise<object>} - Un objet avec { file, type, extension }
 * 
 * - WEB: Fetch le blob depuis IndexedDB → File object
 * - MOBILE: Lit le fichier avec expo-file-system → ArrayBuffer
 */
export const prepareAudioForUpload = async (uri) => {
    if (Platform.OS === 'web') {
        try {
            let fetchUri = uri;
            if (uri.startsWith('indexeddb://')) {
                const audioId = uri.replace('indexeddb://', '');
                const blobUrl = await getAudioBlobUrlWeb(audioId);
                if (!blobUrl) {
                    throw new Error("Blob introuvable dans IndexedDB pour cet ID.");
                }
                fetchUri = blobUrl;
            }

            const response = await fetch(fetchUri);
            const blob = await response.blob();
            const file = new File([blob], 'recording.m4a', { type: 'audio/m4a' });

            return {
                type: 'audio/m4a',
                file: file,
                extension: 'm4a',
            };
        } catch (error) {
            console.error('Error preparing audio blob for web upload:', error);
            throw error;
        }
    } else {
        // Sur Mobile : lire le fichier en base64 via expo-file-system
        // puis décoder en ArrayBuffer pour Supabase
        try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // Décoder le base64 en ArrayBuffer (format binaire pur)
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            return {
                type: 'audio/m4a',
                file: bytes.buffer,   // ArrayBuffer : données binaires brutes
                extension: 'm4a',
            };
        } catch (error) {
            console.error('Error preparing audio for mobile upload:', error);
            throw error;
        }
    }
};

