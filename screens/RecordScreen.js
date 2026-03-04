import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, ActivityIndicator } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useRevealAnimation from '../hooks/useRevealAnimation';
import { getDailyMemory, saveRecording } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';

import AppHeader from '../components/AppHeader';
import MemoryCard from '../components/MemoryCard';
import RecordButton from '../components/RecordButton';
import TitleModal from '../components/TitleModal';
import Footer from '../components/Footer';

export default function RecordScreen({ session, onGoToHistory, onOpenSettings }) {
    const { isRecording, duration, startRecording, stopRecording, formatDuration } = useAudioRecorder();
    const [dailyMemory, setDailyMemory] = useState(null);
    const [isMemoryLoading, setIsMemoryLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // --- État pour la modale de titre ---
    const [showTitleModal, setShowTitleModal] = useState(false);
    const [pendingRecording, setPendingRecording] = useState(null);

    const audioPlayer = useAudioPlayer();
    const { showAlert } = useAlert();

    const revealProps = useRevealAnimation({
        onRevealComplete: () => {
            if (dailyMemory) {
                audioPlayer.play(dailyMemory);
                audioPlayer.openModal(); // Ouvre la modale fullscreen après le reveal
            }
        }
    });

    useEffect(() => {
        if (session?.user) {
            setIsMemoryLoading(true);
            getDailyMemory(session.user.id).then(memory => {
                setDailyMemory(memory);
                setIsMemoryLoading(false);
            });
        } else {
            setIsMemoryLoading(false);
        }
    }, [session]);

    // --- ÉTAPE 1 : RecordButton a fini → on ouvre la modale ---
    const handleRecordingComplete = (uri, recordedDuration) => {
        const recordingId = Date.now().toString();
        const defaultTitle = `Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        setPendingRecording({ uri, duration: recordedDuration, id: recordingId, defaultTitle });
        setShowTitleModal(true);
    };

    // --- ÉTAPE 2 : L'user a confirmé le titre → on sauvegarde tout ---
    const handleTitleConfirm = async (title) => {
        setShowTitleModal(false);
        if (!pendingRecording) return;

        const { uri, duration: recDuration, id: recordingId } = pendingRecording;

        const newRecording = {
            id: recordingId,
            localUri: uri,
            remoteUrl: null,
            status: 'pending',
            date: new Date().toISOString(),
            duration: recDuration,
            title: title,
        };

        await saveRecording(newRecording);

        if (session?.user) {
            setIsUploading(true);
            try {
                const publicUrl = await uploadRecordingToCloud(recordingId, uri, session.user.id);
                if (publicUrl) {
                    await saveRecordingToDatabase(session.user.id, title, publicUrl, recDuration);
                    showAlert("Succès", "Note enregistrée et synchronisée !", "success");
                } else {
                    showAlert("Attention", "Note sauvegardée localement, mais l'upload a échoué.", "warning");
                }
            } catch (error) {
                console.error("Upload failed", error);
                showAlert("Erreur", "L'upload a échoué, mais la note est sauvegardée localement.", "error");
            } finally {
                setIsUploading(false);
            }
        } else {
            showAlert("Sauvegardé", "Note enregistrée localement.", "success");
        }

        setPendingRecording(null);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <AppHeader onOpenSettings={onOpenSettings} onGoToHistory={onGoToHistory} />

            <View style={styles.mainContent}>
                {!isRecording && session?.user && (
                    <View style={styles.zone1Container}>
                        <View style={styles.memoryCardWrapper}>
                            <MemoryCard
                                dailyMemory={dailyMemory}
                                isMemoryLoading={isMemoryLoading}
                                revealProps={revealProps}
                                onOpenPlayer={() => audioPlayer.toggle(dailyMemory)}
                            />
                        </View>
                    </View>
                )}
                {(isRecording || !session?.user) && <View />}

                <View style={styles.zone2Container}>
                    {isUploading ? (
                        <ActivityIndicator size="large" color="#78350F" />
                    ) : (
                        <RecordButton
                            isRecording={isRecording}
                            duration={duration}
                            formatDuration={formatDuration}
                            startRecording={startRecording}
                            stopRecording={stopRecording}
                            onRecordingComplete={handleRecordingComplete}
                        />
                    )}
                </View>

                <Footer session={session} isRecording={isRecording} />
            </View>

            {/* Modale de titre après enregistrement */}
            <TitleModal
                visible={showTitleModal}
                defaultTitle={pendingRecording?.defaultTitle || ''}
                onConfirm={handleTitleConfirm}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FAF7F2', width: '100%' },
    mainContent: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    zone1Container: { width: '100%', alignItems: 'center' },
    memoryCardWrapper: { width: '100%', maxWidth: 350, backgroundColor: '#F5F0E8', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#D4A574' },
    zone2Container: { alignItems: 'center', width: '100%' }
});
