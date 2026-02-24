import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { saveAudioBlobWeb } from '../services/storage';

export default function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const recordingRef = useRef(null);
    const intervalRef = useRef(null);

    const startRecording = async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                alert("Permission d'accès au microphone refusée.");
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;
            setIsRecording(true);
            setDuration(0);

            intervalRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Erreur lors du démarrage de l\'enregistrement', error);
        }
    };

    const stopRecording = async () => {
        try {
            clearInterval(intervalRef.current);
            setIsRecording(false);

            if (!recordingRef.current) return null;

            await recordingRef.current.stopAndUnloadAsync();
            const blobUri = recordingRef.current.getURI(); // URI temporaire (blob:// sur web, file:// sur mobile)
            recordingRef.current = null;

            // Sur le Web : on sauvegarde le vrai Blob binaire dans IndexedDB pour la persistance
            if (Platform.OS === 'web') {
                try {
                    const response = await fetch(blobUri);
                    const blob = await response.blob();
                    const audioId = `audio_${Date.now()}`; // Identifiant unique pour ce Blob
                    await saveAudioBlobWeb(audioId, blob);
                    // On retourne une URI personnalisée qui fait référence à l'ID dans IndexedDB
                    return `indexeddb://${audioId}`;
                } catch (e) {
                    console.error('Impossible de sauvegarder le blob audio dans IndexedDB:', e);
                    return blobUri; // Fallback : retourner l'URI temporaire
                }
            }

            return blobUri; // Sur mobile : l'URI file:// locale est déjà suffisante
        } catch (error) {
            console.error('Erreur lors de l\'arrêt de l\'enregistrement', error);
            return null;
        }
    };

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
