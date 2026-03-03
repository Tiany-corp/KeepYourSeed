import { useState, useRef, useCallback, useEffect } from 'react';
import { Animated, Platform, Vibration } from 'react-native';

const REVEAL_DURATION = 1500;

export default function useRevealAnimation({ onRevealComplete }) {
    const [isRevealed, setIsRevealed] = useState(false);
    const [isPressing, setIsPressing] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const revealOpacity = useRef(new Animated.Value(0)).current;
    const pressTimerRef = useRef(null);
    const halfwayTriggered = useRef(false);

    useEffect(() => {
        return () => {
            if (pressTimerRef.current) {
                clearTimeout(pressTimerRef.current);
            }
        };
    }, []);

    const triggerVibration = useCallback((type = 'light') => {
        if (Platform.OS === 'web') return;
        try {
            Vibration.vibrate(type === 'heavy' ? 50 : 20);
        } catch (e) {
            // Silently fail if vibration not supported
        }
    }, []);

    const onPressIn = useCallback(() => {
        if (isRevealed) return;
        setIsPressing(true);
        halfwayTriggered.current = false;

        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: REVEAL_DURATION,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                triggerVibration('heavy');
                setIsPressing(false);
                setIsRevealed(true);

                revealOpacity.setValue(0);
                Animated.timing(revealOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }).start();

                if (onRevealComplete) {
                    onRevealComplete();
                }
            }
        });

        pressTimerRef.current = setTimeout(() => {
            if (!halfwayTriggered.current) {
                halfwayTriggered.current = true;
                triggerVibration('light');
            }
        }, REVEAL_DURATION / 2);
    }, [isRevealed, progressAnim, revealOpacity, triggerVibration, onRevealComplete]);

    const onPressOut = useCallback(() => {
        if (isRevealed) return;
        setIsPressing(false);

        progressAnim.stopAnimation();
        Animated.timing(progressAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();

        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    }, [isRevealed, progressAnim]);

    return {
        isRevealed,
        isPressing,
        progressAnim,
        revealOpacity,
        onPressIn,
        onPressOut
    };
}
