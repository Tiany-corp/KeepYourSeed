import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';

/**
 * Barre de filtrage avec un bouton déroulant (dropdown) pour sélectionner un thème.
 * 
 * Props :
 * - availableTags (Array) : Liste des tags extraits {id, label, emoji}
 * - selectedTag (String) : L'ID du tag actuellement sélectionné, ou null si "Tous"
 * - onSelectTag (fn) : Callback invoqué au clic sur un tag (passe l'id ou null)
 */
const TagFilterBar = React.memo(({ availableTags, selectedTag, onSelectTag }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const hasTags = availableTags && availableTags.length > 0;
    const selectedTagObject = selectedTag && hasTags ? availableTags.find(t => t.id === selectedTag) : null;
    const buttonText = selectedTagObject ? `${selectedTagObject.emoji} ${selectedTagObject.label}` : 'Tous';

    return (
        <View style={styles.filterContainer}>
            <Text style={styles.historyTitle}>Historique</Text>

            {hasTags && (
                <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.dropdownButtonText}>{buttonText}</Text>
                    <ChevronDown size={16} color="#78350F" style={styles.dropdownIcon} />
                </TouchableOpacity>
            )}

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <Pressable style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filtrer par thème</Text>

                        <View style={styles.modalList}>
                            <TouchableOpacity
                                style={[styles.modalItem, !selectedTag && styles.modalItemActive]}
                                onPress={() => { onSelectTag(null); setModalVisible(false); }}
                            >
                                <Text style={[styles.modalItemText, !selectedTag && styles.modalItemTextActive]}>Tous</Text>
                                {!selectedTag && <Check size={18} color="#78350F" />}
                            </TouchableOpacity>

                            {availableTags.map(tag => (
                                <TouchableOpacity
                                    key={tag.id}
                                    style={[styles.modalItem, selectedTag === tag.id && styles.modalItemActive]}
                                    onPress={() => { onSelectTag(tag.id); setModalVisible(false); }}
                                >
                                    <Text style={[styles.modalItemText, selectedTag === tag.id && styles.modalItemTextActive]}>
                                        {tag.emoji} {tag.label}
                                    </Text>
                                    {selectedTag === tag.id && <Check size={18} color="#78350F" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
});

export default TagFilterBar;

const styles = StyleSheet.create({
    filterContainer: {
        backgroundColor: 'transparent',
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    historyTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#78350F', // Marron principal de l'app
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    dropdownButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#78350F',
        marginRight: 6,
    },
    dropdownIcon: {
        marginTop: 1,
    },

    // --- Styles de la Modale ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#FAF7F2',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#292524',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E6D2',
    },
    modalItemActive: {
        backgroundColor: '#F5F0E8',
    },
    modalItemText: {
        fontSize: 15,
        color: '#44403C',
    },
    modalItemTextActive: {
        fontWeight: 'bold',
        color: '#78350F',
    },
});
