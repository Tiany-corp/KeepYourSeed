import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Mic, Square } from 'lucide-react-native';

/**
 * Bouton d'enregistrement simplifié.
 * 
 * Responsabilité UNIQUE : démarrer / arrêter l'enregistrement.
 * Quand l'user arrête, il appelle onRecordingComplete(uri, duration)
 * et c'est le PARENT (RecordScreen) qui gère la suite (modale titre, sauvegarde, upload).
 */
export default function RecordButton({
    isRecording,
    duration,
    formatDuration,
    startRecording,
    stopRecording,
    onRecordingComplete, // 🆕 callback vers le parent
}) {
    const handlePress = async () => {
        if (isRecording) {
            // 1. Arrête l'enregistrement → récupère l'URI du fichier audio local
            const uri = await stopRecording();
            if (uri) {
                // 2. Passe la main au parent avec les infos brutes
                onRecordingComplete(uri, duration);
            }
        } else {
            // Démarre l'enregistrement
            startRecording();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.timerContainer}>
                <Text style={[styles.timerText, { fontVariant: ['tabular-nums'] }]}>
                    {formatDuration(duration)}
                </Text>
                {isRecording && (
                    <View style={styles.recordingIndicatorRow}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>Enregistrement...</Text>
                    </View>
                )}
            </View>

            <View style={styles.actionButtonContainer}>
                <TouchableOpacity
                    onPress={handlePress}
                    style={[styles.actionButton, { backgroundColor: isRecording ? '#B91C1C' : '#78350F' }]}
                >
                    {isRecording ? (
                        <Square size={18} color="#FFFFFF" strokeWidth={1.5} />
                    ) : (
                        <Mic size={18} color="#FFFFFF" strokeWidth={1.5} />
                    )}
                    <Text style={styles.actionButtonText}>
                        {isRecording ? "Arrêter" : "Capturer une pensée"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', width: '100%' },
    timerContainer: { marginBottom: 40, alignItems: 'center' },
    timerText: { fontSize: 60, fontWeight: '200', color: '#292524' },
    recordingIndicatorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B91C1C' },
    recordingText: { color: '#B91C1C', fontSize: 14, fontWeight: '500' },
    actionButtonContainer: { width: '100%', maxWidth: 300 },
    actionButton: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    actionButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 }
});
