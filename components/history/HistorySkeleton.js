import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';

/**
 * Squelette de chargement avec animation fluide (Pulse).
 * Utilisé pour améliorer la perception du chargement dans HistoryScreen.
 */
const HistorySkeleton = () => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={styles.itemContainer}>
            <Animated.View style={[styles.item, styles.skeletonItem, animatedStyle]}>
                <View style={styles.skeletonPlayIcon} />
                <View style={[styles.itemInfo, { gap: 8 }]}>
                    <View style={styles.skeletonTitle} />
                    <View style={styles.skeletonDate} />
                    <View style={styles.tagsRow}>
                        <View style={styles.skeletonTag} />
                        <View style={styles.skeletonTag} />
                    </View>
                </View>
            </Animated.View>
            <View style={{ width: 40 }} />
        </View>
    );
};

const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F5F0E8',
        flex: 1,
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    // Styles spécifiques au Skeleton
    skeletonItem: {
        borderColor: '#E8E0D4',
        shadowOpacity: 0,
    },
    skeletonPlayIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E8E0D4',
        marginRight: 12,
    },
    skeletonTitle: {
        height: 16,
        width: '60%',
        backgroundColor: '#E8E0D4',
        borderRadius: 8,
    },
    skeletonDate: {
        height: 12,
        width: '40%',
        backgroundColor: '#E8E0D4',
        borderRadius: 6,
    },
    skeletonTag: {
        height: 18,
        width: 50,
        backgroundColor: '#E8E0D4',
        borderRadius: 9,
    },
});

export default HistorySkeleton;
