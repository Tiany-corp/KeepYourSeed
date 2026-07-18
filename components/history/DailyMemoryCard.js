import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import AnimatedPlayButton from '../AnimatedPlayButton';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
} from 'react-native-reanimated';
import Logo from '../Logo';
import { formatDateWithTime } from '../../utils/date';

/**
 * Carte spéciale pour le "souvenir du jour" affichée en haut de l'historique.
 * Glow orange pulsant tant que le souvenir n'a pas été ouvert.
 */
const DailyMemoryCard = memo(({ dailyMemory, isOpened, isPlaying, onTogglePlay, isLoading }) => {
    const pulse = useSharedValue(0);
    const scale = useSharedValue(1);

    const animatedScaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 40, stiffness: 400, mass: 0.5, overshootClamping: true });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 40, stiffness: 400, mass: 0.5, overshootClamping: true });
    };

    useEffect(() => {
        if (!isOpened) {
            pulse.value = 0;
            pulse.value = withRepeat(
                withTiming(1, { duration: 1200 }),
                -1,
                true
            );
        } else {
            pulse.value = withTiming(0, { duration: 300 });
        }
    }, [isOpened]);

    // Couche de glow : on anime uniquement l'opacity (fiable sur toutes les plateformes)
    const glowStyle = useAnimatedStyle(() => ({
        opacity: pulse.value,
    }));

    if (!dailyMemory) return null;

    return (
        <Animated.View style={[styles.dailyMemorySection, animatedScaleStyle]}>
            <Pressable
                onPress={onTogglePlay}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.pressable}
            >
                <View style={styles.cardWrapper}>
                    {/* Couche de glow derrière la carte — visible uniquement si non ouvert */}
                    {!isOpened && (
                        <Animated.View style={[
                            styles.glowLayer, 
                            dailyMemory.type === 'message' && styles.glowLayerMessage,
                            glowStyle
                        ]} />
                    )}
                    {/* Carte elle-même */}
                    <View style={[
                        styles.dailyMemoryCard,
                        !isOpened && styles.dailyMemoryCardUnseen,
                        dailyMemory.type === 'message' && !isOpened && styles.dailyMemoryCardMessageUnseen
                    ]}>
                        <Logo 
                            size={36} 
                            color={dailyMemory.type === 'message' ? '#B91C1C' : '#D97706'} 
                            variant="outline" 
                            style={styles.dailyMemoryLogo} 
                        />
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemTitle}>{dailyMemory.title || 'Un souvenir t\'attend'}</Text>
                            <Text style={styles.itemDate}>{formatDateWithTime(dailyMemory.date)}</Text>
                        </View>
                        <View style={[styles.playButtonIcon, (isPlaying || isLoading) && styles.playButtonIconActive]}>
                            <AnimatedPlayButton
                                key={dailyMemory.id}
                                isPlaying={isPlaying || isLoading}
                                size={18}
                                color="#FFFFFF"
                                strokeWidth={1.5}
                            />
                        </View>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    dailyMemorySection: {
        marginBottom: 13,
    },
    pressable: {
        borderRadius: 16,
    },
    dailyMemoryHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#D97706',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    cardWrapper: {
        position: 'relative',
    },
    glowLayer: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 20,
        backgroundColor: 'rgba(245, 158, 11, 0.4)', // Halo orange
        // Optionnel : on garde une petite ombre pour iOS/Web si supporté
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 4,
    },
    glowLayerMessage: {
        backgroundColor: 'rgba(185, 28, 28, 0.3)', // Halo rouge
        shadowColor: '#B91C1C',
    },
    dailyMemoryCard: {
        backgroundColor: '#F5EADB',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8D5BF',
        shadowColor: '#78350F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    dailyMemoryCardUnseen: {
        borderColor: '#F59E0B',
        borderWidth: 1.5,
    },
    dailyMemoryCardMessageUnseen: {
        borderColor: '#B91C1C', // Bordure rouge pour les messages
        borderWidth: 2,
    },
    dailyMemoryHeaderTitleMessage: {
        color: '#B91C1C', // Titre rouge pour les messages
    },
    dailyMemoryLogo: {
        marginRight: 16,
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 2,
    },
    itemDate: {
        fontSize: 12,
        color: '#78716C',
    },
    playButtonIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#78350F',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 0,
    },
    playButtonIconActive: {
        backgroundColor: '#B91C1C',
    },
});

export default DailyMemoryCard;
