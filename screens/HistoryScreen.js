import { useState, useEffect, useContext, useMemo, useCallback, memo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform, Modal } from 'react-native';
import Animated, { useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { getRecordings, getDailyMemory, setPinnedThought, updateRecording, deleteRecording } from '../services/storage';
import { updateRecordingMetadataInDatabase, deleteRecordingFromCloud } from '../services/cloud';
import { syncAll } from '../services/sync';
import { Play, Pause, ArrowLeft, Pin, Pencil, MoreVertical, Trash2, Cloud, CloudOff } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import Logo from '../components/Logo';
import TagFilterBar from '../components/TagFilterBar';
import TitleModal from '../components/TitleModal';
import { AVAILABLE_TAGS } from '../components/TitleModal';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';
import { useNavigation } from '@react-navigation/native';
import { AppContext } from '../contexts/AppContext';

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

const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} • ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Composant pur mémorisé responsable de la performance de la FlatList
// Il ne sera re-rendu QUE si ses props (isItemPlaying, etc) changent.
const RecordingItem = memo(({ item, isItemPlaying, audioPlayerIsPlaying, childrenRecords, onTogglePlay, onOptions, sessionUser, activeChildId }) => {
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

    return (
        <>
            <View style={styles.itemContainer}>
                <TouchableOpacity style={styles.item} onPress={() => onTogglePlay(item)}>
                    <View style={[styles.playButtonIcon, isItemPlaying && styles.playButtonIconActive]}>
                        {isItemPlaying && audioPlayerIsPlaying ? (
                            <Pause size={18} color="#FFFFFF" strokeWidth={1.5} />
                        ) : (
                            <Play size={18} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 3 }} />
                        )}
                    </View>
                    <View style={styles.itemInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                            {item.pinned && <Pin size={12} color="#D97706" style={{ marginRight: 6 }} fill="#D97706" />}
                            <Text style={[styles.itemTitle, { flex: 1 }]} numberOfLines={1}>{item.title || 'Sans titre'}</Text>
                            
                            {/* Indicateur de synchro */}
                            {sessionUser && (
                                <View style={{ marginLeft: 6 }}>
                                    {item.status === 'synced' ? (
                                        <Cloud size={14} color="#10B981" opacity={0.6} /> 
                                    ) : (
                                        <CloudOff size={14} color="#78716C" opacity={0.4} />
                                    )}
                                </View>
                            )}
                        </View>
                        <View style={styles.metaLineContainer}>
                            <Text style={styles.itemDate} numberOfLines={1}>{formatDate(item.date)}</Text>
                            <View style={{ flex: 1 }} />
                            <Text style={styles.itemDuration}>{formatDuration(item.duration)}</Text>
                        </View>
                        {item.tags && item.tags.length > 0 && renderTags(item.tags)}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.optionsButton}
                    onPress={() => onOptions(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <MoreVertical size={20} color="#78716C" strokeWidth={2} />
                </TouchableOpacity>
            </View>

            {/* Enfants connectés */}
            {childrenRecords && childrenRecords.length > 0 && (
                <View style={styles.childrenRow}>
                    {childrenRecords.map(child => {
                        const isChildPlaying = child.id === activeChildId;
                        return (
                            <TouchableOpacity
                                key={child.id}
                                style={[styles.childSquare, isChildPlaying && styles.childSquareActive]}
                                onPress={() => onTogglePlay(child)}
                                activeOpacity={0.7}
                            >
                                <Logo size={18} color={isChildPlaying ? '#FFFFFF' : '#78350F'} variant="outline" />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </>
    );
});

// Squelette de chargement avec animation fluide (Pulse)
const HistorySkeleton = () => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={styles.itemContainer}>
            <Animated.View style={[styles.item, styles.skeletonItem, animatedStyle]}>
                <View style={styles.skeletonPlayIcon} />
                <View style={[styles.itemInfo, { gap: 8 }]}>
                    <View style={styles.skeletonTitle} />
                    <View style={styles.skeletonDate} />
                    <View style={styles.tagsRow}>
                        <View style={styles.skeletonTag} />
                        <View style={styles.skeletonTag} />
                    </View>
                </View>
            </Animated.View>
            <View style={{ width: 40 }} />
        </View>
    );
};

export default function HistoryScreen() {
    const { session, setDrawerOpen } = useContext(AppContext);
    const navigation = useNavigation();
    const [recordings, setRecordings] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // État de chargement initial
    const [dailyMemory, setDailyMemory] = useState(null);
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
            
            // Simuler un léger délai pour que l'animation du squelette soit visible 
            // (retirer le setTimeout en prod si la DB est instantanée)
            setTimeout(() => {
                setIsLoading(false);
            }, 400);

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
            getDailyMemory(session.user.id).then(setDailyMemory);
            
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
                {dailyMemory && (
                    <View style={styles.dailyMemorySection}>
                        <Text style={styles.dailyMemoryHeaderTitle}>Pensée souvenir ⏳</Text>
                        <TouchableOpacity style={styles.dailyMemoryCard} onPress={() => { audioPlayer.play(dailyMemory); audioPlayer.openModal(); }}>
                            <Logo size={28} color="#D97706" variant="outline" style={styles.dailyMemoryLogo} />
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemTitle}>{dailyMemory.title || 'Un souvenir t\'attend'}</Text>
                                <Text style={styles.itemDate}>{formatDate(dailyMemory.date)}</Text>
                            </View>
                            <View style={[styles.playButtonIcon, (audioPlayer.currentTrack?.id === dailyMemory.id) && styles.playButtonIconActive]}>
                                {(audioPlayer.currentTrack?.id === dailyMemory.id) && audioPlayer.isPlaying ? (
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
    optionsButton: {
        paddingHorizontal: 8,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Options Menu Styles
    optionsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    optionsMenuContainer: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Safe area bottom
        paddingTop: 8,
    },
    optionsMenuHeader: {
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    optionsMenuTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#292524',
        textAlign: 'center',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    optionText: {
        fontSize: 16,
        color: '#292524',
        marginLeft: 16,
        fontWeight: '500',
    },
    optionDivider: {
        height: 1,
        backgroundColor: '#F5F5F5',
        marginVertical: 4,
    },
    optionCancelBtn: {
        marginTop: 8,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        marginHorizontal: 16,
        borderRadius: 12,
    },
    optionCancelText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#78716C',
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
    // Styles pour les Skeletons
    skeletonItem: {
        borderColor: '#E8E0D4',
        shadowOpacity: 0,
    },
    skeletonPlayIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E8E0D4',
        marginRight: 12,
    },
    skeletonTitle: {
        height: 16,
        width: '60%',
        backgroundColor: '#E8E0D4',
        borderRadius: 8,
    },
    skeletonDate: {
        height: 12,
        width: '40%',
        backgroundColor: '#E8E0D4',
        borderRadius: 6,
    },
    skeletonTag: {
        height: 18,
        width: 50,
        backgroundColor: '#E8E0D4',
        borderRadius: 9,
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
