import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { getRecordings, clearRecordings, getAudioSource } from '../services/storage';
import { uploadRecordingToCloud, fetchCloudRecordings } from '../services/cloud';
import { Audio } from 'expo-av';
import { Play, Pause, Cloud, CloudOff, CloudUpload, ArrowLeft, Trash2 } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';

export default function HistoryScreen({ onGoBack, session, onOpenSettings }) {
    const [recordings, setRecordings] = useState([]);
    const [sound, setSound] = useState();
    const [playingId, setPlayingId] = useState(null);
    const [uploadingId, setUploadingId] = useState(null);

    useEffect(() => {
        loadRecordings();
        return () => {
            if (sound) {
                console.log('Unloading Sound');
                sound.unloadAsync();
            }
        };
    }, []);

    async function loadRecordings() {
        // 1. Charger les enregistrements locaux
        const localData = await getRecordings();

        // 2. Si connecté, récupérer aussi les enregistrements cloud
        let mergedData = localData;
        if (session?.user) {
            try {
                const cloudData = await fetchCloudRecordings(session.user.id);

                // 3. Fusionner : on garde les locaux et on ajoute les cloud
                //    qui n'existent pas déjà localement (dédoublonnage par remoteUrl)
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

        // 4. Trier par date décroissante
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
                // Recharger la liste pour afficher le nouveau status
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

    async function playSound(recording) {
        console.log('Loading Sound for', recording.id);

        // If already playing this one, stop it (toggle)
        if (sound && playingId === recording.id) {
            try {
                const status = await sound.getStatusAsync();
                if (status.isLoaded) {
                    await sound.stopAsync();
                    await sound.unloadAsync();
                }
            } catch (e) { /* son déjà déchargé, on ignore */ }
            setSound(null);
            setPlayingId(null);
            return;
        }

        // If playing another one, unload it first
        if (sound) {
            try { await sound.unloadAsync(); } catch (e) { /* ignore */ }
            setSound(null);
        }

        // Utilise le sélecteur intelligent : local d'abord, cloud ensuite
        const source = await getAudioSource(recording);
        if (!source) {
            Alert.alert('Erreur', 'Fichier audio introuvable (ni local, ni cloud).');
            return;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(source);
        setSound(newSound);
        setPlayingId(recording.id);

        console.log('Playing Sound');
        await newSound.playAsync();

        newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.didJustFinish) {
                setPlayingId(null);
                setSound(null);
                newSound.unloadAsync();
            }
        });
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

    const renderItem = ({ item }) => (
        <View style={styles.itemContainer}>
            <TouchableOpacity style={styles.item} onPress={() => playSound(item)}>
                <View style={[styles.playButtonIcon, playingId === item.id && styles.playButtonIconActive]}>
                    {playingId === item.id ? (
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
        backgroundColor: '#FAF7F2', // seed-bg
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
        color: '#78350F', // seed-primary
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#292524',
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
        backgroundColor: '#F5F0E8', // seed-card
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
