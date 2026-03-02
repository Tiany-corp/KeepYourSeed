import { View, Text, SafeAreaView, Alert, ActivityIndicator, TouchableOpacity, Animated, Platform, Vibration, Pressable, Modal } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { saveRecording, getDailyMemory, getAudioSource } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Menu, Clock, Mic, Square, Lock, Flame, Play, CircleStop } from 'lucide-react-native';
import AudioPlayer from '../components/AudioPlayer';
import Logo from '../components/Logo';
import { getRelativeDate, formatMemoryDate, formatTime } from '../utils/date';

// Durée du long press en ms
const REVEAL_DURATION = 1500;

export default function RecordScreen({ session, onGoToHistory, onOpenSettings }) {
    const {
        isRecording,
        duration,
        startRecording,
        stopRecording,
        formatDuration
    } = useAudioRecorder();

    const [isUploading, setIsUploading] = useState(false);

    // --- SOUVENIR DU JOUR ---
    const [dailyMemory, setDailyMemory] = useState(null);
    const [isMemoryPlaying, setIsMemoryPlaying] = useState(false);
    const [isMemoryLoading, setIsMemoryLoading] = useState(true);
    const memorySoundRef = useRef(null);

    // --- REVEAL ANIMATION ---
    const [isRevealed, setIsRevealed] = useState(false);
    const [isPressing, setIsPressing] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const revealOpacity = useRef(new Animated.Value(0)).current;
    const pressTimerRef = useRef(null);
    const halfwayTriggered = useRef(false);

    // --- PLAYER MODAL ---
    const [showPlayer, setShowPlayer] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);

    // Charger le souvenir du jour au montage du composant
    useEffect(() => {
        if (session?.user) {
            loadDailyMemory();
        } else {
            setIsMemoryLoading(false);
        }

        // Cleanup : décharger le son quand on quitte l'écran
        return () => {
            if (memorySoundRef.current) {
                memorySoundRef.current.unloadAsync();
            }
        };
    }, [session]);

    const loadDailyMemory = async () => {
        setIsMemoryLoading(true);
        const memory = await getDailyMemory(session.user.id);
        setDailyMemory(memory);
        setIsMemoryLoading(false);
    };

    // --- REVEAL : Long Press handlers ---
    const triggerVibration = useCallback((type = 'light') => {
        // Vibration uniquement sur mobile, ignorée sur web
        if (Platform.OS === 'web') return;
        try {
            Vibration.vibrate(type === 'heavy' ? 50 : 20);
        } catch (e) {
            // Silently fail if vibration not supported
        }
    }, []);

    const onRevealPressIn = useCallback(() => {
        if (isRevealed) return;
        setIsPressing(true);
        halfwayTriggered.current = false;

        // Animate progress bar from 0 to 1 over REVEAL_DURATION
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: REVEAL_DURATION,
            useNativeDriver: false, // width animation can't use native driver
        }).start(({ finished }) => {
            if (finished) {
                // Reveal complete!
                triggerVibration('heavy');
                setIsPressing(false);
                setIsRevealed(true);

                // Fade in the revealed content
                revealOpacity.setValue(0);
                Animated.timing(revealOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();

                // Auto-ouvrir le player modal
                setShowPlayer(true);
                // Note: toggleMemoryPlayback sera appelé par openPlayerModal
                // mais ici on le fait direct pour éviter le double appel
                (async () => {
                    try {
                        const source = await getAudioSource(dailyMemory);
                        if (!source) return;
                        const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
                        memorySoundRef.current = sound;
                        setIsMemoryPlaying(true);
                        sound.setOnPlaybackStatusUpdate((status) => {
                            if (status.isLoaded) {
                                setPlaybackPosition(status.positionMillis || 0);
                                setPlaybackDuration(status.durationMillis || 0);
                            }
                            if (status.didJustFinish) {
                                setIsMemoryPlaying(false);
                                setPlaybackPosition(0);
                                memorySoundRef.current?.unloadAsync();
                                memorySoundRef.current = null;
                            }
                        });
                    } catch (e) {
                        console.error('Auto-play error:', e);
                    }
                })();
            }
        });

        // Halfway vibration
        pressTimerRef.current = setTimeout(() => {
            if (!halfwayTriggered.current) {
                halfwayTriggered.current = true;
                triggerVibration('light');
            }
        }, REVEAL_DURATION / 2);
    }, [isRevealed, progressAnim, revealOpacity, triggerVibration]);

    const onRevealPressOut = useCallback(() => {
        if (isRevealed) return;
        setIsPressing(false);

        // Cancel the animation if not finished
        progressAnim.stopAnimation();
        Animated.timing(progressAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();

        // Cancel halfway timer
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    }, [isRevealed, progressAnim]);

    // --- AUDIO PLAYBACK ---
    const toggleMemoryPlayback = async () => {
        try {
            // Si un son existe déjà, vérifier son état réel
            if (memorySoundRef.current) {
                const status = await memorySoundRef.current.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                    // En lecture → mettre en pause
                    await memorySoundRef.current.pauseAsync();
                    setIsMemoryPlaying(false);
                    return;
                }
                if (status.isLoaded && !status.isPlaying) {
                    // En pause → reprendre
                    await memorySoundRef.current.playAsync();
                    setIsMemoryPlaying(true);
                    return;
                }
            }

            // Pas de son → en créer un nouveau
            const source = await getAudioSource(dailyMemory);
            if (!source) {
                Alert.alert('Erreur', 'Impossible de charger ce souvenir.');
                return;
            }

            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
            memorySoundRef.current = sound;
            setIsMemoryPlaying(true);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    setPlaybackPosition(status.positionMillis || 0);
                    setPlaybackDuration(status.durationMillis || 0);
                }
                if (status.didJustFinish) {
                    setIsMemoryPlaying(false);
                    setPlaybackPosition(0);
                    memorySoundRef.current?.unloadAsync();
                    memorySoundRef.current = null;
                }
            });
        } catch (e) {
            console.error('Erreur lecture souvenir:', e);
            setIsMemoryPlaying(false);
        }
    };

    const openPlayerModal = () => {
        setShowPlayer(true);
        toggleMemoryPlayback();
    };

    const closePlayerModal = async () => {
        if (memorySoundRef.current) {
            await memorySoundRef.current.stopAsync();
            await memorySoundRef.current.unloadAsync();
            memorySoundRef.current = null;
        }
        setIsMemoryPlaying(false);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
        setShowPlayer(false);
    };

    // Fermer la modal mais garder l'audio (backdrop tap → mini player)
    const dismissToMiniPlayer = () => {
        setShowPlayer(false);
    };



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

    // --- Render du contenu pensée (verrouillé ou révélé) ---
    const renderMemoryCard = () => {
        if (isMemoryLoading) {
            return <ActivityIndicator size="small" color="#78350F" />;
        }

        if (!dailyMemory) {
            return (
                <Text className="text-sm text-seed-muted italic py-4 text-center">
                    Enregistre des notes pour débloquer des souvenirs
                </Text>
            );
        }

        if (isRevealed) {
            // ═══ ÉTAT RÉVÉLÉ — tap pour ouvrir le player ═══
            const relDate = getRelativeDate(dailyMemory.date);

            return (
                <Animated.View style={{ opacity: revealOpacity }}>
                    <TouchableOpacity onPress={openPlayerModal} activeOpacity={0.7}>
                        <View className="flex-row items-center justify-between gap-3">
                            <View className="flex-1">
                                <Text className="text-xs text-seed-accent font-medium mb-0.5">
                                    {relDate}
                                </Text>
                                <Text className="text-base font-semibold text-seed-text" numberOfLines={1}>
                                    {dailyMemory.title}
                                </Text>
                            </View>
                            <View
                                className="rounded-seed items-center justify-center"
                                style={{ backgroundColor: '#78350F', width: 44, height: 44 }}
                            >
                                <Play size={20} color="#FFFFFF" strokeWidth={1.5} />
                            </View>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            );
        }

        // ═══ ÉTAT VERROUILLÉ avec long press ═══
        const relativeDate = getRelativeDate(dailyMemory.date);

        return (
            <Pressable
                onPressIn={onRevealPressIn}
                onPressOut={onRevealPressOut}
                pressRetentionOffset={{ top: 200, left: 200, right: 200, bottom: 200 }}
                style={{ cursor: 'pointer' }}
            >
                <View className="flex-row items-center py-3 gap-3">
                    <Lock
                        size={24}
                        color={isPressing ? '#78350F' : '#D97706'}
                        strokeWidth={1.5}
                    />
                    <View className="flex-1">
                        <Text className="text-sm text-seed-text font-medium" numberOfLines={1}>
                            {relativeDate}, tu pensais à...
                        </Text>
                        <Text className="text-xs text-seed-muted mt-0.5">
                            {Platform.OS === 'web'
                                ? 'Clique et maintiens pour écouter'
                                : 'Maintiens pour écouter'}
                        </Text>
                    </View>
                </View>

                {/* Barre de progression */}
                <View className="w-full h-1 rounded-full" style={{ backgroundColor: '#F5F0E8' }}>
                    <Animated.View
                        style={{
                            height: '100%',
                            borderRadius: 9999,
                            backgroundColor: '#D97706',
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                        }}
                    />
                </View>
            </Pressable>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-seed-bg w-full">
            {/* ═══ HEADER ═══ */}
            <View className="flex-row justify-between items-center px-5 py-3 border-b border-seed-border bg-seed-bg">
                <TouchableOpacity onPress={onOpenSettings} className="p-2">
                    <Menu size={22} color="#78350F" strokeWidth={1.5} />
                </TouchableOpacity>
                <View className="flex-row items-center justify-center gap-2">
                    <Logo size={24} />
                    <Text className="text-lg font-bold text-seed-text">
                        KeepYourSeed
                    </Text>
                </View>
                <TouchableOpacity onPress={onGoToHistory} className="p-2">
                    <Clock size={22} color="#78350F" strokeWidth={1.5} />
                </TouchableOpacity>
            </View>

            {/* ═══ CONTENU PRINCIPAL — 3 zones ═══ */}
            <View className="flex-1 justify-between px-5 py-4">

                {/* ─── ZONE 1 : RÉCOMPENSE (Pensée du Passé) ─── */}
                {!isRecording && session?.user && (
                    <View className="w-full items-center">
                        <View className="w-full max-w-[350px] bg-seed-card rounded-seed px-3 py-2 border border-seed-border">
                            {renderMemoryCard()}
                        </View>
                    </View>
                )}

                {/* Spacer quand pas de pensée */}
                {(isRecording || !session?.user) && <View />}

                {/* ─── ZONE 2 : ACTION PRINCIPALE (Timer + CTA) ─── */}
                <View className="items-center">
                    <View className="mb-10 items-center">
                        <Text
                            className="text-6xl font-extralight text-seed-text"
                            style={{ fontVariant: ['tabular-nums'] }}
                        >
                            {formatDuration(duration)}
                        </Text>
                        {isRecording && (
                            <View className="flex-row items-center mt-3 gap-2">
                                <View className="w-2.5 h-2.5 rounded-full bg-seed-danger" />
                                <Text className="text-seed-danger text-sm font-medium">
                                    Enregistrement...
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="w-full max-w-[300px]">
                        {isUploading ? (
                            <ActivityIndicator size="large" color="#78350F" />
                        ) : (
                            <TouchableOpacity
                                onPress={handlePress}
                                className="py-4 px-6 rounded-seed items-center flex-row justify-center gap-2"
                                style={{ backgroundColor: isRecording ? '#B91C1C' : '#78350F' }}
                            >
                                {isRecording ? (
                                    <Square size={18} color="#FFFFFF" strokeWidth={1.5} />
                                ) : (
                                    <Mic size={18} color="#FFFFFF" strokeWidth={1.5} />
                                )}
                                <Text className="text-white font-semibold text-base">
                                    {isRecording ? "Arrêter" : "Capturer une pensée"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ─── ZONE 3 : MOTIVATION (Footer) ─── */}
                {!isRecording ? (
                    <View className="w-full items-center border-t border-seed-border pt-3">
                        <View className="flex-row items-center gap-2">
                            <Flame size={16} color="#D97706" strokeWidth={1.5} />
                            <Text className="text-sm text-seed-muted">
                                Continue comme ça !
                            </Text>
                        </View>
                        {session?.user && (
                            <Text className="text-xs text-seed-muted mt-1">
                                {session.user.email}
                            </Text>
                        )}
                    </View>
                ) : (
                    <View />
                )}
            </View>

            {/* ═══ COMPOSANT AUDIO PLAYER (Modal + Mini Player) ═══ */}
            <AudioPlayer
                showPlayer={showPlayer}
                isMemoryPlaying={isMemoryPlaying}
                dailyMemory={dailyMemory}
                playbackPosition={playbackPosition}
                playbackDuration={playbackDuration}
                memorySoundRef={memorySoundRef}
                toggleMemoryPlayback={toggleMemoryPlayback}
                closePlayerModal={closePlayerModal}
                setShowPlayer={setShowPlayer}
                dismissToMiniPlayer={dismissToMiniPlayer}
            />
        </SafeAreaView>
    );
}

