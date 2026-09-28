import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Leaf, Play, HeartPlus, Apple } from 'lucide-react-native';
import { formatDateWithTime } from '../../utils/date';
import Logo from '../Logo';

export default function TreeCard({ tree, leaves, onPress, onPlay }) {
    const allChildren = leaves || [];
    const rootsCount = allChildren.filter(c => c.graftType === 'root').length;
    const fruitsCount = allChildren.filter(c => c.graftType === 'fruit').length;
    const leafCount = allChildren.filter(c => !c.graftType || c.graftType === 'leaf').length;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.headerRow}>
                <Logo size={20} color="#15803d" variant="outline" />
                <View style={styles.badgesContainer}>
                    {rootsCount > 0 && (
                        <View style={[styles.badge, styles.rootBadge]}>
                            <HeartPlus size={10} color="#78350F" />
                            <Text style={[styles.badgeText, { color: '#78350F' }]}>{rootsCount}</Text>
                        </View>
                    )}
                    {leafCount > 0 && (
                        <View style={[styles.badge, styles.leafBadge]}>
                            <Leaf size={10} color="#15803d" />
                            <Text style={[styles.badgeText, { color: '#15803d' }]}>{leafCount}</Text>
                        </View>
                    )}
                    {fruitsCount > 0 && (
                        <View style={[styles.badge, styles.fruitBadge]}>
                            <Apple size={10} color="#DC2626" />
                            <Text style={[styles.badgeText, { color: '#DC2626' }]}>{fruitsCount}</Text>
                        </View>
                    )}
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
    badgesContainer: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-end',
        gap: 2,
        flex: 1,
        paddingLeft: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    rootBadge: {
        backgroundColor: '#FDE68A',
    },
    leafBadge: {
        backgroundColor: '#dcfce7',
    },
    fruitBadge: {
        backgroundColor: '#FEE2E2',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
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
