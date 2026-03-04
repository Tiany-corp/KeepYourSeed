import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { getAudioSource } from '../services/storage';

// --- Contexte global du lecteur audio ---
const AudioPlayerContext = createContext(null);

/**
 * Hook pour accéder au lecteur audio global depuis n'importe quel composant.
 * Retourne : { currentTrack, isPlaying, position, duration, play, pause, toggle, stop }
 */
export const useAudioPlayer = () => {
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
    return ctx;
};

/**
 * Provider global du lecteur audio. À placer au plus haut niveau de l'app (App.js).
 * Gère un seul audio à la fois, persistant entre les changements d'écran.
 */
export function AudioPlayerProvider({ children }) {
    const [currentTrack, setCurrentTrack] = useState(null); // Le recording en cours
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [modalVisible, setModalVisible] = useState(false); // Contrôle la modale fullscreen
    const soundRef = useRef(null);

    const openModal = useCallback(() => setModalVisible(true), []);
    const closeModal = useCallback(() => setModalVisible(false), []);

    // Nettoyage quand le provider se démonte
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
                soundRef.current = null;
            }
        };
    }, []);

    // --- Décharger le son actuel ---
    const unloadSound = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (e) { /* son déjà déchargé */ }
            soundRef.current = null;
        }
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
    }, []);

    // --- Jouer un enregistrement ---
    const play = useCallback(async (recording) => {
        // Si c'est le même track et qu'il est chargé, reprendre la lecture
        if (recording && currentTrack?.id === recording.id && soundRef.current) {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded && !status.isPlaying) {
                await soundRef.current.playAsync();
                setIsPlaying(true);
                return;
            }
        }

        // Sinon, charger un nouveau track
        await unloadSound();

        const source = await getAudioSource(recording);
        if (!source) {
            console.error('Impossible de charger l\'audio:', recording?.title);
            return false;
        }

        try {
            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
            soundRef.current = sound;
            setCurrentTrack(recording);
            setIsPlaying(true);

            // Écouter les mises à jour de lecture
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    setPosition(status.positionMillis || 0);
                    setDuration(status.durationMillis || 0);
                }
                if (status.didJustFinish) {
                    setIsPlaying(false);
                    setPosition(0);
                    soundRef.current?.unloadAsync();
                    soundRef.current = null;
                }
            });
            return true;
        } catch (e) {
            console.error('Erreur de lecture:', e);
            setIsPlaying(false);
            return false;
        }
    }, [currentTrack, unloadSound]);

    // --- Pause ---
    const pause = useCallback(async () => {
        if (soundRef.current) {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded && status.isPlaying) {
                await soundRef.current.pauseAsync();
                setIsPlaying(false);
            }
        }
    }, []);

    // --- Toggle play/pause ---
    const toggle = useCallback(async (recording) => {
        // Si un recording est passé et que c'est un DIFFÉRENT track → jouer le nouveau
        if (recording && recording.id !== currentTrack?.id) {
            return play(recording);
        }

        // Sinon, toggle le track actuel
        if (soundRef.current) {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded && status.isPlaying) {
                await pause();
                return;
            }
            if (status.isLoaded && !status.isPlaying) {
                await soundRef.current.playAsync();
                setIsPlaying(true);
                return;
            }
        }

        // Si le son a fini (soundRef null) → relancer le même track ou le recording passé
        const trackToPlay = recording || currentTrack;
        if (trackToPlay) {
            return play(trackToPlay);
        }
    }, [currentTrack, play, pause]);

    // --- Stop complet ---
    const stop = useCallback(async () => {
        await unloadSound();
        setCurrentTrack(null);
        setModalVisible(false);
    }, [unloadSound]);

    const value = {
        currentTrack,
        isPlaying,
        position,
        duration,
        soundRef,
        modalVisible,
        play,
        pause,
        toggle,
        stop,
        openModal,
        closeModal,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
        </AudioPlayerContext.Provider>
    );
}
