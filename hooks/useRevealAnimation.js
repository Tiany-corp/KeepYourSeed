import { useState, useRef } from 'react';
import { Animated } from 'react-native';

const HOLD_DURATION = 1500; // ms to hold before reveal

export default function useRevealAnimation({ onRevealComplete }) {
    const [isRevealed, setIsRevealed] = useState(false);
    const [isPressing, setIsPressing] = useState(false);

    const progressAnim = useRef(new Animated.Value(0)).current;
    const revealOpacity = useRef(new Animated.Value(0)).current;
    const holdTimer = useRef(null);

    const onPressIn = () => {
        setIsPressing(true);
        progressAnim.setValue(0);

        Animated.timing(progressAnim, {
            toValue: 1,
            duration: HOLD_DURATION,
            useNativeDriver: false,
        }).start();

        holdTimer.current = setTimeout(() => {
            setIsRevealed(true);
            setIsPressing(false);

            Animated.timing(revealOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                if (onRevealComplete) onRevealComplete();
            });
        }, HOLD_DURATION);
    };

    const onPressOut = () => {
        setIsPressing(false);

        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }

        if (!isRevealed) {
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
            }).start();
        }
    };

    return {
        isRevealed,
        isPressing,
        progressAnim,
        revealOpacity,
        onPressIn,
        onPressOut,
    };
}
