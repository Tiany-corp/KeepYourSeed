import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { getRecordings, clearRecordings } from '../services/storage';
import { uploadRecordingToCloud, fetchCloudRecordings } from '../services/cloud';
import { Play, Pause, Cloud, CloudOff, CloudUpload, ArrowLeft, Trash2 } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export default function HistoryScreen({ onGoBack, session, onOpenSettings }) {
    const [recordings, setRecordings] = useState([]);
    const [uploadingId, setUploadingId] = useState(null);

    // Lecteur audio global
    const audioPlayer = useAudioPlayer();

    useEffect(() => {
        loadRecordings();
    }, []);

    async function loadRecordings() {
        const localData = await getRecordings();

        let mergedData = localData;
        if (session?.user) {
            try {
                const cloudData = await fetchCloudRecordings(session.user.id);
                const localRemoteUrls = new Set(
                    localData.filter(r => r.remoteUrl).map(r => r.remoteUrl)
                );
                const newCloudRecordings = cloudData.filter(
                    cloudRec => !localRemoteUrls.has(cloudRec.remoteUrl)
                );
                mergedData = [...localData, ...newCloudRecordings];
            } catch (e) {
                console.error('Failed to sync cloud recordings:', e);
            }
        }

        mergedData.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecordings(mergedData);
    }

    async function handleUpload(item) {
        setUploadingId(item.id);
        try {
            const userId = session?.user?.id || 'public';
            const publicUrl = await uploadRecordingToCloud(item.id, item.localUri, userId);
            if (publicUrl) {
                Alert.alert("Succès", "Fichier envoyé sur le cloud !");
                await loadRecordings();
            } else {
                Alert.alert("Erreur", "L'envoi a échoué.");
            }
        } catch (e) {
            Alert.alert("Erreur", "Une erreur est survenue.");
        } finally {
            setUploadingId(null);
        }
    }

    // Icône du bouton cloud selon le status
    const renderStatusIcon = (item) => {
        if (uploadingId === item.id) return <CloudUpload size={20} color="#78716C" />;
        switch (item.status) {
            case 'synced': return <Cloud size={20} color="#16a34a" />;
            case 'error': return <CloudOff size={20} color="#ef4444" />;
            default: return <Cloud size={20} color="#78350F" />; // pending
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('fr-FR') + ' • ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // Vérifie si CE recording est en train de jouer dans le player global
    const isItemPlaying = (item) => audioPlayer.currentTrack?.id === item.id;

    const renderItem = ({ item }) => (
        <View style={styles.itemContainer}>
            <TouchableOpacity style={styles.item} onPress={() => audioPlayer.toggle(item)}>
                <View style={[styles.playButtonIcon, isItemPlaying(item) && styles.playButtonIconActive]}>
                    {isItemPlaying(item) && audioPlayer.isPlaying ? (
                        <Pause size={18} color="#FFFFFF" strokeWidth={1.5} />
                    ) : (
                        <Play size={18} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 3 }} />
                    )}
                </View>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title || 'Sans titre'}</Text>
                    <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                </View>
                <View style={styles.itemMeta}>
                    <Text style={styles.itemDuration}>{formatDuration(item.duration)}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.uploadButton,
                    item.status === 'synced' && styles.uploadButtonSynced,
                    uploadingId === item.id && styles.uploadButtonDisabled
                ]}
                onPress={() => handleUpload(item)}
                disabled={uploadingId === item.id || item.status === 'synced'}
            >
                {renderStatusIcon(item)}
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                onOpenSettings={onOpenSettings}
                title="Historique"
                showLogo={false}
                rightContent={
                    <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                        <ArrowLeft size={16} color="#78350F" strokeWidth={2} style={{ marginRight: 4 }} />
                        <Text style={styles.backButtonText}>Retour</Text>
                    </TouchableOpacity>
                }
            />

            <FlatList
                data={recordings}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun enregistrement.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF7F2',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F5F0E8',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#78350F',
    },
    listContent: {
        padding: 16,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    item: {
        backgroundColor: '#F5F0E8',
        padding: 12,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D4A574',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        flex: 1,
        marginRight: 10,
    },
    playButtonIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#78350F',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    playButtonIconActive: {
        backgroundColor: '#B91C1C',
    },
    uploadButton: {
        backgroundColor: '#F5F0E8',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    uploadButtonDisabled: {
        opacity: 0.5,
    },
    uploadButtonSynced: {
        backgroundColor: '#dcfce7',
        borderColor: '#86efac',
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 2,
    },
    itemDate: {
        fontSize: 12,
        color: '#78716C',
    },
    itemMeta: {
        justifyContent: 'center',
    },
    itemDuration: {
        color: '#78716C',
        fontSize: 14,
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#78716C',
        fontStyle: 'italic',
    }
});
