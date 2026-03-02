import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Play, Pause, X } from 'lucide-react-native';
import { getRelativeDate, formatTime } from '../utils/date';

export default function AudioPlayer({
    showPlayer,
    isMemoryPlaying,
    dailyMemory,
    playbackPosition,
    playbackDuration,
    memorySoundRef,
    toggleMemoryPlayback,
    closePlayerModal,
    setShowPlayer,
    dismissToMiniPlayer,
}) {
    if (!dailyMemory) return null;

    return (
        <>
            {/* ═══ MINI PLAYER BAR (visible quand modal fermée + audio chargé) ═══ */}
            {!showPlayer && memorySoundRef.current && (
                <TouchableOpacity
                    onPress={() => setShowPlayer(true)}
                    activeOpacity={0.9}
                    className="border-t border-seed-border bg-seed-card px-4 py-3"
                >
                    <View className="flex-row items-center gap-3">
                        {/* Play/Pause mini */}
                        <TouchableOpacity
                            onPress={toggleMemoryPlayback}
                            className="rounded-seed items-center justify-center"
                            style={{ backgroundColor: '#78350F', width: 36, height: 36 }}
                        >
                            {isMemoryPlaying ? (
                                <Pause size={16} color="#FFFFFF" strokeWidth={1.5} />
                            ) : (
                                <Play size={16} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 2 }} />
                            )}
                        </TouchableOpacity>

                        {/* Info + progress */}
                        <View className="flex-1">
                            <Text className="text-sm font-medium text-seed-text" numberOfLines={1}>
                                {dailyMemory.title}
                            </Text>
                            <View className="w-full h-1 rounded-full mt-1" style={{ backgroundColor: '#E8E0D4' }}>
                                <View
                                    className="h-full rounded-full"
                                    style={{
                                        backgroundColor: '#D97706',
                                        width: playbackDuration > 0
                                            ? `${(playbackPosition / playbackDuration) * 100}%`
                                            : '0%',
                                    }}
                                />
                            </View>
                        </View>

                        {/* Temps restant */}
                        <Text className="text-xs text-seed-muted">
                            {formatTime(playbackDuration - playbackPosition)}
                        </Text>

                        {/* Fermer (stoppe l'audio) */}
                        <TouchableOpacity onPress={closePlayerModal} className="p-1">
                            <X size={16} color="#78716C" strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            )}

            {/* ═══ MODAL AUDIO PLAYER ═══ */}
            <Modal
                visible={showPlayer}
                transparent
                animationType="fade"
                onRequestClose={dismissToMiniPlayer}
            >
                {/* Backdrop — tap pour réduire en mini player */}
                <Pressable
                    className="flex-1 justify-center items-center"
                    style={{ backgroundColor: 'rgba(41, 37, 36, 0.6)' }}
                    onPress={dismissToMiniPlayer}
                >
                    {/* Carte player — empêche la propagation du tap */}
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="bg-seed-card rounded-seed border border-seed-border p-6 items-center"
                        style={{ width: 320, aspectRatio: 1 }}
                    >
                        {/* Bouton fermer (stoppe l'audio) */}
                        <TouchableOpacity
                            onPress={closePlayerModal}
                            className="absolute top-3 right-3 p-1"
                            style={{ zIndex: 10 }}
                        >
                            <X size={20} color="#78716C" strokeWidth={1.5} />
                        </TouchableOpacity>

                        {/* Contenu centré */}
                        <View className="flex-1 justify-center items-center w-full">
                            <Text className="text-xs text-seed-accent font-medium mb-2">
                                {getRelativeDate(dailyMemory.date)}
                            </Text>

                            <Text className="text-xl font-bold text-seed-text text-center mb-6" numberOfLines={2}>
                                {dailyMemory.title || 'Souvenir'}
                            </Text>

                            <TouchableOpacity
                                onPress={toggleMemoryPlayback}
                                className="rounded-full items-center justify-center mb-8"
                                style={{
                                    backgroundColor: isMemoryPlaying ? '#B91C1C' : '#78350F',
                                    width: 72,
                                    height: 72,
                                }}
                            >
                                {isMemoryPlaying ? (
                                    <Pause size={32} color="#FFFFFF" strokeWidth={1.5} />
                                ) : (
                                    <Play size={32} color="#FFFFFF" strokeWidth={1.5} style={{ marginLeft: 4 }} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Barre de progression + temps */}
                        <View className="w-full">
                            <View className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: '#E8E0D4' }}>
                                <View
                                    className="h-full rounded-full"
                                    style={{
                                        backgroundColor: '#D97706',
                                        width: playbackDuration > 0
                                            ? `${(playbackPosition / playbackDuration) * 100}%`
                                            : '0%',
                                    }}
                                />
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-xs text-seed-muted">{formatTime(playbackPosition)}</Text>
                                <Text className="text-xs text-seed-muted">{formatTime(playbackDuration)}</Text>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
