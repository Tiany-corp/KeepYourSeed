import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { ArrowLeft, Network, GitMerge, Apple, Play, Mic } from 'lucide-react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { getRecordings, saveRecording } from '../services/storage';
import { syncAll } from '../services/sync';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { AppContext } from '../contexts/AppContext';
import { useAlert } from '../contexts/AlertContext';
import useAudioRecorder from '../hooks/useAudioRecorder';
import AppHeader from '../components/AppHeader';
import Logo from '../components/Logo';
import TitleModal from '../components/TitleModal';
import { formatDateWithTime } from '../utils/date';
import Svg, { Path } from 'react-native-svg';

export default function TreeDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const isFocused = useIsFocused();
    const audioPlayer = useAudioPlayer();
    const { width, height } = useWindowDimensions();

    const { session, updateStreak } = useContext(AppContext);
    const { showAlert } = useAlert();
    const { isRecording, duration, startRecording, stopRecording, formatDuration } = useAudioRecorder();

    const [showTitleModal, setShowTitleModal] = useState(false);
    const [pendingRecording, setPendingRecording] = useState(null);

    const tree = route.params?.tree;

    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [freshTree, setFreshTree] = useState(tree);

    useEffect(() => {
        if (tree?.id && isFocused) {
            loadData();
        }
    }, [tree?.id, isFocused]);

    const loadData = async () => {
        setLoading(true);
        try {
            const allRecordings = await getRecordings();

            const updatedTree = allRecordings.find(r => r.id === tree.id);
            if (updatedTree) setFreshTree(updatedTree);

            const treeChildren = allRecordings.filter(r =>
                !r.deletedAt &&
                (r.parentId === tree.id || (r.parentId && r.parentId.toString() === tree.dbId?.toString()))
            ).sort((a, b) => new Date(a.date) - new Date(b.date));

            setChildren(treeChildren);
        } catch (e) {
            console.error('Erreur chargement détail arbre:', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = (recording) => {
        audioPlayer.play(recording);
        audioPlayer.openModal();
    };

    if (!freshTree) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Arbre introuvable.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={{ color: '#D97706' }}>Retour</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const roots = children.filter(c => c.graftType === 'root');
    const fruits = children.filter(c => c.graftType === 'fruit');
    const leaves = children.filter(c => !c.graftType || c.graftType === 'leaf');

    const waterCount = freshTree.waterCount || 0;
    const trunkThickness = Math.min(6 + (waterCount * 1.5), 24);

    // CALCUL DES COORDONNÉES ET DIMENSIONS
    const rootDepth = Math.max(120, Math.ceil(roots.length / 2) * 70 + 80);
    const leavesHeight = Math.max(100, Math.ceil(leaves.length / 2) * 40 + 80);
    const fruitsHeight = Math.max(100, Math.ceil(fruits.length / 2) * 100 + 60);
    const baseCanvasHeight = rootDepth + leavesHeight + fruitsHeight + 80;
    const canvasHeight = Math.max(baseCanvasHeight, height);

    const trunkX = width / 2;
    const trunkY = leavesHeight + fruitsHeight + 40;
    
    const isSeed = roots.length === 0;
    const baseOriginY = isSeed ? trunkY + 70 : trunkY;

    const nodes = [];
    const paths = [];

    // PLACEMENT RACINES (Regroupées en dessous du tronc)
    roots.forEach((r, i) => {
        const row = Math.floor(i / 2);
        const nY = trunkY + 100 + row * 70 + (i % 2 === 0 ? 0 : 30);

        const sideOffset = (i % 2 === 0 ? -1 : 1) * (40 + row * 60);
        const nX = trunkX + sideOffset;
        nodes.push({ ...r, x: nX, y: nY, type: 'root' });

        const cp1x = trunkX;
        const cp1y = trunkY + 40; // La racine descend d'abord tout droit
        const cp2x = nX;
        const cp2y = nY - 40;
        paths.push({
            d: `M ${trunkX},${trunkY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${nX},${nY}`,
            color: '#78350F', // Même couleur que le tronc
            width: 6 // Plus épaisse
        });
    });

    // PLACEMENT FEUILLES (Comme une fleur, rayonnant autour du tronc)
    let highestLeafY = baseOriginY - 50;
    leaves.forEach((l, i) => {
        const row = Math.floor(i / 2);
        const isLeft = i % 2 === 0;
        const nY = baseOriginY - 50 - row * 40 - (isLeft ? 0 : 25); // Monte plus lentement
        
        if (nY < highestLeafY) highestLeafY = nY;

        // Déploiement plus horizontal et limité à la largeur de l'écran
        const maxSpread = (width / 2) - 30; 
        const calculatedOffset = 70 + row * 50;
        const boundedOffset = Math.min(calculatedOffset, maxSpread);
        
        const sideOffset = (isLeft ? -1 : 1) * boundedOffset;
        const nX = trunkX + sideOffset;
        nodes.push({ ...l, x: nX, y: nY, type: 'leaf' });

        const startXOffset = isLeft ? -20 : 20;
        const startX = trunkX + startXOffset;

        // Les courbes partent presque à l'horizontale
        const cp1x = startX + (isLeft ? -70 : 70); 
        const cp1y = baseOriginY + 5; // Ne monte pas tout de suite, s'évase horizontalement
        const cp2x = nX + (isLeft ? 10 : -10);
        const cp2y = nY + 30;
        paths.push({
            d: `M ${startX},${baseOriginY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${nX},${nY}`,
            color: '#15803d',
            width: 4
        });
    });

    // PLACEMENT FRUITS (Au sommet, branchés depuis la base)
    fruits.forEach((f, i) => {
        const row = Math.floor(i / 2);
        const nY = highestLeafY - 90 - row * 100;
        const sideOffset = (i % 2 === 0 ? -40 : 40) * (row % 2 === 0 ? 1 : 1.5);
        const nX = trunkX + sideOffset;
        nodes.push({ ...f, x: nX, y: nY, type: 'fruit' });

        const startY = baseOriginY;
        const cp1x = trunkX;
        const cp1y = startY - (startY - nY) / 2;
        const cp2x = nX;
        const cp2y = nY + 30;
        paths.push({
            d: `M ${trunkX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${nX},${nY}`,
            color: '#DC2626', // Rouge pour branches de fruits
            width: 3
        });
    });

    const renderNodeBubble = (node) => {
        let Icon = GitMerge;
        let color = '#059669';
        let bgColor = '#D1FAE5';
        let borderColor = '#34D399';

        if (node.type === 'root') { Icon = Network; color = '#D97706'; bgColor = '#FDE68A'; borderColor = '#FBBF24'; }
        else if (node.type === 'fruit') { Icon = Apple; color = '#DC2626'; bgColor = '#FEE2E2'; borderColor = '#F87171'; }
        else if (node.type === 'trunk') { Icon = Play; color = '#FFF'; bgColor = '#78350F'; borderColor = '#451A03'; }

        const NODE_SIZE = node.type === 'trunk' ? 70 : 50;
        // Ajustement pour centrer le wrapper (qui fait 120px de large) exactement sur nX
        const wrapperWidth = 120;
        const leftPos = node.x - (wrapperWidth / 2);
        const topPos = node.y - (NODE_SIZE / 2);

        return (
            <View key={node.id} style={[styles.nodeWrapper, { left: leftPos, top: topPos, width: wrapperWidth }]}>
                <TouchableOpacity
                    style={[
                        styles.bubble,
                        { width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2, backgroundColor: bgColor, borderColor: borderColor }
                    ]}
                    onPress={() => handlePlay(node)}
                >
                    <Icon size={node.type === 'trunk' ? 32 : 24} color={color} fill={node.type === 'trunk' ? color : 'none'} />
                    {node.type === 'trunk' && waterCount > 0 && (
                        <View style={styles.waterBadge}>
                            <Text style={styles.waterBadgeText}>💧{waterCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <View style={styles.labelContainer}>
                    <Text style={styles.nodeTitle} numberOfLines={2}>{node.title || 'Sans titre'}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                onOpenSettings={() => { }}
                title="Mon jardin"
                showLogo={false}
                rightContent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ArrowLeft size={16} color="#78350F" strokeWidth={2} style={{ marginRight: 4 }} />
                        <Text style={styles.backButtonText}>Retour</Text>
                    </TouchableOpacity>
                }
            />

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#15803d" />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <View style={styles.treeTitleContainer}>
                        <Text style={styles.sectionLabel}>📌 Pensée à nourrir</Text>
                    <TouchableOpacity
                        style={[styles.card, isRecording && styles.cardRecording]}
                        onLongPress={() => {
                            if (!isRecording) startRecording();
                        }}
                        onPress={async () => {
                            if (isRecording) {
                                const uri = await stopRecording();
                                if (uri) {
                                    setPendingRecording({ uri, duration, parentId: freshTree.id });
                                    setShowTitleModal(true);
                                }
                            }
                        }}
                        delayLongPress={400}
                        activeOpacity={0.8}
                    >
                        <View style={styles.logoWrapper}>
                            <Logo size={24} color={isRecording ? '#B91C1C' : '#78350F'} variant="outline" />
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.title} numberOfLines={1}>{freshTree.title || 'Sans titre'}</Text>
                            <View style={styles.hintRow}>
                                <Mic size={11} color={isRecording ? '#B91C1C' : '#A8A29E'} strokeWidth={2} />
                                <Text style={[styles.hint, isRecording && styles.hintRecording]}>
                                    {isRecording ? 'Enregistrement... (Tap pour stopper)' : 'Appui long pour nourrir'}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
                <ScrollView
                    contentContainerStyle={{ height: canvasHeight, width: '100%' }}
                    showsVerticalScrollIndicator={false}
                >
                    <Svg height={canvasHeight} width={width} style={StyleSheet.absoluteFill}>
                        {/* Sol visuel */}
                        <Path
                            d={`M 0,${trunkY + 50} Q ${width / 2},${trunkY + 30} ${width},${trunkY + 50} L ${width},${canvasHeight} L 0,${canvasHeight} Z`}
                            fill="#F5EBE0"
                        />

                        {/* Tronc Principal de base */}
                        {!isSeed && (
                            <Path
                                d={`M ${trunkX},${trunkY + 50} L ${trunkX},${trunkY}`}
                                stroke="#78350F"
                                strokeWidth={trunkThickness + 4}
                                strokeLinecap="round"
                            />
                        )}

                        {/* Liens SVG */}
                        {paths.map((p, i) => (
                            <Path
                                key={i}
                                d={p.d}
                                stroke={p.color}
                                strokeWidth={p.width}
                                fill="none"
                            />
                        ))}
                    </Svg>

                    {/* Noeuds Clikables */}
                    {nodes.map(renderNodeBubble)}
                    {renderNodeBubble({ ...freshTree, x: trunkX, y: baseOriginY, type: 'trunk' })}
                </ScrollView>
                </View>
            )}

            {/* Modal d'enregistrement */}
            <TitleModal
                visible={showTitleModal}
                defaultTitle={pendingRecording ? `Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                initialMode="note"
                recordingDuration={pendingRecording?.duration || 0}
                showGraftType={true}
                defaultGraftType="leaf"
                onConfirm={async (title, type = 'note', deliverDate = null, tags = [], graftType = 'leaf') => {
                    setShowTitleModal(false);
                    if (!pendingRecording) return;
                    
                    const { uri, duration, parentId } = pendingRecording;
                    const dateStr = new Date().toISOString();
                    const newRecordId = Date.now().toString();

                    const newRecording = {
                        id: newRecordId,
                        localUri: uri,
                        remoteUrl: null,
                        status: 'pending',
                        date: dateStr,
                        updatedAt: dateStr,
                        duration,
                        title,
                        type,
                        deliverDate,
                        tags,
                        parentId,
                        graftType
                    };

                    await saveRecording(newRecording);
                    updateStreak();

                    if (session?.user) {
                        syncAll(session.user.id, false).then(() => {});
                    }

                    showAlert("Sauvegardé", "Ta nouvelle pensée a été rattachée à cet arbre.", "success");
                    setPendingRecording(null);
                    
                    // Recharger l'arbre
                    loadData();
                }}
                onCancel={() => {
                    setShowTitleModal(false);
                    setPendingRecording(null);
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF7F2',
    },
    treeTitleContainer: {
        marginTop: 10,
        marginBottom: 20,
        paddingHorizontal: 20,
        width: '100%',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#78716C',
        marginBottom: 6,
        marginLeft: 2,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#D4A574',
        borderStyle: 'dashed',
    },
    cardRecording: {
        borderColor: '#B91C1C',
        backgroundColor: '#FEF2F2',
    },
    logoWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FAF7F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 2,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    hint: {
        fontSize: 12,
        color: '#A8A29E',
        fontWeight: '500',
    },
    hintRecording: {
        color: '#B91C1C',
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
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#DC2626',
        fontSize: 16,
    },
    nodeWrapper: {
        position: 'absolute',
        alignItems: 'center',
    },
    bubble: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    waterBadge: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#93C5FD',
    },
    waterBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1D4ED8',
    },
    labelContainer: {
        marginTop: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
    },
    nodeTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#292524',
        textAlign: 'center',
    }
});
