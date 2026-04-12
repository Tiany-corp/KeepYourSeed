import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getRecordings, restoreRecording, permanentlyDeleteRecording } from '../services/storage';
import { restoreRecordingFromCloud, permanentlyDeleteFromCloud, fetchTrashRecordings } from '../services/cloud';
import { ArrowLeft, RotateCcw, Trash2, ShieldAlert } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import RecordingItem from '../components/history/RecordingItem';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAlert } from '../contexts/AlertContext';
import { AppContext } from '../contexts/AppContext';

export default function TrashScreen({ navigation }) {
    const { session } = useContext(AppContext);
    const [recordings, setRecordings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
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

    useEffect(() => {
        loadTrash();
    }, [loadTrash]);

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
                    recordings.length > 0 && (
                        <TouchableOpacity onPress={handleEmptyTrash} style={styles.emptyTrashBtn}>
                            <Trash2 size={18} color="#B91C1C" />
                        </TouchableOpacity>
                    )
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
                                onOptions={() => {}} // Pas d'options standards en corbeille
                                isTrashMode={true} // Nouveau flag pour adapter l'UI du composant
                                onRestore={() => handleRestore(item)}
                                onDeletePermanent={() => handlePermanentDelete(item)}
                            />
                        </Animated.View>
                    )}
                    ListEmptyComponent={renderEmptyState}
                />
            )}
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
});
