import { View, Text, SafeAreaView, Alert, ActivityIndicator, TouchableOpacity, Animated, Platform, Vibration, Pressable } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { saveRecording, getDailyMemory, getAudioSource } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Menu, Clock, Mic, Square, Lock, Flame, Play, CircleStop } from 'lucide-react-native';

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
            if (memorySoundRef.current && isMemoryPlaying) {
                await memorySoundRef.current.stopAsync();
                await memorySoundRef.current.unloadAsync();
                memorySoundRef.current = null;
                setIsMemoryPlaying(false);
                return;
            }

            const source = await getAudioSource(dailyMemory);
            if (!source) {
                Alert.alert('Erreur', 'Impossible de charger ce souvenir.');
                return;
            }

            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
            memorySoundRef.current = sound;
            setIsMemoryPlaying(true);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setIsMemoryPlaying(false);
                    memorySoundRef.current = null;
                }
            });
        } catch (e) {
            console.error('Erreur lecture souvenir:', e);
            setIsMemoryPlaying(false);
        }
    };

    // Retourne un texte contextuel selon la distance temporelle
    const getRelativeDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        // Moment de la journée
        const hour = date.getHours();
        let moment = '';
        if (hour >= 5 && hour < 12) moment = ' matin';
        else if (hour >= 12 && hour < 18) moment = ' après-midi';
        else if (hour >= 18 && hour < 22) moment = ' soir';
        else moment = ' dans la nuit';

        // Jour de la semaine
        const joursSemaine = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const jour = joursSemaine[date.getDay()];

        // < 7 jours : jour nommé + moment ("Mardi soir")
        if (diffDays === 0) return `Ce${moment}`;
        if (diffDays === 1) return `Hier${moment}`;
        if (diffDays < 7) return `${jour}${moment}`;

        // 7 jours - 3 mois : relatif ("Il y a 2 semaines")
        if (diffDays < 14) return 'La semaine dernière';
        if (diffDays < 90) {
            if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
            }
            const months = Math.floor(diffDays / 30);
            return `Il y a ${months} mois`;
        }

        // > 3 mois : date nommée ("Le 5 mars")
        const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        return `Le ${dateStr}`;
    };

    const formatMemoryDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let relativeText = '';
        if (diffDays === 0) relativeText = "Aujourd'hui";
        else if (diffDays === 1) relativeText = 'Hier';
        else if (diffDays < 30) relativeText = `Il y a ${diffDays} jours`;
        else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            relativeText = `Il y a ${months} mois`;
        } else {
            const years = Math.floor(diffDays / 365);
            relativeText = `Il y a ${years} an${years > 1 ? 's' : ''}`;
        }

        const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        return `${relativeText}, le ${dateStr}`;
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
            // ═══ ÉTAT RÉVÉLÉ ═══
            const relDate = getRelativeDate(dailyMemory.date);

            return (
                <Animated.View style={{ opacity: revealOpacity }}>
                    {/* Contexte émotionnel */}
                    <Text className="text-xs text-seed-accent font-medium mb-1">
                        {relDate}, tu pensais à...
                    </Text>

                    {/* Contenu principal : titre + play inline */}
                    <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                            <Text className="text-base font-semibold text-seed-text" numberOfLines={1}>
                                {dailyMemory.title}
                            </Text>
                            <Text className="text-xs text-seed-muted mt-0.5">
                                {new Date(dailyMemory.date).toLocaleDateString('fr-FR', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}
                            </Text>
                        </View>

                        {/* Bouton play/stop compact */}
                        <TouchableOpacity
                            onPress={toggleMemoryPlayback}
                            className="rounded-seed items-center justify-center"
                            style={{
                                backgroundColor: isMemoryPlaying ? '#B91C1C' : '#78350F',
                                width: 44,
                                height: 44,
                            }}
                        >
                            {isMemoryPlaying ? (
                                <CircleStop size={20} color="#FFFFFF" strokeWidth={1.5} />
                            ) : (
                                <Play size={20} color="#FFFFFF" strokeWidth={1.5} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Indicateur lecture active */}
                    {isMemoryPlaying && (
                        <View className="w-full h-0.5 mt-2 rounded-full" style={{ backgroundColor: '#D97706' }} />
                    )}
                </Animated.View>
            );
        }

        // ═══ ÉTAT VERROUILLÉ avec long press ═══
        const relativeDate = getRelativeDate(dailyMemory.date);

        return (
            <Pressable
                onPressIn={onRevealPressIn}
                onPressOut={onRevealPressOut}
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
                <Text className="text-lg font-bold text-seed-text">
                    KeepYourSeed
                </Text>
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
                                    {isRecording ? "Arrêter" : "Garder une pensée"}
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
        </SafeAreaView>
    );
}
