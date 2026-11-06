import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    StyleSheet, 
    View, 
    Text, 
    TouchableOpacity, 
    Modal, 
    Pressable, 
    Animated, 
    ScrollView, 
    TouchableWithoutFeedback,
    TextInput,
    Alert,
    Platform
} from 'react-native';
import { Filter, Check, Search, X, Settings, Plus, Edit2, Trash2, Sparkles, Tag } from 'lucide-react-native';
import { 
    AVAILABLE_TAGS, 
    loadCustomTags, 
    persistCustomTags, 
    loadCustomTagsCache,
    CUSTOM_TAG_EMOJIS 
} from '../utils/tags';

/**
 * Barre de filtrage avec un bouton déroulant (dropdown) pour sélectionner un thème.
 * Inclut désormais un mode d'administration pour gérer, modifier les émojis et configurer les étiquettes existantes.
 */
const TagFilterBar = React.memo(({ availableTags, selectedTag, onSelectTag, onSearchPress, onTagsUpdated }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [tempSelectedTag, setTempSelectedTag] = useState(selectedTag);
    const [isManaging, setIsManaging] = useState(false);
    const [customTags, setCustomTags] = useState([]);

    // État d'édition d'une étiquette
    const [editingTagId, setEditingTagId] = useState(null);
    const [editLabel, setEditLabel] = useState('');
    const [editEmoji, setEditEmoji] = useState('🔥');

    // État de création d'une nouvelle étiquette
    const [showNewForm, setShowNewForm] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newEmoji, setNewEmoji] = useState('🔥');

    const hasTags = availableTags && availableTags.length > 0;
    const selectedTagObject = selectedTag && hasTags ? availableTags.find(t => t.id === selectedTag) : null;
    
    const isMessages = selectedTag === '_messages_';
    const buttonText = isMessages ? '📬 Messages reçus' : (selectedTagObject ? `${selectedTagObject.emoji} ${selectedTagObject.label}` : 'Filtrer');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    const refreshCustomTags = async () => {
        const tags = await loadCustomTags();
        setCustomTags(tags || []);
    };

    useEffect(() => {
        if (modalVisible) {
            setTempSelectedTag(selectedTag);
            setIsManaging(false);
            setEditingTagId(null);
            setShowNewForm(false);
            refreshCustomTags();

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

    // Détecter les étiquettes existantes sur les pensées mais qui n'ont pas encore d'émoji personnalisé (fallback 🏷️)
    const orphanTags = useMemo(() => {
        if (!availableTags) return [];
        return availableTags.filter(t => t.id !== '_messages_' && t.emoji === '🏷️');
    }, [availableTags, customTags]);

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
            setIsManaging(false);
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

    // Assigner un émoji à une ancienne étiquette orpheline
    const handleAdoptOrphan = async (orphan, chosenEmoji) => {
        const id = orphan.id.startsWith('custom_') ? orphan.id : `custom_${orphan.id.toLowerCase()}`;
        const newTag = { id, label: orphan.label, emoji: chosenEmoji };
        const updated = [...customTags, newTag];

        setCustomTags(updated);
        await persistCustomTags(updated);
        await loadCustomTagsCache();
        if (onTagsUpdated) onTagsUpdated();
    };

    // Créer une nouvelle étiquette
    const handleCreateTag = async () => {
        const label = newLabel.trim();
        if (!label) return;

        const id = 'custom_' + label.toLowerCase().replace(/\s+/g, '_');
        if (AVAILABLE_TAGS.some(t => t.id === id) || customTags.some(t => t.id === id)) {
            Alert.alert('Information', 'Une étiquette avec ce nom existe déjà.');
            return;
        }

        const newTag = { id, label, emoji: newEmoji };
        const updated = [...customTags, newTag];

        setCustomTags(updated);
        await persistCustomTags(updated);
        await loadCustomTagsCache();

        setNewLabel('');
        setNewEmoji('🔥');
        setShowNewForm(false);
        if (onTagsUpdated) onTagsUpdated();
    };

    // Début édition
    const handleStartEdit = (tag) => {
        setEditingTagId(tag.id);
        setEditLabel(tag.label);
        setEditEmoji(tag.emoji);
    };

    // Sauvegarder édition
    const handleSaveEdit = async (tagId) => {
        const label = editLabel.trim();
        if (!label) return;

        const updated = customTags.map(t => {
            if (t.id === tagId) {
                return { ...t, label, emoji: editEmoji };
            }
            return t;
        });

        setCustomTags(updated);
        await persistCustomTags(updated);
        await loadCustomTagsCache();
        setEditingTagId(null);
        if (onTagsUpdated) onTagsUpdated();
    };

    // Supprimer étiquette
    const handleDeleteTag = (tagId, label) => {
        const confirmDelete = async () => {
            const updated = customTags.filter(t => t.id !== tagId);
            setCustomTags(updated);
            await persistCustomTags(updated);
            await loadCustomTagsCache();
            if (onTagsUpdated) onTagsUpdated();
        };

        const msg = `Supprimer l'étiquette "${label}" ? Vos pensées garderont leur texte mais n'auront plus cet émoji associé.`;
        if (Platform.OS === 'web') {
            if (window.confirm(msg)) confirmDelete();
        } else {
            Alert.alert('Supprimer l\'étiquette', msg, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: confirmDelete }
            ]);
        }
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
                                {/* Header */}
                                <View style={styles.header}>
                                    <Text style={styles.modalTitle}>
                                        {isManaging ? 'Gérer les étiquettes' : 'Filtrer par thème'}
                                    </Text>
                                    <View style={styles.headerRightActions}>
                                        <TouchableOpacity
                                            style={[styles.manageBtn, isManaging && styles.manageBtnActive]}
                                            onPress={() => setIsManaging(!isManaging)}
                                        >
                                            <Settings size={13} color={isManaging ? '#FFFFFF' : '#78350F'} style={{ marginRight: 4 }} />
                                            <Text style={[styles.manageBtnText, isManaging && styles.manageBtnTextActive]}>
                                                {isManaging ? 'Filtre' : 'Gérer'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleRequestClose} style={styles.closeBtn}>
                                            <X size={22} color="#78716C" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* CONTENU DU MODE GESTION */}
                                {isManaging ? (
                                    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                                        {/* SECTION 1 : Tags anciens détectés sans émoji */}
                                        {orphanTags.length > 0 && (
                                            <View style={styles.orphanBox}>
                                                <View style={styles.orphanHeader}>
                                                    <Sparkles size={15} color="#B45309" style={{ marginRight: 6 }} />
                                                    <Text style={styles.orphanTitle}>Étiquettes anciennes à associer</Text>
                                                </View>
                                                <Text style={styles.orphanDesc}>
                                                    Ces étiquettes existent sur vos pensées. Choisissez leur émoji pour les synchroniser :
                                                </Text>
                                                {orphanTags.map(orphan => (
                                                    <View key={orphan.id} style={styles.orphanItemRow}>
                                                        <Text style={styles.orphanItemLabel}>🏷️ {orphan.label}</Text>
                                                        <View style={styles.orphanEmojiRow}>
                                                            {CUSTOM_TAG_EMOJIS.slice(0, 6).map(em => (
                                                                <TouchableOpacity
                                                                    key={em}
                                                                    style={styles.orphanEmojiBtn}
                                                                    onPress={() => handleAdoptOrphan(orphan, em)}
                                                                >
                                                                    <Text style={{ fontSize: 15 }}>{em}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {/* SECTION 2 : Mes étiquettes personnalisées */}
                                        <View style={styles.manageSectionHeader}>
                                            <Text style={styles.manageSectionTitle}>
                                                Mes étiquettes ({customTags.length})
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.newTagToggleBtn}
                                                onPress={() => setShowNewForm(!showNewForm)}
                                            >
                                                <Plus size={14} color="#78350F" style={{ marginRight: 4 }} />
                                                <Text style={styles.newTagToggleText}>Nouveau</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Formulaire ajout nouveau tag */}
                                        {showNewForm && (
                                            <View style={styles.formCard}>
                                                <View style={styles.formInputRow}>
                                                    <View style={styles.formEmojiBadge}>
                                                        <Text style={{ fontSize: 20 }}>{newEmoji}</Text>
                                                    </View>
                                                    <TextInput
                                                        style={styles.formTextInput}
                                                        value={newLabel}
                                                        onChangeText={setNewLabel}
                                                        placeholder="Nom (ex: Sport, Voyage...)"
                                                        placeholderTextColor="#A8A29E"
                                                        maxLength={30}
                                                    />
                                                    <TouchableOpacity
                                                        style={[styles.formSaveBtn, !newLabel.trim() && { opacity: 0.4 }]}
                                                        onPress={handleCreateTag}
                                                        disabled={!newLabel.trim()}
                                                    >
                                                        <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={styles.formEmojiGrid}>
                                                    {CUSTOM_TAG_EMOJIS.map(em => (
                                                        <TouchableOpacity
                                                            key={em}
                                                            style={[styles.formEmojiBtn, newEmoji === em && styles.formEmojiBtnActive]}
                                                            onPress={() => setNewEmoji(em)}
                                                        >
                                                            <Text style={{ fontSize: 16 }}>{em}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        {/* Liste des tags custom */}
                                        {customTags.length === 0 && !showNewForm && (
                                            <Text style={styles.emptyCustomText}>Aucune étiquette personnalisée pour l'instant.</Text>
                                        )}

                                        {customTags.map(tag => {
                                            const isEditing = editingTagId === tag.id;
                                            if (isEditing) {
                                                return (
                                                    <View key={tag.id} style={styles.formCard}>
                                                        <View style={styles.formInputRow}>
                                                            <View style={styles.formEmojiBadge}>
                                                                <Text style={{ fontSize: 20 }}>{editEmoji}</Text>
                                                            </View>
                                                            <TextInput
                                                                style={styles.formTextInput}
                                                                value={editLabel}
                                                                onChangeText={setEditLabel}
                                                                placeholder="Nom..."
                                                                placeholderTextColor="#A8A29E"
                                                                maxLength={30}
                                                            />
                                                            <TouchableOpacity
                                                                style={[styles.formSaveBtn, !editLabel.trim() && { opacity: 0.4 }]}
                                                                onPress={() => handleSaveEdit(tag.id)}
                                                                disabled={!editLabel.trim()}
                                                            >
                                                                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.formCancelBtn}
                                                                onPress={() => setEditingTagId(null)}
                                                            >
                                                                <X size={16} color="#78716C" />
                                                            </TouchableOpacity>
                                                        </View>
                                                        <View style={styles.formEmojiGrid}>
                                                            {CUSTOM_TAG_EMOJIS.map(em => (
                                                                <TouchableOpacity
                                                                    key={em}
                                                                    style={[styles.formEmojiBtn, editEmoji === em && styles.formEmojiBtnActive]}
                                                                    onPress={() => setEditEmoji(em)}
                                                                >
                                                                    <Text style={{ fontSize: 16 }}>{em}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>
                                                );
                                            }

                                            return (
                                                <View key={tag.id} style={styles.customTagRow}>
                                                    <View style={styles.customTagLeft}>
                                                        <Text style={styles.customTagEmoji}>{tag.emoji}</Text>
                                                        <Text style={styles.customTagLabel}>{tag.label}</Text>
                                                    </View>
                                                    <View style={styles.customTagActions}>
                                                        <TouchableOpacity
                                                            style={styles.tagActionBtn}
                                                            onPress={() => handleStartEdit(tag)}
                                                        >
                                                            <Edit2 size={14} color="#78350F" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.tagActionBtn, { backgroundColor: '#FEE2E2' }]}
                                                            onPress={() => handleDeleteTag(tag.id, tag.label)}
                                                        >
                                                            <Trash2 size={14} color="#DC2626" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}

                                        {/* SECTION 3 : Tags système de base */}
                                        <View style={[styles.manageSectionHeader, { marginTop: 16 }]}>
                                            <Text style={styles.manageSectionTitle}>Étiquettes système (par défaut)</Text>
                                        </View>
                                        <View style={styles.systemTagList}>
                                            {AVAILABLE_TAGS.map(t => (
                                                <View key={t.id} style={styles.systemTagPill}>
                                                    <Text style={styles.systemTagText}>{t.emoji} {t.label}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </ScrollView>
                                ) : (
                                    /* CONTENU DU MODE FILTRE CLASSIQUE */
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
                                )}

                                {/* Bouton de bas de modale */}
                                {isManaging ? (
                                    <TouchableOpacity style={styles.saveBtn} onPress={() => setIsManaging(false)}>
                                        <Text style={styles.saveBtnText}>Terminer</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                        <Text style={styles.saveBtnText}>Valider</Text>
                                    </TouchableOpacity>
                                )}
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
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#292524',
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    manageBtnActive: {
        backgroundColor: '#78350F',
        borderColor: '#78350F',
    },
    manageBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#78350F',
    },
    manageBtnTextActive: {
        color: '#FFFFFF',
    },
    closeBtn: {
        padding: 4,
    },
    list: {
        marginBottom: 18,
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
        backgroundColor: '#F3E8D8',
        borderColor: '#D4A574',
    },
    tagText: {
        fontSize: 16,
        color: '#44403C',
        fontWeight: '500',
    },
    tagTextSelected: {
        color: '#78350F',
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: '#78350F',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },

    // --- Styles du Mode Gestion ---
    orphanBox: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
    },
    orphanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    orphanTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#92400E',
    },
    orphanDesc: {
        fontSize: 12,
        color: '#78350F',
        marginBottom: 8,
        lineHeight: 16,
    },
    orphanItemRow: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 8,
        paddingHorizontal: 10,
        marginBottom: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orphanItemLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#292524',
    },
    orphanEmojiRow: {
        flexDirection: 'row',
        gap: 4,
    },
    orphanEmojiBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#F5F0E8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    manageSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    manageSectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#78350F',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    newTagToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    newTagToggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#78350F',
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#D4A574',
        marginBottom: 12,
    },
    formInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    formEmojiBadge: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F5F0E8',
        borderWidth: 1,
        borderColor: '#D4A574',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formTextInput: {
        flex: 1,
        backgroundColor: '#F5F0E8',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
        fontSize: 14,
        color: '#292524',
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    formSaveBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#78350F',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formCancelBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#F5F0E8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formEmojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F5F0E8',
    },
    formEmojiBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F5F0E8',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    formEmojiBtnActive: {
        borderColor: '#78350F',
        backgroundColor: '#FEF3C7',
    },
    emptyCustomText: {
        fontSize: 13,
        color: '#78716C',
        textAlign: 'center',
        marginVertical: 12,
        fontStyle: 'italic',
    },
    customTagRow: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    customTagLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    customTagEmoji: {
        fontSize: 20,
    },
    customTagLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#292524',
    },
    customTagActions: {
        flexDirection: 'row',
        gap: 6,
    },
    tagActionBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#F5F0E8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    systemTagList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    systemTagPill: {
        backgroundColor: '#F5F0E8',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    systemTagText: {
        fontSize: 12,
        color: '#78716C',
    },
});
