import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate
} from 'react-native-reanimated';

/**
 * Composant de bouton de lecture avec transition organique (Spring Morph).
 * Les icônes Play et Pause se superposent et on anime leur opacité et échelle
 * en temps réel pour une impression d'instantanéité.
 */
export default function AnimatedPlayButton({ isPlaying, size = 18, color = "#FFFFFF", fill = "none", strokeWidth = 1.5, style }) {
    // 0 = Play visible, 1 = Pause visible
    const progress = useSharedValue(isPlaying ? 1 : 0);

    useEffect(() => {
        progress.value = withSpring(isPlaying ? 1 : 0, {
            damping: 15,
            stiffness: 150,
            mass: 0.5
        });
    }, [isPlaying]);

    // Style pour l'icône PLAY (visible quand progress = 0)
    const playStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0, 0]),
            transform: [
                { scale: interpolate(progress.value, [0, 1], [1, 0.5]) }
            ]
        };
    });

    // Style pour l'icône PAUSE (visible quand progress = 1)
    const pauseStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]),
            transform: [
                { scale: interpolate(progress.value, [0, 1], [0.5, 1]) }
            ]
        };
    });

    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            {/* L'icône Play a naturellement besoin d'un micro-décalage visuel vers la droite */}
            <Animated.View style={[styles.iconWrapper, playStyle]}>
                <Play size={size} color={color} strokeWidth={strokeWidth} fill={fill} style={{ marginLeft: size * 0.15 }} />
            </Animated.View>
            <Animated.View style={[styles.iconWrapper, pauseStyle]}>
                <Pause size={size} color={color} strokeWidth={strokeWidth} fill={fill} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    }
});
