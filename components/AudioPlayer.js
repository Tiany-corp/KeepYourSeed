import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Play, Pause, X } from 'lucide-react-native';
import { getRelativeDate, formatTime } from '../utils/date';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

/**
 * Lecteur audio global (mini bar + modale).
 * Lit son état depuis AudioPlayerContext → persiste entre les écrans.
 * À placer dans App.js au-dessus de tous les écrans.
 */
export default function AudioPlayer() {
    const { currentTrack, isPlaying, position, duration, toggle, stop, modalVisible, openModal, closeModal } = useAudioPlayer();

    // Pas de track → rien à afficher
    if (!currentTrack) return null;

    const dismissToMiniPlayer = () => closeModal();

    const closePlayer = async () => {
        await stop();
    };

    return (
        <>
            {/* ═══ MINI PLAYER BAR (toujours visible quand un track est actif) ═══ */}
            {!modalVisible && (
                <TouchableOpacity
                    onPress={openModal}
                    activeOpacity={0.9}
                    style={styles.miniPlayerContainer}
                >
                    <View style={styles.miniPlayerRow}>
                        {/* Play/Pause mini */}
                        <TouchableOpacity
                            onPress={() => toggle()}
                            style={styles.miniPlayButton}
                        >
                            {isPlaying ? (
                                <Pause size={16} color="#FFFFFF" strokeWidth={1.5} />
                            ) : (
                                <Play size={16} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 2 }} />
                            )}
                        </TouchableOpacity>

                        {/* Info + progress */}
                        <View style={styles.miniPlayerInfo}>
                            <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                                {currentTrack.title || 'Sans titre'}
                            </Text>
                            <View style={styles.miniProgressBarTrack}>
                                <View
                                    style={[
                                        styles.miniProgressBarFill,
                                        {
                                            width: duration > 0
                                                ? `${(position / duration) * 100}%`
                                                : '0%',
                                        }
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Temps restant */}
                        <Text style={styles.miniPlayerTime}>
                            {formatTime(duration - position)}
                        </Text>

                        {/* Fermer (stoppe l'audio) */}
                        <TouchableOpacity onPress={closePlayer} style={styles.closeIconButton}>
                            <X size={16} color="#78716C" strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            )}

            {/* ═══ MODAL AUDIO PLAYER ═══ */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={dismissToMiniPlayer}
            >
                {/* Backdrop — tap pour réduire en mini player */}
                <Pressable
                    style={styles.backdrop}
                    onPress={dismissToMiniPlayer}
                >
                    {/* Carte player — empêche la propagation du tap */}
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={styles.modalCard}
                    >
                        {/* Bouton fermer (stoppe l'audio) */}
                        <TouchableOpacity
                            onPress={closePlayer}
                            style={styles.modalCloseButton}
                        >
                            <X size={20} color="#78716C" strokeWidth={1.5} />
                        </TouchableOpacity>

                        {/* Contenu centré */}
                        <View style={styles.modalContent}>
                            <Text style={styles.modalDateText}>
                                {getRelativeDate(currentTrack.date)}
                            </Text>

                            <Text style={styles.modalTitleText} numberOfLines={2}>
                                {currentTrack.title || 'Sans titre'}
                            </Text>

                            <TouchableOpacity
                                onPress={() => toggle()}
                                style={[
                                    styles.modalPlayButton,
                                    { backgroundColor: isPlaying ? '#B91C1C' : '#78350F' }
                                ]}
                            >
                                {isPlaying ? (
                                    <Pause size={32} color="#FFFFFF" strokeWidth={1.5} />
                                ) : (
                                    <Play size={32} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 4 }} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Barre de progression + temps */}
                        <View style={styles.progressContainer}>
                            <View style={styles.modalProgressBarTrack}>
                                <View
                                    style={[
                                        styles.modalProgressBarFill,
                                        {
                                            width: duration > 0
                                                ? `${(position / duration) * 100}%`
                                                : '0%',
                                        }
                                    ]}
                                />
                            </View>
                            <View style={styles.timeRow}>
                                <Text style={styles.timeText}>{formatTime(position)}</Text>
                                <Text style={styles.timeText}>{formatTime(duration)}</Text>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    miniPlayerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#D4A574', backgroundColor: '#F5F0E8', paddingHorizontal: 16, paddingVertical: 12 },
    miniPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    miniPlayButton: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#78350F', width: 36, height: 36 },
    miniPlayerInfo: { flex: 1 },
    miniPlayerTitle: { fontSize: 14, fontWeight: '500', color: '#292524' },
    miniProgressBarTrack: { width: '100%', height: 4, borderRadius: 9999, marginTop: 4, backgroundColor: '#E8E0D4' },
    miniProgressBarFill: { height: '100%', borderRadius: 9999, backgroundColor: '#D97706' },
    miniPlayerTime: { fontSize: 12, color: '#78716C' },
    closeIconButton: { padding: 4 },
    backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(41, 37, 36, 0.6)' },
    modalCard: { backgroundColor: '#F5F0E8', borderRadius: 24, borderWidth: 1, borderColor: '#D4A574', padding: 24, alignItems: 'center', width: 320, aspectRatio: 1 },
    modalCloseButton: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 10 },
    modalContent: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
    modalDateText: { fontSize: 12, color: '#D97706', fontWeight: '500', marginBottom: 8 },
    modalTitleText: { fontSize: 20, fontWeight: 'bold', color: '#292524', textAlign: 'center', marginBottom: 24 },
    modalPlayButton: { borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginBottom: 32, width: 72, height: 72 },
    progressContainer: { width: '100%' },
    modalProgressBarTrack: { width: '100%', height: 6, borderRadius: 9999, marginBottom: 8, backgroundColor: '#E8E0D4' },
    modalProgressBarFill: { height: '100%', borderRadius: 9999, backgroundColor: '#D97706' },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    timeText: { fontSize: 12, color: '#78716C' }
});
