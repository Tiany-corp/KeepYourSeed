import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, Animated, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { Filter, Check, Search, X } from 'lucide-react-native';

/**
 * Barre de filtrage avec un bouton déroulant (dropdown) pour sélectionner un thème.
 * 
 * Props :
 * - availableTags (Array) : Liste des tags extraits {id, label, emoji}
 * - selectedTag (String) : L'ID du tag actuellement sélectionné, ou null si "Tous"
 * - onSelectTag (fn) : Callback invoqué au clic sur un tag (passe l'id ou null)
 * - onSearchPress (fn) : Callback invoqué au clic sur la loupe de recherche
 */
const TagFilterBar = React.memo(({ availableTags, selectedTag, onSelectTag, onSearchPress }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [tempSelectedTag, setTempSelectedTag] = useState(selectedTag);
    const hasTags = availableTags && availableTags.length > 0;
    const selectedTagObject = selectedTag && hasTags ? availableTags.find(t => t.id === selectedTag) : null;
    
    // Si c'est _messages_
    const isMessages = selectedTag === '_messages_';
    const buttonText = isMessages ? '📬 Messages reçus' : (selectedTagObject ? `${selectedTagObject.emoji} ${selectedTagObject.label}` : 'Filtrer');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (modalVisible) {
            setTempSelectedTag(selectedTag);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [modalVisible]);

    const handleCloseAnimation = (callback) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => {
            setModalVisible(false);
            if (callback) callback();
        });
    };

    const handleRequestClose = () => {
        handleCloseAnimation();
    };

    const handleSave = () => {
        handleCloseAnimation(() => {
            onSelectTag(tempSelectedTag);
        });
    };

    return (
        <View style={styles.filterContainer}>
            <Text style={styles.historyTitle}>Historique</Text>

            <View style={styles.actionsContainer}>
                <TouchableOpacity onPress={onSearchPress} style={styles.searchButton}>
                    <Search size={16} color="#78350F" />
                </TouchableOpacity>

                {hasTags && (
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setModalVisible(true)}
                    >
                        <Text style={styles.dropdownButtonText}>{buttonText}</Text>
                        <Filter size={14} color="#78350F" style={styles.dropdownIcon} />
                    </TouchableOpacity>
                )}
            </View>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="none"
                statusBarTranslucent={true}
                onRequestClose={handleRequestClose}
            >
                <TouchableWithoutFeedback onPress={handleRequestClose}>
                    <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                        <TouchableWithoutFeedback>
                            <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
                                <View style={styles.header}>
                                    <Text style={styles.modalTitle}>Filtrer par thème</Text>
                                    <TouchableOpacity onPress={handleRequestClose} style={styles.closeBtn}>
                                        <X size={24} color="#78716C" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.list}>
                                    <TouchableOpacity
                                        style={[styles.tagItem, !tempSelectedTag && styles.tagItemSelected]}
                                        onPress={() => setTempSelectedTag(null)}
                                    >
                                        <Text style={[styles.tagText, !tempSelectedTag && styles.tagTextSelected]}>Tous</Text>
                                        {!tempSelectedTag && <Check size={20} color="#78350F" />}
                                    </TouchableOpacity>

                                    {availableTags.map(tag => {
                                        const isSelected = tempSelectedTag === tag.id;
                                        return (
                                            <TouchableOpacity
                                                key={tag.id}
                                                style={[styles.tagItem, isSelected && styles.tagItemSelected]}
                                                onPress={() => setTempSelectedTag(tag.id)}
                                            >
                                                <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                                                    {tag.emoji} {tag.label}
                                                </Text>
                                                {isSelected && <Check size={20} color="#78350F" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                    <Text style={styles.saveBtnText}>Valider</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                </TouchableWithoutFeedback>
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
    searchButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F0E8',
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D4A574',
        marginRight: 8,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FAF7F2',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#292524',
    },
    closeBtn: {
        padding: 4,
    },
    list: {
        marginBottom: 24,
    },
    tagItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#F5F0E8',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    tagItemSelected: {
        backgroundColor: '#F3E8D8', // Light brown instead of yellow
        borderColor: '#D4A574',     // Brown border
    },
    tagText: {
        fontSize: 16,
        color: '#44403C',
        fontWeight: '500',
    },
    tagTextSelected: {
        color: '#78350F', // Primary brown
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: '#78350F', // Primary brown
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
