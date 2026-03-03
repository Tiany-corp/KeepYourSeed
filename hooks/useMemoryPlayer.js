import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import { getAudioSource } from '../services/storage';

export default function useMemoryPlayer(dailyMemory) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const soundRef = useRef(null);

    const cleanup = useCallback(async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
    }, []);

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const play = useCallback(async () => {
        try {
            if (!dailyMemory) return;

            // Use existing audio if already loaded
            if (soundRef.current) {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded && !status.isPlaying) {
                    await soundRef.current.playAsync();
                    setIsPlaying(true);
                    return;
                }
            }

            // Clean up and load new
            await cleanup();
            const source = await getAudioSource(dailyMemory);
            if (!source) {
                Alert.alert('Erreur', 'Impossible de charger ce souvenir.');
                return;
            }

            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
            soundRef.current = sound;
            setIsPlaying(true);

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
        } catch (e) {
            console.error('Erreur lecture souvenir:', e);
            setIsPlaying(false);
        }
    }, [dailyMemory, cleanup]);

    const stop = useCallback(async () => {
        await cleanup();
        setShowPlayer(false);
    }, [cleanup]);

    const toggle = useCallback(async () => {
        if (soundRef.current) {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded && status.isPlaying) {
                await soundRef.current.pauseAsync();
                setIsPlaying(false);
                return;
            }
        }
        await play();
    }, [play]);

    return {
        isPlaying,
        showPlayer,
        setShowPlayer,
        position,
        duration,
        soundRef,
        toggle,
        play,
        stop,
        cleanup
    };
}
