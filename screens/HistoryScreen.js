import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform, Modal } from 'react-native';
import { getRecordings, getDailyMemory, setPinnedThought, updateRecording, deleteRecording, getSeenDailyMemoryId, setSeenDailyMemoryId } from '../services/storage';
import { updateRecordingMetadataInDatabase, deleteRecordingFromCloud } from '../services/cloud';
import { syncAll } from '../services/sync';
import { ArrowLeft, Pencil, MoreVertical, Trash2, Pin } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import TagFilterBar from '../components/TagFilterBar';
import TitleModal from '../components/TitleModal';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';
import { useNavigation } from '@react-navigation/native';
import { AppContext } from '../contexts/AppContext';

import { getTagInfo } from '../utils/tags';
import { formatDateWithTime } from '../utils/date';
import RecordingItem from '../components/history/RecordingItem';
import HistorySkeleton from '../components/history/HistorySkeleton';
import DailyMemoryCard from '../components/history/DailyMemoryCard';

export default function HistoryScreen() {
    const { session, setDrawerOpen } = useContext(AppContext);
    const navigation = useNavigation();
    const [recordings, setRecordings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dailyMemory, setDailyMemory] = useState(null);
    const [isDailyMemorySeen, setIsDailyMemorySeen] = useState(true); // Vu par défaut (évite le clignotement au chargement)
    // ...
    const [selectedFilterTag, setSelectedFilterTag] = useState(null);
    const [editingRecording, setEditingRecording] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedOptionsItem, setSelectedOptionsItem] = useState(null);

    const audioPlayer = useAudioPlayer();
    const { showAlert } = useAlert();

    useEffect(() => {
        const initializeRecordings = async () => {
            // 1. Charger le local immédiatement pour la réactivité
            const localData = await getRecordings();
            setRecordings(localData.sort((a, b) => new Date(b.date) - new Date(a.date)));

            setIsLoading(false);

            // 2. Lancer la synchronisation initiale
            if (session?.user) {
                try {
                    const result = await syncAll(session.user.id);
                    if (result.success && (result.pushed > 0 || result.pulled > 0)) {
                        const updatedData = await getRecordings();
                        setRecordings(updatedData.sort((a, b) => new Date(b.date) - new Date(a.date)));
                    }
                } catch (e) {
                    console.error('Initial sync failed:', e);
                }
            }
        };

        initializeRecordings();

        if (session?.user) {
            getDailyMemory(session.user.id).then(async (memory) => {
                setDailyMemory(memory);
                if (memory) {
                    const seenId = await getSeenDailyMemoryId(session.user.id);
                    setIsDailyMemorySeen(false);
                }
            });

            // Écoute réseau "one-shot" pour déclencher le sync au passage en Wi-Fi
            const NetInfo = require('@react-native-community/netinfo');
            let hasSyncedInWifi = false;
            let unsubscribe = null;

            unsubscribe = NetInfo.addEventListener(state => {
                const isWifi = state.type === 'wifi' || state.type === 'ethernet';
                if (isWifi && state.isConnected && !hasSyncedInWifi) {
                    console.log('Wi-Fi détecté – Déclenchement de la synchronisation one-shot');
                    hasSyncedInWifi = true;
                    syncAll(session.user.id).then(result => {
                        if (result.success && (result.pushed > 0 || result.pulled > 0)) {
                            getRecordings().then(data => {
                                setRecordings(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
                            });
                        }
                    });

                    // Désabonnement sécurisé (gère le cas où l'événement est appelé de manière synchrone via Babel)
                    if (typeof unsubscribe === 'function') {
                        unsubscribe();
                    } else {
                        setTimeout(() => {
                            if (typeof unsubscribe === 'function') unsubscribe();
                        }, 10);
                    }
                }
            });

            return () => {
                if (typeof unsubscribe === 'function') unsubscribe();
            };
        }
    }, [session]);

    async function loadRecordings() {
        // Cette fonction est maintenant un alias pour rafraîchir manuellement si besoin
        const data = await getRecordings();
        setRecordings(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }

    // Grouper les recordings avec useMemo pour éviter la recréation des références
    const { parentRecordings, childrenByParent } = useMemo(() => {
        const parents = recordings.filter(r => !r.parentId);
        const childrenMap = {};
        recordings.filter(r => r.parentId).forEach(child => {
            if (!childrenMap[child.parentId]) childrenMap[child.parentId] = [];
            childrenMap[child.parentId].push(child);
        });
        return { parentRecordings: parents, childrenByParent: childrenMap };
    }, [recordings]);

    // Extraction des tags uniques
    const availableTags = useMemo(() => {
        const uniqueTagIds = [...new Set(recordings.flatMap(r => r.tags || []))];
        return uniqueTagIds.map(getTagInfo).filter(Boolean);
    }, [recordings]);

    // Filtrage dynamique
    const filteredParentRecordings = useMemo(() => {
        return parentRecordings.filter(r => {
            if (!selectedFilterTag) return true; // pas de filtre
            return r.tags?.includes(selectedFilterTag);
        });
    }, [parentRecordings, selectedFilterTag]);

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

    const executeDelete = async (itemToDelete) => {
        if (!itemToDelete) return;

        try {
            await deleteRecording(itemToDelete.id);

            if (audioPlayer.currentTrack?.id === itemToDelete.id) {
                await audioPlayer.stop();
            }

            setRecordings(prev => prev.filter(rec => rec.id !== itemToDelete.id));
            if (dailyMemory?.id === itemToDelete.id) {
                setDailyMemory(null);
            }

            if (session?.user && (itemToDelete.dbId || itemToDelete.remoteUrl)) {
                const ok = await deleteRecordingFromCloud({
                    userId: session.user.id,
                    recording: itemToDelete,
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
            if (editingRecording?.id === itemToDelete.id) {
                handleEditCancel();
            }
        }
    };

    const handleDeleteItem = (item) => {
        const title = item?.title || 'cet enregistrement';
        if (Platform.OS === 'web') {
            if (window.confirm(`Supprimer "${title}" ?`)) {
                executeDelete(item);
            }
            return;
        }
        Alert.alert(
            'Supprimer',
            `Voulez-vous supprimer "${title}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: () => executeDelete(item) },
            ]
        );
    };

    const handleEditDelete = () => {
        if (editingRecording) {
            handleDeleteItem(editingRecording);
        }
    };

    // Callbacks stables pour RecordingItem
    const handleTogglePlay = useCallback((item) => {
        audioPlayer.toggle(item);
    }, [audioPlayer]);

    const handleOptions = useCallback((item) => {
        setSelectedOptionsItem(item);
    }, []);

    const renderItem = useCallback(({ item }) => (
        <RecordingItem
            item={item}
            isItemPlaying={audioPlayer.currentTrack?.id === item.id}
            audioPlayerIsPlaying={audioPlayer.isPlaying}
            childrenRecords={childrenByParent[item.id]}
            onTogglePlay={handleTogglePlay}
            onOptions={handleOptions}
            sessionUser={session?.user}
            activeChildId={audioPlayer.currentTrack?.id}
        />
    ), [audioPlayer.currentTrack?.id, audioPlayer.isPlaying, childrenByParent, handleTogglePlay, handleOptions, session?.user]);

    const renderListHeader = () => {
        const hasFilters = availableTags.length > 0;
        if (!dailyMemory && !hasFilters) return null;

        return (
            <View>
                {/* Pensée Souvenir */}
                <DailyMemoryCard
                    dailyMemory={dailyMemory}
                    isOpened={isDailyMemorySeen}
                    isPlaying={(audioPlayer.currentTrack?.id === dailyMemory?.id) && audioPlayer.isPlaying}
                    onTogglePlay={async () => {
                        if (!isDailyMemorySeen && session?.user) {
                            setIsDailyMemorySeen(true);
                            await setSeenDailyMemoryId(session.user.id, dailyMemory.id);
                        }
                        audioPlayer.play(dailyMemory);
                        audioPlayer.openModal();
                    }}
                />

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
                onOpenSettings={() => setDrawerOpen(true)}
                title="Historique"
                showLogo={false}
                rightContent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ArrowLeft size={16} color="#78350F" strokeWidth={2} style={{ marginRight: 4 }} />
                        <Text style={styles.backButtonText}>Retour</Text>
                    </TouchableOpacity>
                }
            />

            {isLoading ? (
                <View style={styles.listContent}>
                    {renderListHeader()}
                    {[...Array(6)].map((_, index) => (
                        <HistorySkeleton key={index} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={filteredParentRecordings}
                    extraData={[dailyMemory, isDailyMemorySeen]}
                    ListHeaderComponent={renderListHeader}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>Aucun enregistrement.</Text>}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                />
            )}

            {/* Modale d'options (...) */}
            <Modal
                visible={!!selectedOptionsItem}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedOptionsItem(null)}
            >
                <TouchableOpacity
                    style={styles.optionsOverlay}
                    activeOpacity={1}
                    onPress={() => setSelectedOptionsItem(null)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.optionsMenuContainer}>
                        <View style={styles.optionsMenuHeader}>
                            <Text style={styles.optionsMenuTitle} numberOfLines={1}>
                                {selectedOptionsItem?.title || 'Enregistrement'}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.optionItem} onPress={() => {
                            const item = selectedOptionsItem;
                            setSelectedOptionsItem(null);
                            handlePin(item);
                        }}>
                            <Pin size={20} color="#78350F" strokeWidth={1.5} fill={selectedOptionsItem?.pinned ? '#78350F' : 'transparent'} />
                            <Text style={styles.optionText}>{selectedOptionsItem?.pinned ? 'Détacher cette pensée' : 'Épingler en haut'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} onPress={() => {
                            const item = selectedOptionsItem;
                            setSelectedOptionsItem(null);
                            handleEdit(item);
                        }}>
                            <Pencil size={20} color="#78350F" strokeWidth={1.5} />
                            <Text style={styles.optionText}>Modifier</Text>
                        </TouchableOpacity>



                        <View style={styles.optionDivider} />

                        <TouchableOpacity style={styles.optionItem} onPress={() => {
                            const item = selectedOptionsItem;
                            setSelectedOptionsItem(null);
                            handleDeleteItem(item);
                        }}>
                            <Trash2 size={20} color="#DC2626" strokeWidth={1.5} />
                            <Text style={[styles.optionText, { color: '#DC2626' }]}>Supprimer l'enregistrement</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionCancelBtn} onPress={() => setSelectedOptionsItem(null)}>
                            <Text style={styles.optionCancelText}>Annuler</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

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
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#78716C',
        fontStyle: 'italic',
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
});
