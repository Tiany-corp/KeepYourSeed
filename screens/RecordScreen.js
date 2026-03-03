import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useMemoryPlayer from '../hooks/useMemoryPlayer';
import useRevealAnimation from '../hooks/useRevealAnimation';
import { getDailyMemory } from '../services/storage';

import AppHeader from '../components/AppHeader';
import MemoryCard from '../components/MemoryCard';
import RecordButton from '../components/RecordButton';
import Footer from '../components/Footer';
import AudioPlayer from '../components/AudioPlayer';

export default function RecordScreen({ session, onGoToHistory, onOpenSettings }) {
    const { isRecording, duration, startRecording, stopRecording, formatDuration } = useAudioRecorder();
    const [dailyMemory, setDailyMemory] = useState(null);
    const [isMemoryLoading, setIsMemoryLoading] = useState(true);

    const player = useMemoryPlayer(dailyMemory);

    const revealProps = useRevealAnimation({
        onRevealComplete: () => {
            player.setShowPlayer(true);
            player.play();
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
                                onOpenPlayer={() => { player.setShowPlayer(true); player.toggle(); }}
                            />
                        </View>
                    </View>
                )}
                {(isRecording || !session?.user) && <View />}

                <View style={styles.zone2Container}>
                    <RecordButton
                        session={session} isRecording={isRecording} duration={duration}
                        formatDuration={formatDuration} startRecording={startRecording} stopRecording={stopRecording}
                    />
                </View>

                <Footer session={session} isRecording={isRecording} />
            </View>

            <AudioPlayer
                showPlayer={player.showPlayer} isMemoryPlaying={player.isPlaying}
                dailyMemory={dailyMemory} playbackPosition={player.position}
                playbackDuration={player.duration} memorySoundRef={player.soundRef}
                toggleMemoryPlayback={player.toggle} closePlayerModal={player.stop}
                setShowPlayer={player.setShowPlayer} dismissToMiniPlayer={() => player.setShowPlayer(false)}
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
