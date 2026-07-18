import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Share2, Play } from 'lucide-react-native';
import { formatDateWithTime } from '../../utils/date';
import Logo from '../Logo';

export default function TreeCard({ tree, leaves, onPress, onPlay }) {
    const leafCount = leaves ? leaves.length : 0;
    
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.headerRow}>
                <Logo size={24} color="#15803d" variant="outline" />
                <View style={styles.leafBadge}>
                    <Share2 size={12} color="#15803d" style={{ transform: [{ rotate: '90deg' }] }} />
                    <Text style={styles.leafText}>{leafCount}</Text>
                </View>
            </View>
            
            <View style={styles.infoContainer}>
                <Text style={styles.title} numberOfLines={2}>
                    {tree.title || 'Arbre sans nom'}
                </Text>
                <Text style={styles.date}>{formatDateWithTime(tree.date)}</Text>
            </View>
            
            <TouchableOpacity style={styles.playButton} onPress={onPlay}>
                <Play size={16} color="#15803d" fill="#15803d" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#F5F0E8',
        borderRadius: 16,
        padding: 16,
        flex: 1,
        margin: 8,
        borderWidth: 1,
        borderColor: '#D4A574',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        minHeight: 140,
        justifyContent: 'space-between',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    leafBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    leafText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#15803d',
    },
    infoContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#292524',
        marginBottom: 4,
        lineHeight: 20,
    },
    date: {
        fontSize: 12,
        color: '#A8A29E',
    },
    playButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
    }
});
