import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createAudioPlayer } from 'expo-audio';
import { getAudioSource } from '../services/storage';

// --- Contexte global du lecteur audio ---
const AudioPlayerContext = createContext(null);
// --- Contexte isolé pour la progression (évite les re-rendus massifs de la liste) ---
const AudioPlayerProgressContext = createContext(0);

/**
 * Hook pour accéder au contrôleur du lecteur (play, pause, currentTrack, etc).
 */
export const useAudioPlayer = () => {
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
    return ctx;
};

/**
 * Hook spécial pour la barre de progression (mis à jour fréquemment).
 */
export const useAudioProgress = () => {
    return useContext(AudioPlayerProgressContext);
};

export function AudioPlayerProvider({ children }) {
    // Le lecteur persistant unique (Native)
    const player = useMemo(() => createAudioPlayer(null), []);
    
    // Suivi de l'état "Métier" (quel morceau, est-ce en pause ?)
    const [currentTrack, setCurrentTrack] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Synchronisation simple de l'état isPlaying depuis l'objet player
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    
    // Ref pour contrer la latence du bridge (Optimistic UI ultra robuste)
    const intentionalPlay = useRef(false);

    const openModal = useCallback(() => setModalVisible(true), []);
    const closeModal = useCallback(() => setModalVisible(false), []);

    // Nettoyage impératif lors de la destruction du provider
    useEffect(() => {
        return () => {
            player.release();
        };
    }, [player]);

    // Écoute des changements d'état du player natif
    useEffect(() => {
        const sub = player.addListener('playbackStatusUpdate', (status) => {
            if (!status) return;
            
            // Si on a l'intention de jouer, on force l'icône sur Pause (isPlaying = true)
            // pour masquer les événements "playing: false" que le natif émet quand il vide son buffer
            if (intentionalPlay.current) {
                setIsPlaying(true);
            } else {
                setIsPlaying(status.playing);
            }
            
            // Met à jour la durée (quand elle est disponible) : expo-audio renvoie des SECONDES, on repasse en MS
            if (status.isLoaded && status.duration) {
                setDuration(Math.floor(status.duration * 1000));
            }
            setPosition(Math.floor((status.currentTime || 0) * 1000));
            
            if (status.didJustFinish) {
                intentionalPlay.current = false;
                setIsPlaying(false);
                setPosition(0);
            }
        });

        return () => {
            sub.remove();
        };
    }, [player]);

    // --- Jouer un enregistrement ---
    const play = useCallback(async (recording) => {
        if (!recording) return;

        // Optimistic UI : On fixe l'intention
        intentionalPlay.current = true;
        setIsPlaying(true);
        setCurrentTrack(recording);

        if (currentTrack?.id === recording.id) {
            player.play();
            return;
        }

        const source = await getAudioSource(recording);
        if (!source) {
            intentionalPlay.current = false;
            setIsPlaying(false);
            return;
        }

        try {
            // ZAPPING INSTANTANÉ
            player.replace(source);
            player.play();
        } catch (e) {
            intentionalPlay.current = false;
            setIsPlaying(false);
            console.error('Erreur expo-audio play:', e);
        }
    }, [currentTrack, player]);

    const pause = useCallback(() => {
        intentionalPlay.current = false;
        setIsPlaying(false);
        player.pause();
    }, [player]);

    const toggle = useCallback(async (recording) => {
        // Switch vers un nouvel audio
        if (recording && recording.id !== currentTrack?.id) {
            return play(recording);
        }

        // Toggle l'audio actuel
        if (player.playing) {
            pause();
        } else {
            // Si fini, remettre au début
            if (position >= duration && duration > 0) {
                player.seekTo(0);
            }
            player.play();
        }
    }, [currentTrack, player, play, pause, position, duration]);

    const stop = useCallback(() => {
        player.pause();
        player.replace(null);
        setCurrentTrack(null);
        setModalVisible(false);
    }, [player]);

    const seekTo = useCallback((positionMillis) => {
        // expo-audio s'attend à recevoir des secondes
        player.seekTo(positionMillis / 1000);
    }, [player]);

    const value = {
        currentTrack,
        isPlaying,
        duration,
        modalVisible,
        play,
        pause,
        toggle,
        stop,
        seekTo,
        openModal,
        closeModal,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            <AudioPlayerProgressContext.Provider value={position}>
                {children}
            </AudioPlayerProgressContext.Provider>
        </AudioPlayerContext.Provider>
    );
}
