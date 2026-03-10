import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Flame } from 'lucide-react-native';

export default function Footer({ session, isRecording, streakCount = 0 }) {
    if (isRecording) {
        return <View />;
    }

    return (
        <View style={styles.footerContainer}>
            <View style={styles.footerRow}>
                <View style={styles.streakBadge}>
                    <Flame size={16} color="#D97706" strokeWidth={2.5} />
                    <Text style={styles.streakNumber}>{streakCount} streak</Text>
                </View>
                <Text style={styles.footerText}>Continue comme ça !</Text>
            </View>
            {session?.user && (
                <Text style={styles.footerEmail}>{session.user.email}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    footerContainer: { width: '100%', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#D4A574', paddingTop: 12 },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    streakNumber: { fontSize: 13, fontWeight: '600', color: '#D97706' },
    footerText: { fontSize: 13, color: '#78716C' },
    footerEmail: { fontSize: 12, color: '#78716C', marginTop: 4 }
});
