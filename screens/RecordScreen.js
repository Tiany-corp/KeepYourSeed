import { View, Text, SafeAreaView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { saveRecording, getDailyMemory, getAudioSource } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Menu, Clock, Mic, Square, Play, CircleStop } from 'lucide-react-native';

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

    const toggleMemoryPlayback = async () => {
        try {
            // Si un son est déjà en cours, on l'arrête
            if (memorySoundRef.current && isMemoryPlaying) {
                await memorySoundRef.current.stopAsync();
                await memorySoundRef.current.unloadAsync();
                memorySoundRef.current = null;
                setIsMemoryPlaying(false);
                return;
            }

            // Sinon, on charge et on joue
            const source = await getAudioSource(dailyMemory);
            if (!source) {
                Alert.alert('Erreur', 'Impossible de charger ce souvenir.');
                return;
            }

            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
            memorySoundRef.current = sound;
            setIsMemoryPlaying(true);

            // Quand le son se termine, remettre l'état à "arrêté"
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

    const formatMemoryDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const handlePress = async () => {
        if (isRecording) {
            const uri = await stopRecording();
            if (uri) {
                // 1. Prepare metadata
                const recordingId = Date.now().toString();
                const recordingTitle = `Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                // 2. Sauvegarder localement d'abord (l'utilisateur voit sa note immédiatement)
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

                // 3. Upload automatique si l'utilisateur est connecté
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

            <View className="flex-1 justify-center items-center p-5">

                {/* ═══ SOUVENIR DU JOUR ═══ */}
                {session?.user && !isRecording && (
                    <View className="w-full max-w-[350px] mb-8 bg-seed-card rounded-seed p-4 border border-seed-border">
                        <Text className="text-xs text-seed-muted mb-1">Souvenir du jour</Text>
                        {isMemoryLoading ? (
                            <ActivityIndicator size="small" color="#78350F" />
                        ) : dailyMemory ? (
                            <View>
                                <Text className="text-base font-semibold text-seed-text" numberOfLines={1}>
                                    {dailyMemory.title}
                                </Text>
                                <Text className="text-xs text-seed-muted mt-0.5">
                                    {formatMemoryDate(dailyMemory.date)}
                                </Text>
                                <TouchableOpacity
                                    onPress={toggleMemoryPlayback}
                                    className="mt-3 py-2.5 rounded-seed items-center flex-row justify-center gap-2"
                                    style={{ backgroundColor: isMemoryPlaying ? '#B91C1C' : '#78350F' }}
                                >
                                    {isMemoryPlaying ? (
                                        <CircleStop size={16} color="#FFFFFF" strokeWidth={1.5} />
                                    ) : (
                                        <Play size={16} color="#FFFFFF" strokeWidth={1.5} />
                                    )}
                                    <Text className="text-white font-semibold text-sm">
                                        {isMemoryPlaying ? 'Arrêter' : 'Écouter ce souvenir'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text className="text-sm text-seed-muted italic">Aucun souvenir disponible</Text>
                        )}
                    </View>
                )}

                {/* ═══ TIMER ═══ */}
                <View className="mb-12 items-center">
                    <Text
                        className="text-6xl font-extralight text-seed-text"
                        style={{ fontVariant: ['tabular-nums'] }}
                    >
                        {formatDuration(duration)}
                    </Text>
                    {isRecording && (
                        <View className="flex-row items-center mt-3 gap-2">
                            <View className="w-2.5 h-2.5 rounded-full bg-seed-danger" />
                            <Text className="text-seed-danger text-sm font-medium">Enregistrement...</Text>
                        </View>
                    )}
                </View>

                {/* ═══ BOUTON PRINCIPAL ═══ */}
                <View className="w-full max-w-[300px] justify-center">
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
                                {isRecording ? "Arrêter" : "Commencer une note"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ═══ INFO UTILISATEUR ═══ */}
                {session?.user && (
                    <Text className="mt-5 text-xs text-seed-muted">
                        {session.user.email}
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}
