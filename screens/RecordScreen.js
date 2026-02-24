import { View, Text, SafeAreaView, Alert, ActivityIndicator, TouchableOpacity, Button } from 'react-native';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { saveRecording } from '../services/storage';
import { uploadRecordingToCloud, saveRecordingToDatabase } from '../services/cloud';
import { useState } from 'react';

export default function RecordScreen({ session, onGoToHistory, onOpenSettings }) {
    const {
        isRecording,
        duration,
        startRecording,
        stopRecording,
        formatDuration
    } = useAudioRecorder();

    const [isUploading, setIsUploading] = useState(false);

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
                    localUri: uri,         // indexeddb:// sur Web, file:// sur Mobile
                    remoteUrl: null,       // Sera rempli après upload cloud
                    status: 'pending',     // 'pending' → 'uploading' → 'synced' / 'error'
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
                            Alert.alert("Succès", "Note enregistrée et synchronisée ! ☁️");
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
        <SafeAreaView className="flex-1 bg-gray-100 w-full">
            <View className="flex-row justify-between items-center px-5 py-2.5 bg-gray-100">
                <TouchableOpacity onPress={onOpenSettings} style={{ padding: 10 }}>
                    <Text style={{ fontSize: 22 }}>☰</Text>
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-800">Journal Audio</Text>
                <Button title="Historique" onPress={onGoToHistory} />
            </View>

            <View className="flex-1 justify-center items-center p-5">

                <View className="mb-12 items-center ">
                    <Text
                        className="text-6xl font-extralight text-gray-800"
                        style={{ fontVariant: ['tabular-nums'] }}
                    >
                        {formatDuration(duration)}
                    </Text>
                    {isRecording && <Text className="mt-2.5 text-red-500 text-base">🔴 Enregistrement...</Text>}
                </View>

                <View className="w-full max-w-[300px] justify-center">
                    {isUploading ? (
                        <ActivityIndicator size="large" color="#0000ff" />
                    ) : (
                        <TouchableOpacity
                            onPress={handlePress}
                            className={`py-4 px-6 rounded-xl items-center ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`}
                        >
                            <Text className="text-white font-semibold text-base">
                                {isRecording ? "Arrêter l'enregistrement" : "Commencer une note"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                {session?.user && <Text className="mt-5 text-sm text-gray-500">Connecté en tant que {session.user.email}</Text>}

            </View>
        </SafeAreaView>
    );
}
