import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { ArrowLeft, Network, GitMerge, Apple, Play } from 'lucide-react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { getRecordings } from '../services/storage';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import AppHeader from '../components/AppHeader';
import { formatDateWithTime } from '../utils/date';
import Svg, { Path } from 'react-native-svg';

export default function TreeDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const isFocused = useIsFocused();
    const audioPlayer = useAudioPlayer();
    const { width } = useWindowDimensions();
    
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
                    <Text style={{color: '#D97706'}}>Retour</Text>
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
    const rootDepth = Math.max(150, roots.length * 90);
    const leavesHeight = Math.max(150, leaves.length * 100);
    const fruitsHeight = Math.max(100, Math.ceil(fruits.length / 2) * 110);
    const canvasHeight = rootDepth + leavesHeight + fruitsHeight + 200; // 200 de marge globale

    const trunkX = width / 2;
    const trunkY = canvasHeight - rootDepth - 100;

    const nodes = [];
    const paths = [];

    // PLACEMENT RACINES (Vers le bas)
    roots.forEach((r, i) => {
        const nY = trunkY + 120 + i * 80;
        const sideOffset = (i % 2 === 0 ? -1 : 1) * (50 + (i % 3) * 20);
        const nX = trunkX + sideOffset;
        nodes.push({ ...r, x: nX, y: nY, type: 'root' });

        const cp1x = trunkX;
        const cp1y = trunkY + (nY - trunkY) / 2;
        const cp2x = nX;
        const cp2y = nY - 40;
        paths.push({
            d: `M ${trunkX},${trunkY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${nX},${nY}`,
            color: '#D4A574',
            width: 3
        });
    });

    // PLACEMENT FEUILLES (Vers le haut, alternées)
    let highestLeafY = trunkY - 120;
    leaves.forEach((l, i) => {
        const nY = trunkY - 120 - i * 90;
        highestLeafY = nY;
        const sideOffset = (i % 2 === 0 ? -1 : 1) * (60 + (i % 3) * 15);
        const nX = trunkX + sideOffset;
        nodes.push({ ...l, x: nX, y: nY, type: 'leaf' });

        const cp1x = trunkX;
        const cp1y = trunkY - (trunkY - nY) / 2;
        const cp2x = nX;
        const cp2y = nY + 40;
        paths.push({
            d: `M ${trunkX},${trunkY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${nX},${nY}`,
            color: '#15803d',
            width: 4
        });
    });

    // TRACE DE LA TIGE CENTRALE JUSQU'EN HAUT
    paths.push({
        d: `M ${trunkX},${trunkY} L ${trunkX},${highestLeafY - 50}`,
        color: '#15803d',
        width: trunkThickness
    });

    // PLACEMENT FRUITS (Au sommet)
    fruits.forEach((f, i) => {
        const row = Math.floor(i / 2);
        const nY = highestLeafY - 120 - row * 100;
        const sideOffset = (i % 2 === 0 ? -40 : 40) * (row % 2 === 0 ? 1 : 1.5);
        const nX = trunkX + sideOffset;
        nodes.push({ ...f, x: nX, y: nY, type: 'fruit' });

        const startY = highestLeafY - 50;
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
                        { width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE/2, backgroundColor: bgColor, borderColor: borderColor }
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
                onOpenSettings={() => {}}
                title={freshTree.title || 'Arbre'}
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
                <ScrollView 
                    contentContainerStyle={{ height: canvasHeight, width: '100%' }}
                    showsVerticalScrollIndicator={false}
                >
                    <Svg height={canvasHeight} width={width} style={StyleSheet.absoluteFill}>
                        {/* Sol visuel */}
                        <Path 
                            d={`M 0,${trunkY + 50} Q ${width/2},${trunkY + 30} ${width},${trunkY + 50} L ${width},${canvasHeight} L 0,${canvasHeight} Z`}
                            fill="#F5EBE0"
                        />
                        
                        {/* Tronc Principal de base */}
                        <Path 
                            d={`M ${trunkX},${trunkY + 50} L ${trunkX},${trunkY}`}
                            stroke="#78350F"
                            strokeWidth={trunkThickness + 4}
                            strokeLinecap="round"
                        />

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
                    {renderNodeBubble({ ...freshTree, x: trunkX, y: trunkY, type: 'trunk' })}

                </ScrollView>
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    backButtonText: {
        color: '#78350F',
        fontSize: 16,
        fontWeight: '500',
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
