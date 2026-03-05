import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { getDailyMemory, saveRecording, getPinnedThought, clearPinnedThought } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';
import { Flame } from 'lucide-react-native';

import AppHeader from '../components/AppHeader';
import Logo from '../components/Logo';
import RecordButton from '../components/RecordButton';
import TitleModal from '../components/TitleModal';
import Footer from '../components/Footer';
import PinnedThought from '../components/PinnedThought';

export default function RecordScreen({ session, onGoToHistory, onOpenSettings }) {
    const { isRecording, duration, startRecording, stopRecording, formatDuration } = useAudioRecorder();
    const [dailyMemory, setDailyMemory] = useState(null);
    const [isMemoryLoading, setIsMemoryLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // --- État pour la modale de titre ---
    const [showTitleModal, setShowTitleModal] = useState(false);
    const [pendingRecording, setPendingRecording] = useState(null);
    const [recordingMode, setRecordingMode] = useState('note'); // 'note' | 'message'

    // --- Pensée épinglée ---
    const [pinnedThought, setPinnedThoughtState] = useState(null);
    const [recordingParentId, setRecordingParentId] = useState(null);

    const audioPlayer = useAudioPlayer();
    const { showAlert } = useAlert();

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

    // Charger la pensée épinglée
    useEffect(() => {
        getPinnedThought().then(setPinnedThoughtState);
    }, []);

    // --- ÉTAPE 1 : RecordButton a fini → on ouvre la modale ---
    const handleRecordingComplete = (uri, recordedDuration) => {
        const recordingId = Date.now().toString();
        const defaultTitle = `Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        setPendingRecording({ uri, duration: recordedDuration, id: recordingId, defaultTitle, parentId: recordingParentId });
        setShowTitleModal(true);
        setRecordingParentId(null);
    };

    // --- Long press sur la pensée épinglée → enregistrer un enfant ---
    const handlePinnedLongPress = () => {
        if (pinnedThought) {
            setRecordingParentId(pinnedThought.id);
            setRecordingMode('note');
            startRecording();
        }
    };

    const handleUnpin = async () => {
        await clearPinnedThought();
        setPinnedThoughtState(null);
    };

    // --- ÉTAPE 2 : L'user a confirmé le titre → on sauvegarde tout ---
    const handleTitleConfirm = async (title, type = 'note', deliverDate = null, tags = []) => {
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
            type: type,
            deliverDate: deliverDate,
            tags: tags,
            parentId: pendingRecording.parentId || null,
        };

        await saveRecording(newRecording);

        if (session?.user) {
            setIsUploading(true);
            try {
                const publicUrl = await uploadRecordingToCloud(recordingId, uri, session.user.id);
                if (publicUrl) {
                    await saveRecordingToDatabase(session.user.id, title, publicUrl, recDuration, type, deliverDate, tags, newRecording.parentId);
                    showAlert("Succès", type === 'message' ? "Message envoyé à ton futur toi !" : newRecording.parentId ? "Pensée connectée et synchronisée !" : "Note enregistrée et synchronisée !", "success");
                } else {
                    showAlert("Attention", "Sauvegardée localement, mais l'upload a échoué.", "warning");
                }
            } catch (error) {
                console.error("Upload failed", error);
                showAlert("Erreur", "L'upload a échoué, mais sauvegardée localement.", "error");
            } finally {
                setIsUploading(false);
            }
        } else {
            showAlert("Sauvegardé", "Note enregistrée localement.", "success");
        }

        setPendingRecording(null);
    };

    const handleTitleCancel = () => {
        setShowTitleModal(false);
        setPendingRecording(null);
    };

    // Format de la date (ex: "5 mars", sans l'année pour alléger)
    const formattedDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    // Composant titre personnalisé avec Date et Flamme sur une seule ligne
    const CustomHeaderTitle = (
        <View style={styles.headerTitleContainer}>
            <View style={styles.streakHeader}>
                <Flame size={14} color="#D97706" strokeWidth={2.5} />
                <Text style={styles.streakHeaderText}>12</Text>
            </View>
            <Text style={styles.headerDot}>•</Text>
            <Text style={styles.headerDate}>{capitalizedDate}</Text>
        </View>
    );

    // Icône Historique personnalisée avec la graine et le badge numéroté
    // Couleur marron (#78350F) pour équilibrer avec le menu hamburger à gauche
    const HistoryButton = (
        <TouchableOpacity onPress={onGoToHistory} style={styles.historyButton}>
            <Logo size={28} color="#78350F" variant="outline" />
            {dailyMemory && !isMemoryLoading && (
                <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>1</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <AppHeader
                title={CustomHeaderTitle}
                showLogo={false}
                rightContent={HistoryButton}
                onOpenSettings={onOpenSettings}
            />

            <View style={styles.mainContent}>
                {pinnedThought ? (
                    <PinnedThought
                        thought={pinnedThought}
                        onLongPress={handlePinnedLongPress}
                        onUnpin={handleUnpin}
                        isRecording={isRecording && recordingParentId != null}
                    />
                ) : (
                    <View />
                )}

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
                            onModeChange={setRecordingMode}
                        />
                    )}
                </View>

                <Footer session={session} isRecording={isRecording} />
            </View>

            {/* Modale de titre après enregistrement */}
            <TitleModal
                visible={showTitleModal}
                defaultTitle={pendingRecording?.defaultTitle || ''}
                initialMode={recordingMode}
                recordingDuration={pendingRecording?.duration || 0}
                onConfirm={handleTitleConfirm}
                onCancel={handleTitleCancel}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FAF7F2', width: '100%' },
    mainContent: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    zone2Container: { alignItems: 'center', width: '100%' },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    headerDate: { fontSize: 16, fontWeight: '600', color: '#78350F' },
    headerDot: { fontSize: 16, color: '#D4A574', fontWeight: 'bold' },
    streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    streakHeaderText: { fontSize: 13, fontWeight: '800', color: '#D97706' },
    historyButton: { padding: 4, position: 'relative', top: -2 }, // top -2 to perfectly center visually
    historyBadge: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FAF7F2' },
    historyBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', textAlign: 'center', lineHeight: 10 },
});
