import { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioRecorder as useExpoAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Platform } from 'react-native';
import { saveAudioBlobWeb } from '../services/storage';

/**
 * Hook d'enregistrement audio utilisant la nouvelle librairie expo-audio (SDK 54+).
 * Garantit une latence minimale et une architecture découplée.
 */
export default function useAudioRecorder() {
    // Le recorder interne de expo-audio
    const recorder = useExpoAudioRecorder(
        Platform.OS === 'web' ? {
            isMeteringEnabled: true,
        } : RecordingPresets.HIGH_QUALITY
    );
    
    // État local pour le pont de compatibilité avec l'ancienne UI
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const timerRef = useRef(null);

    // Synchronisation de la durée (chaque seconde pour l'affichage)
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const startRecording = useCallback(async () => {
        try {
            const hasPermission = await AudioModule.requestRecordingPermissionsAsync();
            if (!hasPermission.granted) {
                alert("Permission d'accès au microphone refusée.");
                return;
            }

            // Lancement via expo-audio (API: prepareToRecordAsync() puis .record())
            await recorder.prepareToRecordAsync();
            recorder.record();
            
            setIsRecording(true);
            setDuration(0);
        } catch (error) {
            console.error('Erreur expo-audio start:', error);
        }
    }, [recorder]);

    const stopRecording = useCallback(async () => {
        try {
            // OPTIMISME : On arrête l'UI immédiatement pour supprimer la sensation de latence
            setIsRecording(false);
            const recordedDuration = duration; // On capture la durée finale

            // Arrêt matériel (peut prendre 100-200ms sur native)
            await recorder.stop();
            const uri = recorder.uri; // URI du fichier temporaire

            if (!uri) return null;

            // Gestion spécifique au Web (Sauvegarde IndexedDB persistante)
            if (Platform.OS === 'web') {
                // On lance la sauvegarde en background sans "await" pour ne pas bloquer l'UI
                const audioId = `audio_${Date.now()}`;
                const saveToIndexedDB = async (blobUri, id) => {
                    try {
                        const response = await fetch(blobUri);
                        const blob = await response.blob();
                        await saveAudioBlobWeb(id, blob);
                    } catch (e) {
                        console.error('Échec sauvegarde background Web:', e);
                    }
                };
                saveToIndexedDB(uri, audioId);
                return `indexeddb://${audioId}`;
            }

            return uri;
        } catch (error) {
            console.error('Erreur expo-audio stop:', error);
            setIsRecording(false);
            return null;
        }
    }, [recorder, duration]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    return {
        isRecording,
        duration,
        startRecording,
        stopRecording,
        formatDuration,
    };
}
