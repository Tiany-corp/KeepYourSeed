import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform, ActivityIndicator, Modal, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getRecordings, restoreRecording, permanentlyDeleteRecording, markAsKeepLocalOnly } from '../services/storage';
import { restoreRecordingFromCloud, permanentlyDeleteFromCloud, fetchTrashRecordings } from '../services/cloud';
import { purgeHardDeletedCloudItems, getOrphanedCloudItems } from '../services/sync';
import { ArrowLeft, RotateCcw, Trash2, ShieldAlert, CloudOff, CheckSquare, Square, ShieldCheck } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import RecordingItem from '../components/history/RecordingItem';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';
import { AppContext } from '../contexts/AppContext';

export default function TrashScreen({ navigation }) {
    const { session } = useContext(AppContext);
    const [recordings, setRecordings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- États pour les orphelins ---
    const [orphans, setOrphans] = useState([]);
    const [isCheckingOrphans, setIsCheckingOrphans] = useState(false);
    const [showOrphansModal, setShowOrphansModal] = useState(false);
    const [selectedOrphans, setSelectedOrphans] = useState(new Set());

    const audioPlayer = useAudioPlayer();
    const { showAlert } = useAlert();

    const loadTrash = useCallback(async () => {
        setIsLoading(true);
        try {
            // Approche Pure Local-First : on lit ce qui est sur le téléphone
            const allLocal = await getRecordings();
            const localTrash = allLocal.filter(r => r.deletedAt);
            setRecordings(localTrash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)));
        } catch (e) {
            console.error('Failed to load trash:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const checkOrphans = useCallback(async () => {
        if (!session?.user?.id) return;
        setIsCheckingOrphans(true);
        const result = await getOrphanedCloudItems(session.user.id);
        if (result.success) {
            setOrphans(result.orphans);
        }
        setIsCheckingOrphans(false);
    }, [session?.user?.id]);

    useEffect(() => {
        loadTrash();
        checkOrphans();
    }, [loadTrash, checkOrphans]);

    const handleRestore = async (item) => {
        try {
            await restoreRecording(item.id);
            if (session?.user) {
                await restoreRecordingFromCloud({ userId: session.user.id, recording: item });
            }
            setRecordings(prev => prev.filter(r => r.id !== item.id));
            showAlert('Restaurée', `"${item.title}" est de retour dans ton historique.`, 'success');
        } catch (e) {
            showAlert('Erreur', 'Impossible de restaurer la note.', 'error');
        }
    };

    const handlePermanentDelete = (item) => {
        const title = item?.title || 'cet enregistrement';
        const confirmMsg = `Supprimer définitivement "${title}" ? Cette action est irréversible.`;

        const executePermanentDelete = async () => {
            try {
                await permanentlyDeleteRecording(item.id);
                if (session?.user) {
                    await permanentlyDeleteFromCloud({ userId: session.user.id, recording: item });
                }
                setRecordings(prev => prev.filter(r => r.id !== item.id));
                showAlert('Supprimée', 'Note effacée définitivement.', 'success');
            } catch (e) {
                showAlert('Erreur', 'Échec de la suppression définitive.', 'error');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) executePermanentDelete();
        } else {
            Alert.alert('Suppression Définitive', confirmMsg, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: executePermanentDelete }
            ]);
        }
    };

    const handleEmptyTrash = () => {
        if (recordings.length === 0) return;

        const confirmMsg = `Vider la corbeille (${recordings.length} notes) ? Tout sera supprimé définitivement.`;

        const executeEmpty = async () => {
            setIsLoading(true);
            try {
                for (const rec of recordings) {
                    await permanentlyDeleteRecording(rec.id);
                    if (session?.user) {
                        await permanentlyDeleteFromCloud({ userId: session.user.id, recording: rec });
                    }
                }
                setRecordings([]);
                showAlert('Corbeille vidée', 'Toutes les notes ont été supprimées.', 'success');
            } catch (e) {
                showAlert('Erreur', 'Une erreur est survenue lors du vidage.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) executeEmpty();
        } else {
            Alert.alert('Vider la corbeille', confirmMsg, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Tout supprimer', style: 'destructive', onPress: executeEmpty }
            ]);
        }
    };

    const openOrphansModal = () => {
        if (orphans.length === 0) return;
        setSelectedOrphans(new Set(orphans.map(o => o.id))); // Sélectionne tout par défaut
        setShowOrphansModal(true);
    };

    const toggleOrphanSelection = (id) => {
        setSelectedOrphans(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const executePurgeOrphans = async () => {
        if (selectedOrphans.size === 0) return;
        setShowOrphansModal(false);
        setIsLoading(true);
        try {
            const idsToPurge = Array.from(selectedOrphans);
            const result = await purgeHardDeletedCloudItems(session?.user?.id, idsToPurge);
            if (result.success) {
                showAlert('Nettoyage', `${idsToPurge.length} fichiers orphelins purgés.`, 'success');
                loadTrash();
                checkOrphans(); // Revérifier les orphelins restants
            }
        } catch (e) {
            console.error('Hard purge fail:', e);
            showAlert('Erreur', 'Impossible de purger les orphelins.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeepOrphan = async (item) => {
        try {
            await markAsKeepLocalOnly(item.id);
            setOrphans(prev => prev.filter(o => o.id !== item.id));
            showAlert('Gardé', `"${item.title}" sera conservé en local uniquement.`, 'success');
            
            // Si c'était le dernier orphelin, on ferme la modale
            if (orphans.length <= 1) {
                setShowOrphansModal(false);
            }
        } catch (e) {
            showAlert('Erreur', 'Impossible de modifier le statut de la note.', 'error');
        }
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <RotateCcw size={64} color="#D4A574" strokeWidth={1} style={{ marginBottom: 16, opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>Ta corbeille est vide</Text>
            <Text style={styles.emptySubtitle}>
                Les pensées que tu supprimes apparaîtront ici avant d'être définitivement effacées.
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Ma Corbeille"
                showLogo={false}
                leftContent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ArrowLeft size={20} color="#78350F" />
                    </TouchableOpacity>
                }
                rightContent={
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={openOrphansModal}
                            disabled={orphans.length === 0 || isCheckingOrphans}
                            style={[
                                styles.emptyTrashBtn,
                                { backgroundColor: '#F5F5F5', marginRight: 12 },
                                (orphans.length === 0 || isCheckingOrphans) && { opacity: 0.4 }
                            ]}
                        >
                            {isCheckingOrphans ? (
                                <ActivityIndicator size="small" color="#78716C" />
                            ) : (
                                <CloudOff size={18} color="#78716C" />
                            )}
                        </TouchableOpacity>
                        {recordings.length > 0 && (
                            <TouchableOpacity onPress={handleEmptyTrash} style={styles.emptyTrashBtn}>
                                <Trash2 size={18} color="#B91C1C" />
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />

            <View style={styles.infoBanner}>
                <ShieldAlert size={16} color="#78350F" style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>Les notes sont conservées ici pour être restaurées en cas d'erreur.</Text>
            </View>

            {isLoading && recordings.length === 0 ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#78350F" />
                </View>
            ) : (
                <FlatList
                    data={recordings}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => (
                        <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
                            <RecordingItem
                                item={item}
                                isPlaying={audioPlayer.currentTrack?.id === item.id && audioPlayer.isPlaying}
                                onTogglePlay={() => audioPlayer.play(item)}
                                onOptions={() => { }} // Pas d'options standards en corbeille
                                isTrashMode={true} // Nouveau flag pour adapter l'UI du composant
                                onRestore={() => handleRestore(item)}
                                onDeletePermanent={() => handlePermanentDelete(item)}
                            />
                        </Animated.View>
                    )}
                    ListEmptyComponent={renderEmptyState}
                />
            )}

            {/* Modale de sélection des orphelins */}
            <Modal
                visible={showOrphansModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowOrphansModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nettoyage Cloud</Text>
                            <Text style={styles.modalSubtitle}>Ces fichiers n'existent plus sur ton Cloud mais sont toujours sur ton téléphone. Clique sur "Purger" si tu veux aussi les supprimer sur ton téléphone.</Text>
                        </View>

                        <ScrollView style={styles.modalList}>
                            {orphans.map(item => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.orphanRow}
                                    onPress={() => toggleOrphanSelection(item.id)}
                                >
                                    {selectedOrphans.has(item.id) ? (
                                        <CheckSquare size={20} color="#78350F" />
                                    ) : (
                                        <Square size={20} color="#D6D3D1" />
                                    )}
                                    <View style={styles.orphanInfo}>
                                        <Text style={styles.orphanTitle} numberOfLines={1}>{item.title}</Text>
                                        <Text style={styles.orphanDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.keepBtn} 
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleKeepOrphan(item);
                                        }}
                                    >
                                        <ShieldCheck size={14} color="#10B981" />
                                        <Text style={styles.keepBtnText}>Garder en local</Text>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowOrphansModal(false)}>
                                <Text style={styles.modalCancelTxt}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, selectedOrphans.size === 0 && { opacity: 0.5 }]}
                                onPress={executePurgeOrphans}
                                disabled={selectedOrphans.size === 0}
                            >
                                <Text style={styles.modalConfirmTxt}>Purger ({selectedOrphans.size})</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF7F2',
    },
    backButton: {
        padding: 8,
    },
    emptyTrashBtn: {
        padding: 8,
        backgroundColor: '#FEE2E2',
        borderRadius: 20,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F5F0E8',
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    infoText: {
        fontSize: 12,
        color: '#78350F',
        flex: 1,
        lineHeight: 16,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#78350F',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#78716C',
        textAlign: 'center',
        lineHeight: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FAF7F2',
        borderRadius: 16,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    modalHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E8D5BF',
        backgroundColor: '#F5F0E8',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#78350F',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#78716C',
        lineHeight: 18,
    },
    modalList: {
        padding: 10,
    },
    orphanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F0E8',
    },
    orphanInfo: {
        marginLeft: 12,
        flex: 1,
    },
    orphanTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#3F3F46',
        marginBottom: 2,
    },
    orphanDate: {
        fontSize: 12,
        color: '#A8A29E',
    },
    keepBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1FAE5',
        marginLeft: 8,
    },
    keepBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
        marginLeft: 4,
    },
    modalActions: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E8D5BF',
        backgroundColor: '#FFFFFF',
    },
    modalCancelBtn: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
        marginRight: 8,
        backgroundColor: '#F5F5F5',
    },
    modalCancelTxt: {
        color: '#57534E',
        fontWeight: '600',
        fontSize: 15,
    },
    modalConfirmBtn: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
        marginLeft: 8,
        backgroundColor: '#B91C1C',
    },
    modalConfirmTxt: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 15,
    },
});
