import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TouchableOpacity } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring
} from 'react-native-reanimated';
import { Pin, MoreVertical, Cloud, CloudOff, RotateCcw, Trash2, AlertCircle } from 'lucide-react-native';
import Logo from '../Logo';
import AnimatedPlayButton from '../AnimatedPlayButton';
import { getTagInfo } from '../../utils/tags';
import { formatDateWithTime, formatSecondsDuration } from '../../utils/date';

/**
 * Composant pur mémorisé responsable de la performance de la FlatList.
 * Il ne sera re-rendu QUE si ses props (isItemPlaying, etc) changent.
 */
const RecordingItem = memo(({
    item,
    isItemPlaying,
    audioPlayerIsPlaying,
    childrenRecords,
    onTogglePlay,
    onOptions,
    sessionUser,
    activeChildId,
    isLoading,
    isTrashMode = false,
    onRestore,
    onDeletePermanent
}) => {
    const optionsRef = useRef(null);

    const handleOptionsPress = () => {
        if (optionsRef.current) {
            optionsRef.current.measure((x, y, width, height, pageX, pageY) => {
                onOptions(item, { x, y, width, height, pageX, pageY });
            });
        }
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

    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    // Force la réinitialisation instantanée si l'instance du composant est recyclée pour un autre item
    useEffect(() => {
        scale.value = 1;
    }, [item.id]);

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 40, stiffness: 400, mass: 0.5, overshootClamping: true });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 40, stiffness: 400, mass: 0.5, overshootClamping: true });
    };

    return (
        <>
            <Animated.View style={[styles.itemContainer, animatedStyle]}>
                <Pressable
                    style={styles.item}
                    onPress={() => onTogglePlay(item)}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                >
                    <View style={[styles.playButtonIcon, (isItemPlaying || isLoading) && styles.playButtonIconActive]}>
                        <AnimatedPlayButton
                            key={item.id}
                            isPlaying={isItemPlaying && audioPlayerIsPlaying}
                            size={18}
                            color="#FFFFFF"
                            strokeWidth={1.5}
                        />
                    </View>
                    <View style={styles.itemInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                            {item.pinned && <Pin size={12} color="#D97706" style={{ marginRight: 6 }} fill="#D97706" />}
                            <Text style={[styles.itemTitle, { flex: 1 }]} numberOfLines={1}>{item.title || 'Sans titre'}</Text>

                            {/* Indicateur de synchro (caché en mode corbeille pour plus de clarté) */}
                            {sessionUser && !isTrashMode && (
                                <View style={styles.statusIcons}>
                                    {item.status === 'error' && (
                                        <AlertCircle size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                    )}
                                    {item.dbId ? (
                                        <Cloud size={14} color={item.status === 'error' ? "#EF4444" : "#10B981"} opacity={0.6} />
                                    ) : (
                                        <CloudOff size={14} color="#78716C" opacity={0.4} />
                                    )}
                                </View>
                            )}
                        </View>
                        <View style={styles.metaLineContainer}>
                            <Text style={styles.itemDate} numberOfLines={1}>{formatDateWithTime(item.date)}</Text>
                            <View style={{ flex: 1 }} />
                            <Text style={styles.itemDuration}>{formatSecondsDuration(item.duration)}</Text>
                        </View>
                        {item.tags && item.tags.length > 0 && renderTags(item.tags)}
                    </View>
                </Pressable>

                {!isTrashMode ? (
                    <Pressable
                        ref={optionsRef}
                        style={styles.optionsButton}
                        onPress={handleOptionsPress}
                        onPressIn={handlePressIn}
                        onPressOut={handlePressOut}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <MoreVertical size={20} color="#78716C" strokeWidth={2} />
                    </Pressable>
                ) : (
                    <View style={styles.trashActions}>
                        <TouchableOpacity
                            style={[styles.trashActionBtn, { backgroundColor: '#E7E5E4' }]}
                            onPress={() => onRestore(item)}
                        >
                            <RotateCcw size={18} color="#78350F" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.trashActionBtn, { backgroundColor: '#FEE2E2' }]}
                            onPress={() => onDeletePermanent(item)}
                        >
                            <Trash2 size={18} color="#B91C1C" />
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>

            {/* Enfants connectés */}
            {childrenRecords && childrenRecords.length > 0 && (
                <View style={styles.childrenRow}>
                    {childrenRecords.map(child => {
                        const isChildPlaying = child.id === activeChildId;
                        return (
                            <Pressable
                                key={child.id}
                                style={[styles.childSquare, isChildPlaying && styles.childSquareActive]}
                                onPress={() => onTogglePlay(child)}
                                onPressIn={handlePressIn}
                                onPressOut={handlePressOut}
                            >
                                <Logo size={18} color={isChildPlaying ? '#FFFFFF' : '#78350F'} variant="outline" />
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </>
    );
});

const styles = StyleSheet.create({
    trashActions: {
        flexDirection: 'row',
        gap: 8,
    },
    trashActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D4A574',
        shadowColor: "#000",
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
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    tagPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: '#FAF7F2',
        borderRadius: 10,
        borderWidth: 0.5,
        borderColor: '#D4A574',
    },
    tagPillText: {
        fontSize: 10,
        color: '#78350F',
        fontWeight: '500',
    },
    optionsButton: {
        paddingHorizontal: 8,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    childrenRow: {
        flexDirection: 'row',
        paddingLeft: 52, // Align with the start of item title (matches original)
        paddingBottom: 8,
        gap: 8,
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
    statusIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 6,
    },
});

export default RecordingItem;
