import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Platform, Pressable, ActivityIndicator } from 'react-native';
import { Lock, Play } from 'lucide-react-native';
import { getRelativeDate } from '../utils/date';

export default function MemoryCard({ dailyMemory, isMemoryLoading, revealProps, onOpenPlayer }) {
    const { isRevealed, isPressing, progressAnim, revealOpacity, onPressIn, onPressOut } = revealProps;

    if (isMemoryLoading) {
        return <ActivityIndicator size="small" color="#78350F" style={styles.loader} />;
    }

    if (!dailyMemory) {
        return (
            <Text style={styles.emptyMemoryText}>
                Enregistre des notes pour débloquer des souvenirs
            </Text>
        );
    }

    if (isRevealed) {
        const relDate = getRelativeDate(dailyMemory.date);
        return (
            <Animated.View style={{ opacity: revealOpacity }}>
                <TouchableOpacity onPress={onOpenPlayer} activeOpacity={0.7}>
                    <View style={styles.memoryRow}>
                        <View style={styles.memoryTextContainer}>
                            <Text style={styles.memoryDateText}>{relDate}</Text>
                            <Text style={styles.memoryTitleText} numberOfLines={1}>{dailyMemory.title}</Text>
                        </View>
                        <View style={[styles.playButtonIcon, { backgroundColor: '#78350F' }]}>
                            <Play size={20} color="#FFFFFF" strokeWidth={1.5} />
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    }

    const relativeDate = getRelativeDate(dailyMemory.date);
    return (
        <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            pressRetentionOffset={{ top: 200, left: 200, right: 200, bottom: 200 }}
            style={{ cursor: 'pointer' }}
        >
            <View style={styles.lockedMemoryRow}>
                <Lock size={24} color={isPressing ? '#78350F' : '#D97706'} strokeWidth={1.5} />
                <View style={styles.memoryTextContainer}>
                    <Text style={styles.lockedMemoryTitle} numberOfLines={1}>
                        {relativeDate}, tu pensais à...
                    </Text>
                    <Text style={styles.lockedMemoryHelper}>
                        {Platform.OS === 'web' ? 'Clique et maintiens pour écouter' : 'Maintiens pour écouter'}
                    </Text>
                </View>
            </View>

            <View style={styles.progressBarTrack}>
                <Animated.View
                    style={[styles.progressBarFill, {
                        width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                        }),
                    }]}
                />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    loader: { marginVertical: 16 },
    emptyMemoryText: { fontSize: 14, color: '#78716C', fontStyle: 'italic', paddingVertical: 16, textAlign: 'center' },
    memoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    memoryTextContainer: { flex: 1 },
    memoryDateText: { fontSize: 12, color: '#D97706', fontWeight: '500', marginBottom: 2 },
    memoryTitleText: { fontSize: 16, fontWeight: '600', color: '#292524' },
    playButtonIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    lockedMemoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    lockedMemoryTitle: { fontSize: 14, color: '#292524', fontWeight: '500' },
    lockedMemoryHelper: { fontSize: 12, color: '#78716C', marginTop: 2 },
    progressBarTrack: { width: '100%', height: 4, borderRadius: 9999, backgroundColor: '#F5F0E8' },
    progressBarFill: { height: '100%', borderRadius: 9999, backgroundColor: '#D97706' }
});
