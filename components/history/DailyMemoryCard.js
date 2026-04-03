import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import Logo from '../Logo';
import { formatDateWithTime } from '../../utils/date';

/**
 * Carte spéciale pour le "souvenir du jour" affichée en haut de l'historique.
 */
const DailyMemoryCard = ({ dailyMemory, isPlaying, onTogglePlay }) => {
    if (!dailyMemory) return null;

    return (
        <View style={styles.dailyMemorySection}>
            <Text style={styles.dailyMemoryHeaderTitle}>Pensée souvenir ⏳</Text>
            <TouchableOpacity 
                style={styles.dailyMemoryCard} 
                onPress={onTogglePlay}
            >
                <Logo size={28} color="#D97706" variant="outline" style={styles.dailyMemoryLogo} />
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{dailyMemory.title || 'Un souvenir t\'attend'}</Text>
                    <Text style={styles.itemDate}>{formatDateWithTime(dailyMemory.date)}</Text>
                </View>
                <View style={[styles.playButtonIcon, isPlaying && styles.playButtonIconActive]}>
                    {isPlaying ? (
                        <Pause size={18} color="#FFFFFF" strokeWidth={1.5} />
                    ) : (
                        <Play size={18} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 3 }} />
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    dailyMemorySection: {
        marginBottom: 13,
    },
    dailyMemoryHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#D97706',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
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
        marginRight: 0, // No margin needed in this layout
    },
    playButtonIconActive: {
        backgroundColor: '#B91C1C',
    },
});

export default DailyMemoryCard;
