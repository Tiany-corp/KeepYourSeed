import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { getRecordings, clearRecordings, getAudioSource } from '../services/storage';
import { uploadRecordingToCloud, fetchCloudRecordings } from '../services/cloud';
import { Audio } from 'expo-av';

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
                Alert.alert("Succès", "Fichier envoyé sur le cloud ! ☁️");
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
    const getStatusIcon = (item) => {
        if (uploadingId === item.id) return '...';
        switch (item.status) {
            case 'synced': return '✅';
            case 'uploading': return '⏳';
            case 'error': return '❌';
            default: return '☁️'; // pending
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const renderItem = ({ item }) => (
        <View style={styles.itemContainer}>
            <TouchableOpacity style={styles.item} onPress={() => playSound(item)}>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title || 'Sans titre'}</Text>
                    <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                </View>
                <View style={styles.itemMeta}>
                    <Text style={styles.itemDuration}>{formatDuration(item.duration)}</Text>
                    <Text style={styles.playIcon}>{playingId === item.id ? '⏸️' : '▶️'}</Text>
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
                <Text style={styles.uploadButtonText}>
                    {getStatusIcon(item)}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onOpenSettings} style={styles.backButton}>
                    <Text style={{ fontSize: 22 }}>☰</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Historique</Text>
                <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Retour</Text>
                </TouchableOpacity>
            </View>

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
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 10,
    },
    backButtonText: {
        fontSize: 16,
        color: '#007bff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 20,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    item: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        flex: 1, // Take remaining space
        marginRight: 10,
    },
    uploadButton: {
        backgroundColor: '#e1e1e1',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadButtonDisabled: {
        opacity: 0.5,
    },
    uploadButtonSynced: {
        backgroundColor: '#d4edda',
    },
    uploadButtonText: {
        fontSize: 20,
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    itemDate: {
        fontSize: 12,
        color: '#888',
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemDuration: {
        marginRight: 10,
        color: '#666',
    },
    playIcon: {
        fontSize: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#888',
    }
});
