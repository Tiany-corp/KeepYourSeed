import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Flame } from 'lucide-react-native';

export default function Footer({ session, isRecording }) {
    if (isRecording) {
        return <View />;
    }

    return (
        <View style={styles.footerContainer}>
            <View style={styles.footerRow}>
                <Flame size={16} color="#D97706" strokeWidth={1.5} />
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
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerText: { fontSize: 14, color: '#78716C' },
    footerEmail: { fontSize: 12, color: '#78716C', marginTop: 4 }
});
