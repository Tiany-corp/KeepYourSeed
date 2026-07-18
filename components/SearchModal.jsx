import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { X, Search } from 'lucide-react-native';
import { getRecordings } from '../services/storage';
import Logo from './Logo';
import { formatDateWithTime } from '../utils/date';

export default function SearchModal({
    visible,
    onClose,
    onSelectAudio
}) {
    const [recordings, setRecordings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            loadRecordings();
        } else {
            setSearchQuery('');
        }
    }, [visible]);

    const loadRecordings = async () => {
        setLoading(true);
        try {
            const allRecordings = await getRecordings();
            
            const activeRecordings = allRecordings.filter(r => 
                !r.deletedAt
            ).sort((a, b) => new Date(b.date) - new Date(a.date));

            setRecordings(activeRecordings);
        } catch (e) {
            console.error('Failed to load recordings for search:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredRecordings = recordings.filter(r => 
        (r.title || 'Sans titre').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.itemContainer}
            onPress={() => {
                onSelectAudio(item);
                onClose();
            }}
        >
            <Logo size={24} color="#78350F" variant="outline" />
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title || 'Sans titre'}</Text>
                <Text style={styles.itemDate}>{formatDateWithTime(item.date)}</Text>
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
                        <Text style={styles.headerTitle}>Rechercher un audio</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#78716C" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Retrouvez rapidement une pensée ou un enregistrement.</Text>

                    <View style={styles.searchContainer}>
                        <Search size={20} color="#A8A29E" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Titre de l'audio..."
                            placeholderTextColor="#A8A29E"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>

                    <FlatList
                        data={filteredRecordings}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>
                                {loading ? "Chargement..." : "Aucun résultat trouvé."}
                            </Text>
                        }
                    />
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
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E8D5BF',
    },
    itemInfo: {
        marginLeft: 12,
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 4,
    },
    itemDate: {
        fontSize: 13,
        color: '#A8A29E',
    },
    emptyText: {
        textAlign: 'center',
        color: '#A8A29E',
        marginTop: 32,
        fontSize: 15,
        fontStyle: 'italic'
    }
});
