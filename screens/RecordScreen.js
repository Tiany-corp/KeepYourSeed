import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AppContext } from '../contexts/AppContext';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { getDailyMemory, saveRecording, getPinnedThought, clearPinnedThought, getCurrentStreak, getSeenDailyMemoryId, setSeenDailyMemoryId } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { pushOnly } from '../services/sync';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';
import { Flame } from 'lucide-react-native';

import AppHeader from '../components/AppHeader';
import Logo from '../components/Logo';
import RecordButton from '../components/RecordButton';
import TitleModal from '../components/TitleModal';
import Footer from '../components/Footer';
import PinnedThought from '../components/PinnedThought';

export default function RecordScreen() {
    const { session, setDrawerOpen } = useContext(AppContext);
    const navigation = useNavigation();
    
    const { isRecording, duration, startRecording, stopRecording, formatDuration } = useAudioRecorder();
    const [dailyMemory, setDailyMemory] = useState(null);
    const [isMemoryLoading, setIsMemoryLoading] = useState(true);
    const [hasUnseenMemory, setHasUnseenMemory] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // --- État pour la modale de titre ---
    const [showTitleModal, setShowTitleModal] = useState(false);
    const [pendingRecording, setPendingRecording] = useState(null);
    const [recordingMode, setRecordingMode] = useState('note'); // 'note' | 'message'
    const [streakCount, setStreakCount] = useState(0);

    // --- Pensée épinglée ---
    const [pinnedThought, setPinnedThoughtState] = useState(null);
    const [recordingParentId, setRecordingParentId] = useState(null);

    const audioPlayer = useAudioPlayer();
    const { showAlert } = useAlert();
    const isFetchingMemory = useRef(false);

    useEffect(() => {
        if (session?.user && !isFetchingMemory.current) {
            isFetchingMemory.current = true;
            setIsMemoryLoading(true);
            getDailyMemory(session.user.id).then(memory => {
                setDailyMemory(memory);
                setIsMemoryLoading(false);
                isFetchingMemory.current = false;
            }).catch(() => {
                setIsMemoryLoading(false);
                isFetchingMemory.current = false;
            });
        } else if (!session?.user) {
            setIsMemoryLoading(false);
        }

        // Charger la streak actuelle
        getCurrentStreak().then(setStreakCount);
    }, [session]);

    useEffect(() => {
        let cancelled = false;
        const syncSeenState = async () => {
            if (!dailyMemory?.id) {
                if (!cancelled) setHasUnseenMemory(false);
                return;
            }
            const seenId = await getSeenDailyMemoryId(session?.user?.id);
            if (!cancelled) {
                // Un message est considéré non vu si seenId est vide OU s'il ne correspond pas à la pensée actuelle
                const isUnseen = !seenId || String(seenId) !== String(dailyMemory.id);
                setHasUnseenMemory(isUnseen);
            }
        };
        syncSeenState();
        return () => {
            cancelled = true;
        };
    }, [dailyMemory?.id, session?.user?.id]);

    // Re-charger la pensée épinglée et les infos clés à chaque retour sur l'écran
    useFocusEffect(
        useCallback(() => {
            getPinnedThought().then(setPinnedThoughtState);
            getCurrentStreak().then(setStreakCount);
            
            if (session?.user && !isFetchingMemory.current) {
                isFetchingMemory.current = true;
                getDailyMemory(session.user.id).then(async (memory) => {
                    setDailyMemory(memory);
                    isFetchingMemory.current = false;
                    
                    // Rafraîchir aussi le statut "vu" pour le badge
                    if (memory) {
                        const seenId = await getSeenDailyMemoryId(session.user.id);
                        setHasUnseenMemory(!seenId || String(seenId) !== String(memory.id));
                    }
                }).catch(() => {
                    isFetchingMemory.current = false;
                });
            }
        }, [session?.user])
    );

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

        const timestamp = new Date().toISOString();
        const newRecording = {
            id: recordingId,
            localUri: uri,
            remoteUrl: null,
            status: 'pending',
            date: timestamp,
            updatedAt: timestamp,
            duration: recDuration,
            title: title,
            type: type,
            deliverDate: deliverDate,
            tags: tags,
            parentId: pendingRecording.parentId || null,
        };

        await saveRecording(newRecording);

        // Mettre à jour la streak dynamiquement après un nouvel enregistrement
        getCurrentStreak().then(setStreakCount);

        // Push silencieux en arrière-plan (pas de pull, pas de blocage UI)
        if (session?.user) {
            pushOnly(session.user.id).catch(() => {});
        }

        showAlert("Sauvegardé", "Ta pensée a été enregistrée.", "success");

        setPendingRecording(null);
    };

    const handleTitleCancel = () => {
        setShowTitleModal(false);
        setPendingRecording(null);
    };

    const handleGoToHistory = () => {
        navigation.navigate('History');
    };

    // Format de la date (ex: "5 mars", sans l'année pour alléger)
    const formattedDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    // Composant titre personnalisé : Juste la Date élégante au centre
    const CustomHeaderTitle = (
        <View style={styles.headerTitleContainer}>
            <Text style={styles.pageTitle}>Aujourd'hui, {capitalizedDate}</Text>
        </View>
    );

    // Icône Historique personnalisée avec la graine et le badge numéroté
    // Couleur marron (#78350F) pour équilibrer avec le menu hamburger à gauche
    const HistoryButton = (
        <TouchableOpacity onPress={handleGoToHistory} style={styles.historyButton}>
            <Logo size={28} color="#78350F" variant="outline" />
            {hasUnseenMemory && !isMemoryLoading && (
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
                onOpenSettings={() => setDrawerOpen(true)}
            />

            <View style={styles.mainContent}>
                {/* Le titre est reparti dans le header ! */}
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

                <Footer session={session} isRecording={isRecording} streakCount={streakCount} />
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
    headerTitleContainer: { alignItems: 'center', justifyContent: 'center' },
    pageTitle: { fontSize: 20, fontWeight: '700', color: '#78350F', letterSpacing: -0.5 },
    // Header History Styles
    historyButton: { padding: 4, position: 'relative', top: -2 }, // top -2 to perfectly center visually
    historyBadge: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FAF7F2' },
    historyBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', textAlign: 'center', lineHeight: 10 },
});
