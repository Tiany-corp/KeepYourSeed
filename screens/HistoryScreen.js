import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { getRecordings, clearRecordings, getDailyMemory, setPinnedThought } from '../services/storage';
import { uploadRecordingToCloud, fetchCloudRecordings } from '../services/cloud';
import { Play, Pause, Cloud, CloudOff, CloudUpload, ArrowLeft, Trash2, Pin } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import Logo from '../components/Logo';
import { AVAILABLE_TAGS } from '../components/TitleModal';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';

export default function HistoryScreen({ onGoBack, session, onOpenSettings }) {
    const [recordings, setRecordings] = useState([]);
    const [uploadingId, setUploadingId] = useState(null);
    const [dailyMemory, setDailyMemory] = useState(null);

    const audioPlayer = useAudioPlayer();
    const { showAlert } = useAlert();

    useEffect(() => {
        loadRecordings();
        if (session?.user) {
            getDailyMemory(session.user.id).then(setDailyMemory);
        }
    }, [session]);

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

    // Grouper les recordings : parents (sans parentId) avec leurs enfants
    const parentRecordings = recordings.filter(r => !r.parentId);
    const childrenByParent = {};
    recordings.filter(r => r.parentId).forEach(child => {
        if (!childrenByParent[child.parentId]) childrenByParent[child.parentId] = [];
        childrenByParent[child.parentId].push(child);
    });

    const handlePin = async (item) => {
        await setPinnedThought(item);
        showAlert('Épinglée', `"${item.title}" est maintenant sur ton accueil.`, 'success');
    };

    async function handleUpload(item) {
        // Pas connecté → message
        if (!session?.user) {
            showAlert("Connexion requise", "Connecte-toi pour sauvegarder tes enregistrements dans le cloud.", "warning");
            return;
        }

        setUploadingId(item.id);
        try {
            const publicUrl = await uploadRecordingToCloud(item.id, item.localUri, session.user.id);
            if (publicUrl) {
                showAlert("Succès", "Fichier envoyé sur le cloud !", "success");
                await loadRecordings();
            } else {
                showAlert("Erreur", "L'envoi a échoué.", "error");
            }
        } catch (e) {
            showAlert("Erreur", "Une erreur est survenue.", "error");
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

    const getTagInfo = (tagId) => {
        const found = AVAILABLE_TAGS.find(t => t.id === tagId);
        if (found) return found;
        // Custom tag: derive label from id
        if (tagId.startsWith('custom_')) {
            const label = tagId.replace('custom_', '').replace(/_/g, ' ');
            return { id: tagId, label: label.charAt(0).toUpperCase() + label.slice(1), emoji: '🏷️' };
        }
        return null;
    };

    const renderTags = (tags) => {
        if (!tags || tags.length === 0) return null;
        return (
            <View style={styles.tagsRow}>
                {tags.map(tagId => {
                    const tag = getTagInfo(tagId);
                    if (!tag) return null;
                    return (
                        <View key={tagId} style={styles.tagPill}>
                            <Text style={styles.tagPillText}>{tag.emoji} {tag.label}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    // Vérifie si CE recording est en train de jouer dans le player global
    const isItemPlaying = (item) => audioPlayer.currentTrack?.id === item.id;

    const renderItem = ({ item }) => (
        <>
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
                        {renderTags(item.tags)}
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

                {/* Bouton épingler */}
                <TouchableOpacity
                    style={styles.pinButton}
                    onPress={() => handlePin(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Pin size={16} color="#78350F" strokeWidth={2} />
                </TouchableOpacity>
            </View>

            {/* Enfants connectés */}
            {childrenByParent[item.id] && childrenByParent[item.id].length > 0 && (
                <View style={styles.childrenRow}>
                    {childrenByParent[item.id].map(child => (
                        <TouchableOpacity
                            key={child.id}
                            style={[styles.childSquare, isItemPlaying(child) && styles.childSquareActive]}
                            onPress={() => audioPlayer.toggle(child)}
                            activeOpacity={0.7}
                        >
                            <Logo size={18} color={isItemPlaying(child) ? '#FFFFFF' : '#78350F'} variant="outline" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </>
    );

    const renderDailyMemory = () => {
        if (!dailyMemory) return null;

        return (
            <View style={styles.dailyMemorySection}>
                <Text style={styles.dailyMemoryHeaderTitle}>Pensée souvenir ⏳</Text>
                <TouchableOpacity style={styles.dailyMemoryCard} onPress={() => { audioPlayer.play(dailyMemory); audioPlayer.openModal(); }}>
                    <Logo size={28} color="#D97706" variant="outline" style={styles.dailyMemoryLogo} />
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle}>{dailyMemory.title || 'Un souvenir t\'attend'}</Text>
                        <Text style={styles.itemDate}>{formatDate(dailyMemory.date)}</Text>
                    </View>
                    <View style={[styles.playButtonIcon, isItemPlaying(dailyMemory) && styles.playButtonIconActive]}>
                        {isItemPlaying(dailyMemory) && audioPlayer.isPlaying ? (
                            <Pause size={18} color="#FFFFFF" strokeWidth={1.5} />
                        ) : (
                            <Play size={18} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 3 }} />
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

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
                data={parentRecordings}
                ListHeaderComponent={renderDailyMemory}
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
    dailyMemorySection: {
        marginBottom: 24,
    },
    dailyMemoryHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#D97706',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    dailyMemoryCard: {
        backgroundColor: '#F5EADB',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8D5BF',
        // Ombre douce
        shadowColor: '#78350F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    dailyMemoryLogo: {
        marginRight: 16,
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
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    tagPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: '#F5F0E8',
        borderRadius: 10,
        borderWidth: 0.5,
        borderColor: '#D4A574',
    },
    tagPillText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#78350F',
    },
    pinButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FAF7F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    childrenRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingLeft: 52,
        marginBottom: 8,
        marginTop: -4,
    },
    childSquare: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F5F0E8',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    childSquareActive: {
        backgroundColor: '#78350F',
        borderColor: '#78350F',
    },
});
