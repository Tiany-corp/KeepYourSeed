import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Mic, Square, Mail } from 'lucide-react-native';

/**
 * Bouton d'enregistrement avec deux modes : Note classique ou Message au futur.
 * 
 * Quand pas en train d'enregistrer → affiche 2 boutons côte à côte.
 * Quand en train d'enregistrer → affiche le bouton Stop.
 * Quand l'user arrête, il appelle onRecordingComplete(uri, duration)
 * et c'est le PARENT (RecordScreen) qui gère la suite.
 */
export default function RecordButton({
    isRecording,
    duration,
    formatDuration,
    startRecording,
    stopRecording,
    onRecordingComplete,
    onModeChange,        // callback pour informer le parent du mode choisi
}) {
    const handleStop = async () => {
        const uri = await stopRecording();
        if (uri) {
            onRecordingComplete(uri, duration);
        }
    };

    const handleStart = (mode) => {
        if (onModeChange) onModeChange(mode);
        startRecording();
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
                {isRecording ? (
                    <TouchableOpacity
                        onPress={handleStop}
                        style={[styles.actionButton, styles.stopButton]}
                    >
                        <Square size={18} color="#FFFFFF" strokeWidth={1.5} />
                        <Text style={styles.actionButtonText}>Arrêter</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.buttonsColumn}>
                        <TouchableOpacity
                            onPress={() => handleStart('note')}
                            style={[styles.actionButton, styles.mainButton]}
                        >
                            <Mic size={20} color="#FFFFFF" strokeWidth={1.5} />
                            <Text style={styles.mainButtonText}>Capturer une pensée</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleStart('message')}
                            style={styles.secondaryButton}
                        >
                            <Mail size={16} color="#78716C" strokeWidth={1.5} />
                            <Text style={styles.secondaryButtonText}>S'envoyer un message au futur</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
    actionButtonContainer: { width: '100%', maxWidth: 320, alignItems: 'center' },
    buttonsColumn: { width: '100%', alignItems: 'center' },
    actionButton: { width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
    mainButton: { backgroundColor: '#78350F', shadowColor: '#78350F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    mainButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 17 },
    secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 8, paddingHorizontal: 16 },
    secondaryButtonText: { color: '#78716C', fontSize: 14, fontWeight: '500' },
    stopButton: { backgroundColor: '#B91C1C' },
    actionButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 17 },
});
