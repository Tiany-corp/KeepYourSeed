import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import AppHeader from '../components/AppHeader';
import { getRecordings } from '../services/storage';
import TreeCard from '../components/garden/TreeCard';
import { AppContext } from '../contexts/AppContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export default function GardenScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const audioPlayer = useAudioPlayer();
    const { setDrawerOpen } = useContext(AppContext);
    
    const [trees, setTrees] = useState([]);
    const [childrenMap, setChildrenMap] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isFocused) {
            loadGarden();
        }
    }, [isFocused]);

    const loadGarden = async () => {
        setLoading(true);
        try {
            const allRecordings = await getRecordings();
            
            // Build the relationship map
            const map = {};
            const activeRecordings = allRecordings.filter(r => !r.deletedAt);
            
            activeRecordings.forEach(r => {
                if (r.parentId) {
                    const parentId = String(r.parentId);
                    // On gère aussi la synchro dbId vs localId si possible, 
                    // mais pour simplifier on cherche le parent par ID
                    const parent = activeRecordings.find(p => p.id === r.parentId || (p.dbId && p.dbId.toString() === parentId));
                    if (parent) {
                        if (!map[parent.id]) map[parent.id] = [];
                        map[parent.id].push(r);
                    }
                }
            });

            // "Trees" are recordings that have at least one child
            const treeIds = Object.keys(map);
            const treeRecordings = activeRecordings.filter(r => treeIds.includes(r.id));
            
            // Sort by date descending
            treeRecordings.sort((a, b) => new Date(b.date) - new Date(a.date));

            setChildrenMap(map);
            setTrees(treeRecordings);
        } catch (error) {
            console.error('Failed to load garden:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayTree = (tree) => {
        audioPlayer.play(tree);
        audioPlayer.openModal();
        // Optionnel : on pourrait créer une playlist avec tree + childrenMap[tree.id] à l'avenir
    };

    const renderTree = ({ item }) => {
        const leaves = childrenMap[item.id] || [];
        return (
            <TreeCard 
                tree={item} 
                leaves={leaves} 
                onPress={() => navigation.navigate('TreeDetail', { tree: item })}
                onPlay={() => handlePlayTree(item)} 
            />
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                onOpenSettings={() => setDrawerOpen(true)}
                title={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Share2 size={20} color="#15803d" style={{ transform: [{ rotate: '90deg' }] }} />
                        <Text style={styles.headerTitleText}>Mon Jardin</Text>
                    </View>
                }
                showLogo={false}
                rightContent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ArrowLeft size={16} color="#78350F" strokeWidth={2} style={{ marginRight: 4 }} />
                        <Text style={styles.backButtonText}>Retour</Text>
                    </TouchableOpacity>
                }
            />

            <View style={styles.content}>
                <Text style={styles.description}>
                    Voici votre jardin. Chaque arbre représente une idée principale qui s'est ramifiée avec plusieurs pensées (feuilles).
                </Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#15803d" style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={trees}
                        keyExtractor={item => item.id}
                        renderItem={renderTree}
                        numColumns={2}
                        contentContainerStyle={styles.listContainer}
                        columnWrapperStyle={styles.columnWrapper}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>Votre jardin est encore vide.</Text>
                                <Text style={styles.emptySubText}>Greffez des pensées à vos audios depuis l'historique pour y planter votre premier arbre !</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF7F2',
    },
    headerTitleText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#15803d',
        letterSpacing: -0.5,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 4,
    },
    backButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#78350F',
    },
    content: {
        flex: 1,
    },
    description: {
        fontSize: 14,
        color: '#78716C',
        paddingHorizontal: 20,
        paddingVertical: 16,
        lineHeight: 20,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    listContainer: {
        paddingHorizontal: 12,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 30,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 12,
    },
    emptySubText: {
        fontSize: 14,
        color: '#78716C',
        textAlign: 'center',
        lineHeight: 22,
    }
});
