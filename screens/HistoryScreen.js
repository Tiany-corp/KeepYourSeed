import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { getRecordings, getDailyMemory, setPinnedThought, updateRecording, deleteRecording } from '../services/storage';
import { fetchCloudRecordings, updateRecordingMetadataInDatabase, deleteRecordingFromCloud } from '../services/cloud';
import { Play, Pause, ArrowLeft, Pin, Pencil } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import Logo from '../components/Logo';
import TagFilterBar from '../components/TagFilterBar';
import TitleModal from '../components/TitleModal';
import { AVAILABLE_TAGS } from '../components/TitleModal';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';

function getTagInfo(tagId) {
    const found = AVAILABLE_TAGS.find(t => t.id === tagId);
    if (found) return found;
    // Custom tag: derive label from id
    if (tagId.startsWith('custom_')) {
        const label = tagId.replace('custom_', '').replace(/_/g, ' ');
        return { id: tagId, label: label.charAt(0).toUpperCase() + label.slice(1), emoji: '🏷️' };
    }
    return null;
}

export default function HistoryScreen({ onGoBack, session, onOpenSettings }) {
    const [recordings, setRecordings] = useState([]);
    const [dailyMemory, setDailyMemory] = useState(null);
    const [selectedFilterTag, setSelectedFilterTag] = useState(null);
    const [editingRecording, setEditingRecording] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

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

    // Extraction des tags uniques
    const uniqueTagIds = [...new Set(recordings.flatMap(r => r.tags || []))];
    const availableTags = uniqueTagIds.map(getTagInfo).filter(Boolean);

    // Filtrage dynamique
    const filteredParentRecordings = parentRecordings.filter(r => {
        if (!selectedFilterTag) return true; // pas de filtre
        return r.tags?.includes(selectedFilterTag);
    });

    const handlePin = async (item) => {
        await setPinnedThought(item);
        showAlert('Épinglée', `"${item.title}" est maintenant sur ton accueil.`, 'success');
    };

    // Fonctionnalité d'édition (Placeholder pour la logique future)
    const handleEdit = (item) => {
        setEditingRecording(item);
        setShowEditModal(true);
    };

    const applyRecordingUpdateInState = (id, updates) => {
        setRecordings(prev => prev.map(rec => (rec.id === id ? { ...rec, ...updates } : rec)));
        if (dailyMemory?.id === id) {
            setDailyMemory(prev => (prev ? { ...prev, ...updates } : prev));
        }
    };

    const handleEditCancel = () => {
        setShowEditModal(false);
        setEditingRecording(null);
    };

    const handleEditConfirm = async (title, type = 'note', deliverDate = null, tags = []) => {
        if (!editingRecording) return;

        const updates = { title, type, deliverDate, tags };

        try {
            await updateRecording(editingRecording.id, updates);
            applyRecordingUpdateInState(editingRecording.id, updates);

            if (session?.user && (editingRecording.dbId || editingRecording.remoteUrl)) {
                const ok = await updateRecordingMetadataInDatabase({
                    userId: session.user.id,
                    recording: editingRecording,
                    title,
                    type,
                    deliverDate,
                    tags,
                });
                if (!ok) {
                    showAlert('Attention', "Modification locale enregistree, mais la mise a jour cloud a echoue.", 'warning');
                } else {
                    showAlert('Succes', 'Enregistrement modifie.', 'success');
                }
            } else {
                showAlert('Succes', 'Enregistrement modifie localement.', 'success');
            }
        } catch (e) {
            console.error('Edit failed:', e);
            showAlert('Erreur', "Impossible de modifier l'enregistrement.", 'error');
        } finally {
            handleEditCancel();
        }
    };

    const executeDelete = async () => {
        if (!editingRecording) return;
        const recordingToDelete = editingRecording;

        try {
            await deleteRecording(recordingToDelete.id);

            if (audioPlayer.currentTrack?.id === recordingToDelete.id) {
                await audioPlayer.stop();
            }

            setRecordings(prev => prev.filter(rec => rec.id !== recordingToDelete.id));
            if (dailyMemory?.id === recordingToDelete.id) {
                setDailyMemory(null);
            }

            if (session?.user && (recordingToDelete.dbId || recordingToDelete.remoteUrl)) {
                const ok = await deleteRecordingFromCloud({
                    userId: session.user.id,
                    recording: recordingToDelete,
                });
                if (!ok) {
                    showAlert('Attention', 'Supprime localement, mais suppression cloud echouee.', 'warning');
                } else {
                    showAlert('Succes', 'Enregistrement supprime.', 'success');
                }
            } else {
                showAlert('Succes', 'Enregistrement supprime localement.', 'success');
            }
        } catch (e) {
            console.error('Delete failed:', e);
            showAlert('Erreur', "Impossible de supprimer l'enregistrement.", 'error');
        } finally {
            handleEditCancel();
        }
    };

    const handleEditDelete = () => {
        const title = editingRecording?.title || 'cet enregistrement';
        if (Platform.OS === 'web') {
            if (window.confirm(`Supprimer "${title}" ?`)) {
                executeDelete();
            }
            return;
        }
        Alert.alert(
            'Supprimer',
            `Voulez-vous supprimer "${title}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: executeDelete },
            ]
        );
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        const dayOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };

        const dayStr = date.toLocaleDateString('fr-FR', dayOptions);
        const timeStr = date.toLocaleTimeString('fr-FR', timeOptions);

        return `${dayStr} • ${timeStr}`;
    }

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

    // Formater la deuxième ligne : Date • Durée
    const renderMetaLine = (item) => {
        return (
            <View style={styles.metaLineContainer}>
                <Text style={styles.itemDate} numberOfLines={1}>{formatDate(item.date)}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.itemDuration}>{formatDuration(item.duration)}</Text>
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
                        <Text style={styles.itemTitle} numberOfLines={1}>{item.title || 'Sans titre'}</Text>
                        {renderMetaLine(item)}
                        {/* Ligne 3 : Tags isolés en bas */}
                        {item.tags && item.tags.length > 0 && renderTags(item.tags)}
                    </View>
                </TouchableOpacity>

                {/* Bouton d'édition */}
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEdit(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                >
                    <Pencil size={20} color="#78350F" strokeWidth={1.5} />
                </TouchableOpacity>

                {/* Bouton épingler */}
                <TouchableOpacity
                    style={styles.actionButton}
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

    const renderListHeader = () => {
        const hasFilters = availableTags.length > 0;
        if (!dailyMemory && !hasFilters) return null;

        return (
            <View>
                {/* Pensée Souvenir */}
                {dailyMemory && (
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
                )}

                {/* Barre de filtres (Tags) */}
                <TagFilterBar
                    availableTags={availableTags}
                    selectedTag={selectedFilterTag}
                    onSelectTag={setSelectedFilterTag}
                />
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
                data={filteredParentRecordings}
                ListHeaderComponent={renderListHeader}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun enregistrement.</Text>}
            />

            <TitleModal
                visible={showEditModal}
                isEditMode
                defaultTitle={editingRecording?.title || ''}
                initialMode={editingRecording?.type || 'note'}
                initialDeliverDate={editingRecording?.deliverDate || ''}
                initialTags={editingRecording?.tags || []}
                recordingDuration={0}
                onConfirm={handleEditConfirm}
                onCancel={handleEditCancel}
                onDelete={handleEditDelete}
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
        marginBottom: 13,
    },
    dailyMemoryHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#D97706',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
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
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
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
    metaLineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
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
    editButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F0E8',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 1,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FAF7F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        borderWidth: 1,
        borderColor: '#E8D5BF',
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
