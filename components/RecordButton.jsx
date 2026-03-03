import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { saveRecording } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';

export default function RecordButton({
    session,
    isRecording,
    duration,
    formatDuration,
    startRecording,
    stopRecording
}) {
    const [isUploading, setIsUploading] = useState(false);

    const handlePress = async () => {
        if (isRecording) {
            const uri = await stopRecording();
            if (uri) {
                const recordingId = Date.now().toString();
                const recordingTitle = `Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                const newRecording = {
                    id: recordingId,
                    localUri: uri,
                    remoteUrl: null,
                    status: 'pending',
                    date: new Date().toISOString(),
                    duration: duration,
                    title: recordingTitle,
                };

                await saveRecording(newRecording);

                if (session?.user) {
                    setIsUploading(true);
                    try {
                        const publicUrl = await uploadRecordingToCloud(recordingId, uri, session.user.id);
                        if (publicUrl) {
                            await saveRecordingToDatabase(
                                session.user.id,
                                recordingTitle,
                                publicUrl,
                                duration
                            );
                            Alert.alert("Succès", "Note enregistrée et synchronisée !");
                        } else {
                            Alert.alert("Attention", "Note sauvegardée localement, mais l'upload a échoué.");
                        }
                    } catch (error) {
                        console.error("Upload failed", error);
                        Alert.alert("Erreur", "L'upload a échoué, mais la note est sauvegardée localement.");
                    } finally {
                        setIsUploading(false);
                    }
                } else {
                    Alert.alert("Sauvegardé", "Note enregistrée localement.");
                }
            }
        } else {
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
                {isUploading ? (
                    <ActivityIndicator size="large" color="#78350F" />
                ) : (
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
    actionButtonContainer: { width: '100%', maxWidth: 300 },
    actionButton: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    actionButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 }
});
