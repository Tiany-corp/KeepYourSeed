import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Play, Pause, X } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    SlideInDown,
    FadeOutDown,
    FadeInUp,
    FadeOutUp,
    FadeInDown
} from 'react-native-reanimated';
import { getRelativeDate, formatTime } from '../utils/date';
import { useAudioPlayer, useAudioProgress } from '../contexts/AudioPlayerContext';
import AnimatedPlayButton from './AnimatedPlayButton';

export default function AudioPlayer() {
    const { currentTrack, isPlaying, duration, toggle, stop, seekTo, modalVisible, openModal, closeModal } = useAudioPlayer();
    const position = useAudioProgress();
    const [miniProgressWidth, setMiniProgressWidth] = useState(0);
    const [modalProgressWidth, setModalProgressWidth] = useState(0);
    // -----------------------------------

    // Défi créer une barre de progression avec react native ranimated pour ma barre de progression

    // Plan ?? à quoi sert react native reanimated => faire des animations fluides I guess ? => oui
    // Objectif : mettre à jour toute les milliseconde la position au lieu de la mettre à jour toute les 10 milliseconde
    // Je stocke la position du curseur à 0 
    //Si l'audio est activé je démarre la position qui change à +1
    // Augmenter la position à +1 tant que l'audio est en train de lire ?


    // Progression fluide via Reanimated
    const animatedPosition = useSharedValue(0); // J'instancie mon objet dans le même état que useSharedValue

    useEffect(() => {
        if (!isPlaying || position === 0) { // Si je ne suis pas en train de jouer et que la position est égale à 0 => je met la valeur de animated position à 0.
            animatedPosition.value = position;
            return;
        }

        const diff = Math.abs(position - animatedPosition.value); // Je créer une variable diff qui stocke le return de la méthode Math.abs qui prend en entrée la soustraction entre la variable position et la valeur de la position partagée. Cette valeure d'entrée est un chiffre.
        if (diff > 1000) {
            // Saut important (Seek ou changement de piste)
            animatedPosition.value = position;
        } else {
            // Interpolation linéaire pour fluidifier le mouvement entre deux status updates
            animatedPosition.value = withTiming(position, {
                duration: 600, // Légèrement supérieur à l'intervalle de mise à jour pour la fluidité
                easing: Easing.linear
            });
        }
    }, [position, isPlaying]);

    const animatedProgressStyle = useAnimatedStyle(() => {
        const pct = duration > 0 ? (animatedPosition.value / duration) * 100 : 0;
        return {
            width: `${Math.min(100, Math.max(0, pct))}%`,
        };
    });

    // Je sauvegarde la position du curseur dans une variable qui stockeras la position sous forme de seconde ? => oui je pense
    // --------------------------

    const dismissToMiniPlayer = () => closeModal();

    const closePlayer = async () => {
        await stop();
    };

    const handleSeek = async (locationX, trackWidth) => {
        if (!duration || !trackWidth) return;
        const ratio = Math.max(0, Math.min(locationX / trackWidth, 1));
        await seekTo(ratio * duration);
    };

    return (
        <>
            {/* ═══ MINI PLAYER BAR (toujours visible quand un track est actif) ═══ */}
            {(!modalVisible && currentTrack) && (
                <Animated.View
                    entering={SlideInDown.duration(300).easing(Easing.out(Easing.ease))}
                    exiting={FadeOutDown.duration(200)}
                    style={styles.miniPlayerContainer}
                >
                    <View style={styles.miniPlayerRow}>
                        {/* Play/Pause mini */}
                        <TouchableOpacity
                            onPress={() => toggle()}
                            style={styles.miniPlayButton}
                        >
                            <AnimatedPlayButton isPlaying={isPlaying} size={16} color="#FFFFFF" strokeWidth={1.5} />
                        </TouchableOpacity>

                        {/* Info + progress — tap pour ouvrir la modale */}
                        <TouchableOpacity
                            onPress={openModal}
                            activeOpacity={0.7}
                            style={styles.miniPlayerInfo}
                        >
                            <Animated.Text
                                key={currentTrack.id}
                                entering={FadeInDown.duration(300)}
                                exiting={FadeOutUp.duration(300)}
                                style={styles.miniPlayerTitle}
                                numberOfLines={1}
                            >
                                {currentTrack.title || 'Sans titre'}
                            </Animated.Text>
                            <Pressable
                                style={styles.miniProgressBarTrack}
                                onLayout={(e) => setMiniProgressWidth(e.nativeEvent.layout.width)}
                                onPress={(e) => handleSeek(e.nativeEvent.locationX, miniProgressWidth)}
                            >
                                <Animated.View
                                    style={[
                                        styles.miniProgressBarFill,
                                        animatedProgressStyle
                                    ]}
                                />
                            </Pressable>
                        </TouchableOpacity>

                        {/* Temps écoulé / total */}
                        <Text style={styles.miniPlayerTime}>
                            {formatTime(duration)}
                        </Text>

                        {/* Fermer (stoppe l'audio) */}
                        <TouchableOpacity onPress={closePlayer} style={styles.closeIconButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={16} color="#78716C" strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* ═══ MODAL AUDIO PLAYER ═══ */}
            <Modal
                visible={modalVisible && !!currentTrack}
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
                        {currentTrack && (
                            <View style={styles.modalContent}>
                                <Animated.Text
                                    key={`date-${currentTrack.id}`}
                                    entering={FadeInUp.duration(300)}
                                    exiting={FadeOutUp.duration(300)}
                                    style={styles.modalDateText}
                                >
                                    {getRelativeDate(currentTrack.date)}
                                </Animated.Text>

                                <Animated.Text
                                    key={`title-${currentTrack.id}`}
                                    entering={FadeInUp.duration(300).delay(50)}
                                    exiting={FadeOutUp.duration(300)}
                                    style={styles.modalTitleText}
                                    numberOfLines={2}
                                >
                                    {currentTrack.title || 'Sans titre'}
                                </Animated.Text>

                                <TouchableOpacity
                                    onPress={() => toggle()}
                                    style={[
                                        styles.modalPlayButton,
                                        { backgroundColor: isPlaying ? '#B91C1C' : '#78350F' }
                                    ]}
                                >
                                    <AnimatedPlayButton isPlaying={isPlaying} size={32} color="#FFFFFF" strokeWidth={1.5} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Barre de progression + temps */}
                        <View style={styles.progressContainer}>
                            <Pressable
                                style={styles.modalProgressBarTrack}
                                onLayout={(e) => setModalProgressWidth(e.nativeEvent.layout.width)}
                                onPress={(e) => handleSeek(e.nativeEvent.locationX, modalProgressWidth)}
                            >
                                <Animated.View
                                    style={[
                                        styles.modalProgressBarFill,
                                        animatedProgressStyle
                                    ]}
                                />
                            </Pressable>
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
