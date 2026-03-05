import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Logo from './Logo';

export default function MemoryCard({ dailyMemory, isMemoryLoading, onOpenPlayer }) {
    const [hasBeenOpened, setHasBeenOpened] = useState(false);

    if (isMemoryLoading || !dailyMemory) {
        return null;
    }

    const handlePress = () => {
        setHasBeenOpened(true);
        onOpenPlayer();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={styles.iconButton}
        >
            <View style={styles.logoWrapper}>
                <Logo size={24} color="#D97706" variant="outline" />
            </View>

            {/* Notification badge */}
            {!hasBeenOpened && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>1</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    iconButton: {
        paddingVertical: 6,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoWrapper: {
        // Le dessin du logo dans le SVG est légèrement décalé vers le bas (Y va de 10 à 100), 
        // ce petit décalage le recentre parfaitement.
        transform: [{ translateY: -1 }],
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#D97706',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FAF7F2',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 10,
    },
});
