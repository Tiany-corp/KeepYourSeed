import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { X, Search, GitMerge, Apple, Network } from 'lucide-react-native';
import { getRecordings } from '../services/storage';
import Logo from './Logo';
import { formatDateWithTime } from '../utils/date';

export default function TreeSelectionModal({
    visible,
    onClose,
    onSelectTree,
    excludeId = null
}) {
    const [trees, setTrees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [step, setStep] = useState(1);
    const [selectedTreeId, setSelectedTreeId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            loadTrees();
            setStep(1);
            setSelectedTreeId(null);
            setSearchQuery('');
        }
    }, [visible]);

    const loadTrees = async () => {
        setLoading(true);
        try {
            const allRecordings = await getRecordings();

            // Un "Arbre" (Tronc) potentiel est un enregistrement qui n'a pas de parentId
            // On exclut aussi l'enregistrement courant (excludeId) pour ne pas qu'il soit son propre parent
            const potentialTrees = allRecordings.filter(r =>
                !r.deletedAt &&
                !r.parentId &&
                r.id !== excludeId
            ).sort((a, b) => new Date(b.date) - new Date(a.date));

            setTrees(potentialTrees);
        } catch (e) {
            console.error('Failed to load trees:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredTrees = trees.filter(t =>
        (t.title || 'Sans titre').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderTreeItem = ({ item }) => (
        <TouchableOpacity
            style={styles.treeItem}
            onPress={() => {
                setSelectedTreeId(item.id);
                setStep(2);
            }}
        >
            <Logo size={24} color="#78350F" variant="outline" />
            <View style={styles.treeInfo}>
                <Text style={styles.treeTitle} numberOfLines={1}>{item.title || 'Sans titre'}</Text>
                <Text style={styles.treeDate}>{formatDateWithTime(item.date)}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Sélectionner un Arbre</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#78716C" />
                        </TouchableOpacity>
                    </View>

                    {step === 1 ? (
                        <>
                            <Text style={styles.subtitle}>Choisissez un enregistrement principal auquel rattacher cette pensée.</Text>

                            <View style={styles.searchContainer}>
                                <Search size={20} color="#A8A29E" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Rechercher un arbre..."
                                    placeholderTextColor="#A8A29E"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            <FlatList
                                data={filteredTrees}
                                keyExtractor={item => item.id}
                                renderItem={renderTreeItem}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>
                                        {loading ? "Chargement..." : "Aucun arbre trouvé."}
                                    </Text>
                                }
                            />
                        </>
                    ) : (
                        <View style={styles.roleSelectionContainer}>
                            <Text style={styles.subtitle}>Quel est la nature de cette pensée ?</Text>

                            <TouchableOpacity style={styles.roleBtn} onPress={() => { onSelectTree(selectedTreeId, 'root'); onClose(); }}>
                                <View style={[styles.roleIconBox, { backgroundColor: '#FDE68A' }]}>
                                    <Network size={24} color="#D97706" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleTitle}>Racine</Text>
                                    <Text style={styles.roleDesc}>Consolidation ou fondation de la pensée.</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.roleBtn} onPress={() => { onSelectTree(selectedTreeId, 'leaf'); onClose(); }}>
                                <View style={[styles.roleIconBox, { backgroundColor: '#D1FAE5' }]}>
                                    <GitMerge size={24} color="#059669" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleTitle}>Feuille</Text>
                                    <Text style={styles.roleDesc}>Idée liée, réflexion périphérique.</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.roleBtn} onPress={() => { onSelectTree(selectedTreeId, 'fruit'); onClose(); }}>
                                <View style={[styles.roleIconBox, { backgroundColor: '#FEE2E2' }]}>
                                    <Apple size={24} color="#DC2626" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleTitle}>Fruit</Text>
                                    <Text style={styles.roleDesc}>Résultat, aboutissement, témoignage.</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                                <Text style={styles.backBtnText}>Retour à la sélection de l'arbre</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.skipBtn} onPress={() => { onSelectTree(selectedTreeId, 'leaf'); onClose(); }}>
                                <Text style={styles.skipBtnText}>Passer (Par défaut : Feuille)</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FAF7F2',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        minHeight: '50%',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#292524',
    },
    closeBtn: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#78716C',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginHorizontal: 20,
        marginBottom: 16,
        height: 44,
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#292524',
        height: '100%',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    treeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E8D5BF',
    },
    treeInfo: {
        marginLeft: 12,
        flex: 1,
    },
    treeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 4,
    },
    treeDate: {
        fontSize: 13,
        color: '#A8A29E',
    },
    emptyText: {
        textAlign: 'center',
        color: '#A8A29E',
        marginTop: 32,
        fontSize: 15,
        fontStyle: 'italic'
    },
    roleSelectionContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    roleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    roleIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    roleTextContainer: {
        flex: 1,
    },
    roleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#292524',
        marginBottom: 4,
    },
    roleDesc: {
        fontSize: 13,
        color: '#78716C',
    },
    backBtn: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 12,
    },
    backBtnText: {
        color: '#A8A29E',
        fontSize: 14,
        fontWeight: '600',
    },
    skipBtn: {
        marginTop: 8,
        alignItems: 'center',
        paddingVertical: 12,
    },
    skipBtnText: {
        color: '#15803d',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    }
});
