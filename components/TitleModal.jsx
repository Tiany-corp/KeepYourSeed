import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Platform,
    ScrollView,
    KeyboardAvoidingView,
} from 'react-native';
import { Trash2, Plus, X } from 'lucide-react-native';
import CustomDatePicker from './CustomDatePicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, set } from 'idb-keyval';
import { AVAILABLE_TAGS, loadCustomTagsCache } from '../utils/tags';

const CUSTOM_TAGS_KEY = '@custom_tags_v1';

const CUSTOM_TAG_EMOJIS = [
    '🔥', '⭐', '💪', '❤️', '🎵', '📖', '✨', '🌍',
    '🏆', '💎', '🕊️', '🌙', '⚡', '🎨', '📌', '🔑',
];


// --- Persistence des tags custom ---
const loadCustomTags = async () => {
    try {
        if (Platform.OS === 'web') {
            const data = await get(CUSTOM_TAGS_KEY);
            return data ? JSON.parse(data) : [];
        } else {
            const data = await AsyncStorage.getItem(CUSTOM_TAGS_KEY);
            return data ? JSON.parse(data) : [];
        }
    } catch { return []; }
};

const persistCustomTags = async (tags) => {
    try {
        const str = JSON.stringify(tags);
        if (Platform.OS === 'web') {
            await set(CUSTOM_TAGS_KEY, str);
        } else {
            await AsyncStorage.setItem(CUSTOM_TAGS_KEY, str);
        }
    } catch (e) { console.warn('Failed to save custom tags', e); }
};

/**
 * Modale qui s'ouvre après l'enregistrement pour demander un titre.
 * Inclut un toggle Note/Message et un sélecteur de date si mode message.
 * 
 * Props :
 * - visible (bool)        : contrôle l'affichage de la modale
 * - defaultTitle (string)  : titre pré-rempli (ex: "Note 15:00")
 * - initialMode (string)   : 'note' ou 'message' (mode par défaut)
 * - onConfirm (fn)        : callback → (title, type, deliverDate) => void
 * - onCancel (fn)         : callback si l'user annule
 */
export default function TitleModal({
    visible,
    defaultTitle,
    initialMode = 'note',
    initialDeliverDate = '',
    initialTags = null,
    isEditMode = false,
    recordingDuration = 0,
    onConfirm,
    onCancel,
    onDelete
}) {
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState('note');
    const [deliverDate, setDeliverDate] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [customTags, setCustomTags] = useState([]);
    const [newTagText, setNewTagText] = useState('');
    const [selectedNewEmoji, setSelectedNewEmoji] = useState(CUSTOM_TAG_EMOJIS[0]);
    const [showNewTagForm, setShowNewTagForm] = useState(false);
    const [showConfirmCancel, setShowConfirmCancel] = useState(false);

    // Nouveaux états pour le sélecteur de date
    const [offsetValues, setOffsetValues] = useState({ day: '1', week: '1', month: '1', year: '1' });
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [activeOffsetUnit, setActiveOffsetUnit] = useState(null);

    const inputRef = useRef(null);
    const wasVisibleRef = useRef(false);

    useEffect(() => {
        if (visible && !wasVisibleRef.current) {
            setTitle(defaultTitle || '');
            setMode(initialMode);
            setDeliverDate(initialDeliverDate ? new Date(initialDeliverDate).toISOString().split('T')[0] : '');
            setSelectedTags(Array.isArray(initialTags) ? initialTags : []);
            setNewTagText('');
            setSelectedNewEmoji(CUSTOM_TAG_EMOJIS[0]);
            setShowNewTagForm(false);
            setShowConfirmCancel(false);
            setOffsetValues({ day: '1', week: '1', month: '1', year: '1' });
            setShowCustomDate(false);
            setActiveOffsetUnit(null);
            loadCustomTags().then(setCustomTags);
            setTimeout(() => inputRef.current?.focus(), 300);
        }
        wasVisibleRef.current = visible;
    }, [visible, defaultTitle, initialMode, initialDeliverDate, initialTags]);

    const getMinDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    const setDateOffset = (type, explicitVal) => {
        const date = new Date();
        const strVal = explicitVal !== undefined ? explicitVal : offsetValues[type];
        const val = parseInt(strVal, 10) || 1;
        if (type === 'day') {
            date.setDate(date.getDate() + val);
        } else if (type === 'week') {
            date.setDate(date.getDate() + 7 * val);
        } else if (type === 'month') {
            date.setMonth(date.getMonth() + val);
        } else if (type === 'year') {
            date.setFullYear(date.getFullYear() + val);
        }
        setDeliverDate(date.toISOString().split('T')[0]);
        setActiveOffsetUnit(type);
        setShowCustomDate(false);
    };

    const renderOffsetOption = (type, label) => {
        const isActive = activeOffsetUnit === type && !showCustomDate;
        return (
            <TouchableOpacity
                key={type}
                style={[styles.offsetOptionBtn, isActive && styles.offsetOptionBtnActive]}
                onPress={() => setDateOffset(type)}
                activeOpacity={0.7}
            >
                <TextInput
                    style={[styles.offsetGridInput, isActive && styles.offsetGridInputActive]}
                    value={offsetValues[type]}
                    onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, '');
                        setOffsetValues(prev => ({ ...prev, [type]: num }));
                        setDateOffset(type, num);
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                    onFocus={() => setDateOffset(type)}
                />
                <Text style={[styles.offsetOptionLabel, isActive && styles.offsetOptionLabelActive]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const isDateSelected = (type) => {
        if (!deliverDate) return false;
        const targetDate = new Date();
        if (type === 'day') targetDate.setDate(targetDate.getDate() + 1);
        if (type === 'week') targetDate.setDate(targetDate.getDate() + 7);
        if (type === 'month') targetDate.setMonth(targetDate.getMonth() + 1);
        if (type === 'year') targetDate.setFullYear(targetDate.getFullYear() + 1);

        return deliverDate === targetDate.toISOString().split('T')[0];
    };

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const toggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(t => t !== tagId)
                : [...prev, tagId]
        );
    };

    const handleAddCustomTag = () => {
        const label = newTagText.trim();
        if (!label) return;
        const id = 'custom_' + label.toLowerCase().replace(/\s+/g, '_');
        // Vérifier que ce tag n'existe pas déjà
        if (AVAILABLE_TAGS.some(t => t.id === id) || customTags.some(t => t.id === id)) {
            setNewTagText('');
            return;
        }
        const newTag = { id, label, emoji: selectedNewEmoji };
        const updated = [...customTags, newTag];
        setCustomTags(updated);
        persistCustomTags(updated);
        loadCustomTagsCache(); // Mettre à jour le cache global instantanément
        setSelectedTags(prev => [...prev, id]);
        setNewTagText('');
        setSelectedNewEmoji(CUSTOM_TAG_EMOJIS[0]);
        setShowNewTagForm(false);
    };

    const handleDeleteCustomTag = (tagId) => {
        const updated = customTags.filter(t => t.id !== tagId); // filter recois le return d'une fonction qui renvoie vrai si le tag t existe dans tagID => t il vient d'ou ? c'est une props de tagID, c'est quoi la différence entre t et tagid si on compare les deux ?
        // Garde tous les tag t qui sont différent de celui qui a été séléectionné en tagID
        // t c'est l'élément courant qu'on est en train d'observer dans le tableau et tagId c'est le tag qui a été séléctionné par l'utilisateur
        setCustomTags(updated);
        persistCustomTags(updated);
        loadCustomTagsCache(); // Mettre à jour le cache global
        setSelectedTags(prev => prev.filter(t => t !== tagId));
    };

    const allTags = [...AVAILABLE_TAGS, ...customTags];

    const handleConfirm = () => {
        const trimmedTitle = title.trim();
        const finalTitle = isEditMode
            ? (trimmedTitle || 'Sans titre')
            : (trimmedTitle || defaultTitle || 'Sans titre');
        if (mode === 'message' && !deliverDate) return;
        const finalDeliverDate = mode === 'message' ? new Date(deliverDate).toISOString() : null;
        onConfirm(finalTitle, mode, finalDeliverDate, selectedTags);
    };

    const handleCancel = () => {
        if (!isEditMode && recordingDuration > 10 && !showConfirmCancel) {
            setShowConfirmCancel(true);
            return;
        }
        setShowConfirmCancel(false);
        if (onCancel) {
            onCancel();
        }
    };

    const handleDelete = () => {
        if (onDelete) onDelete();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <View style={styles.overlayBackground} />
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Pressable style={styles.overlayTouchable} onPress={handleCancel}>
                        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                            <Text style={styles.title}>
                                {isEditMode ? 'Modifier votre pensee' : mode === 'message' ? 'Message au futur' : 'Nommer votre pensee'}
                            </Text>

                            <TextInput
                                ref={inputRef}
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder={mode === 'message' ? 'Ex: Rappelle-toi de...' : 'Ex: Réflexion du matin...'}
                                placeholderTextColor="#A8A29E"
                                maxLength={100}
                                selectTextOnFocus
                                onSubmitEditing={handleConfirm}
                                returnKeyType="done"
                            />

                            {/* Sélecteur de tags/catégories */}
                            <View style={styles.tagsSection}>
                                <Text style={styles.tagsLabel}>Étiquettes</Text>
                                <View style={styles.tagsRow}>
                                    {allTags.map(tag => {
                                        const isActive = selectedTags.includes(tag.id);
                                        const isCustom = tag.id.startsWith('custom_');
                                        return (
                                            <View key={tag.id}>
                                                <TouchableOpacity
                                                    style={[styles.tagChip, isActive && styles.tagChipActive]}
                                                    onPress={() => toggleTag(tag.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[styles.tagChipText, isActive && styles.tagChipTextActive]}>
                                                        {tag.emoji} {tag.label}
                                                    </Text>
                                                    {isCustom && (
                                                        <TouchableOpacity
                                                            style={[styles.deleteTagBtn, isActive && styles.deleteTagBtnActive]}
                                                            onPress={() => handleDeleteCustomTag(tag.id)}
                                                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                                                        >
                                                            <X size={10} color={isActive ? '#FFFFFF' : '#78716C'} strokeWidth={2.5} />
                                                        </TouchableOpacity>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}

                                    {/* Chip "+ Nouveau" intégré dans la ligne de tags */}
                                    <TouchableOpacity
                                        style={[styles.tagChip, styles.addTagChip]}
                                        onPress={() => setShowNewTagForm(!showNewTagForm)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.addTagChipText}>+ Nouveau</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Formulaire de création (Progressive Disclosure) */}
                                {showNewTagForm && (
                                    <View style={styles.newTagFormContainer}>
                                        <View style={styles.newTagRow}>
                                            <TouchableOpacity style={styles.emojiPreview}>
                                                <Text style={styles.emojiPreviewText}>{selectedNewEmoji}</Text>
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.newTagInput}
                                                value={newTagText}
                                                onChangeText={setNewTagText}
                                                placeholder="Nom du tag..."
                                                placeholderTextColor="#A8A29E"
                                                maxLength={30}
                                                onSubmitEditing={handleAddCustomTag}
                                                returnKeyType="done"
                                                autoFocus
                                            />
                                            <TouchableOpacity
                                                style={[styles.newTagButton, !newTagText.trim() && { opacity: 0.4 }]}
                                                onPress={handleAddCustomTag}
                                                disabled={!newTagText.trim()}
                                            >
                                                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Grille d'emojis */}
                                        <View style={styles.emojiGrid}>
                                            {CUSTOM_TAG_EMOJIS.map(emoji => (
                                                <TouchableOpacity
                                                    key={emoji}
                                                    style={[styles.emojiOption, selectedNewEmoji === emoji && styles.emojiOptionActive]}
                                                    onPress={() => setSelectedNewEmoji(emoji)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={styles.emojiOptionText}>{emoji}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Sélecteur de date pour les messages */}
                            {mode === 'message' && (
                                <View style={styles.dateSection}>
                                    <Text style={styles.dateLabel}>Se l'envoyer pour dans</Text>

                                    <View style={styles.offsetGrid}>
                                        {renderOffsetOption('day', 'Jour(s)')}
                                        {renderOffsetOption('week', 'Semaine(s)')}
                                        {renderOffsetOption('month', 'Mois')}
                                        {renderOffsetOption('year', 'An(s)')}
                                    </View>

                                    <TouchableOpacity
                                        style={styles.customDateToggleBtn}
                                        onPress={() => setShowCustomDate(true)}
                                    >
                                        <Text style={styles.customDateToggleText}>
                                            Ou sélectionner une date...
                                        </Text>
                                    </TouchableOpacity>

                                    <Modal
                                        visible={showCustomDate}
                                        transparent
                                        animationType="fade"
                                        onRequestClose={() => setShowCustomDate(false)}
                                    >
                                        <View style={styles.overlayBackground} />
                                        <Pressable style={styles.overlayTouchable} onPress={() => setShowCustomDate(false)}>
                                            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                                                <View style={styles.dateModalHeader}>
                                                    <Text style={styles.title}>Choisir une date</Text>
                                                    <TouchableOpacity onPress={() => setShowCustomDate(false)}>
                                                        <X size={20} color="#78716C" />
                                                    </TouchableOpacity>
                                                </View>
                                                <CustomDatePicker
                                                    selectedDate={deliverDate}
                                                    onSelectDate={(date) => {
                                                        setDeliverDate(date);
                                                        setActiveOffsetUnit(null);
                                                        setShowCustomDate(false);
                                                    }}
                                                    minDate={getMinDate()}
                                                />
                                            </Pressable>
                                        </Pressable>
                                    </Modal>
                                </View>
                            )}

                            {showConfirmCancel ? (
                                <View style={styles.confirmCancelSection}>
                                    <View style={styles.confirmCancelHeader}>
                                        <Trash2 size={18} color="#B91C1C" strokeWidth={2} />
                                        <Text style={styles.confirmCancelText}>Supprimer cet enregistrement ?</Text>
                                    </View>
                                    <View style={styles.confirmCancelButtonRow}>
                                        <TouchableOpacity
                                            style={styles.cancelButtonDanger}
                                            onPress={() => setShowConfirmCancel(false)}
                                        >
                                            <Text style={styles.cancelTextDanger}>Annuler</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.confirmButtonDanger}
                                            onPress={handleCancel}
                                        >
                                            <Text style={styles.confirmTextDanger}>Supprimer</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                                        <Text style={styles.cancelText}>{isEditMode ? 'Annuler' : 'Supprimer'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.confirmButton,
                                            mode === 'message' && !deliverDate && styles.confirmButtonDisabled
                                        ]}
                                        onPress={handleConfirm}
                                        disabled={mode === 'message' && !deliverDate}
                                    >
                                        <Text style={[
                                            styles.confirmText,
                                            mode === 'message' && !deliverDate && styles.confirmTextDisabled
                                        ]}>
                                            {isEditMode ? 'Sauvegarder' : mode === 'message' ? 'Envoyer' : 'Enregistrer'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {isEditMode && (
                                <TouchableOpacity style={styles.deleteEditButton} onPress={handleDelete}>
                                    <Trash2 size={14} color="#FFFFFF" strokeWidth={1.8} />
                                    <Text style={styles.deleteEditButtonText}>Supprimer l'enregistrement</Text>
                                </TouchableOpacity>
                            )}

                            {/* Lien contextuel pour changer de mode */}
                            <TouchableOpacity
                                style={styles.modeSwitchLink}
                                onPress={() => setMode(mode === 'note' ? 'message' : 'note')}
                            >
                                <Text style={styles.modeSwitchText}>
                                    {mode === 'note'
                                        ? '🚀 Transformer en message au futur toi'
                                        : '📝 Enregistrer comme note classique'}
                                </Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal >
    );
}

const styles = StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1,
    },
    overlayBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    overlayTouchable: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: 24,
        paddingTop: Platform.OS === 'web' ? 40 : 72,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FAF7F2',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: '#D4A574',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#292524',
        textAlign: 'center',
        marginBottom: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        backgroundColor: '#F5F0E8',
        borderRadius: 10,
        padding: 3,
        marginBottom: 16,
    },
    toggleTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    toggleTabActive: {
        backgroundColor: '#78350F',
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#78716C',
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D4A574',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#292524',
        marginBottom: 16,
    },
    dateSection: {
        marginBottom: 16,
    },
    dateLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#57534E',
        marginBottom: 8,
    },
    quickDateRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    quickDateBtn: {
        flex: 1,
        paddingVertical: 8,
        backgroundColor: '#F5F0E8',
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    quickDateBtnActive: {
        backgroundColor: '#78350F',
        borderColor: '#78350F',
    },
    quickDateText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#78350F',
    },
    quickDateTextActive: {
        color: '#FFFFFF',
    },
    dateButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D4A574',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dateButtonText: {
        fontSize: 16,
        color: '#292524',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#78716C',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#78350F',
    },
    confirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    confirmButtonDisabled: {
        backgroundColor: '#E7E5E4', // stone-200
    },
    confirmTextDisabled: {
        color: '#A8A29E', // stone-400
    },
    modeSwitchLink: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 4,
    },
    modeSwitchText: {
        fontSize: 13,
        color: '#78716C',
        fontWeight: '500',
    },
    tagsSection: {
        marginBottom: 16,
    },
    tagsLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#57534E',
        marginBottom: 8,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: '#F5F0E8',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    tagChipActive: {
        backgroundColor: '#78350F',
        borderColor: '#78350F',
    },
    tagChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#78350F',
    },
    tagChipTextActive: {
        color: '#FFFFFF',
    },
    addTagChip: {
        backgroundColor: 'transparent',
        borderStyle: 'dashed',
        borderColor: '#A8A29E',
        borderWidth: 1,
    },
    addTagChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#A8A29E',
    },
    newTagFormContainer: {
        marginTop: 10,
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    deleteTagBtn: {
        marginLeft: 6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(0,0,0,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteTagBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    newTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    newTagInput: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D4A574',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 13,
        color: '#292524',
    },
    newTagButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#78350F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiPreview: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F5F0E8',
        borderWidth: 1,
        borderColor: '#D4A574',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiPreviewText: {
        fontSize: 16,
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    emojiOption: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F5F0E8',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    emojiOptionActive: {
        backgroundColor: '#78350F',
        borderColor: '#78350F',
    },
    emojiOptionText: {
        fontSize: 18,
    },
    confirmCancelSection: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#FEF2F2', // Rouge très clair
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FECACA', // Bordure rouge clair
    },
    confirmCancelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    confirmCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#991B1B', // Rouge sombre pour le texte
    },
    confirmCancelButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    cancelButtonDanger: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F87171',
    },
    cancelTextDanger: {
        fontSize: 14,
        fontWeight: '600',
        color: '#991B1B',
    },
    confirmButtonDanger: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#DC2626',
    },
    confirmTextDanger: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    deleteEditButton: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#B91C1C',
    },
    deleteEditButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    offsetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8,
    },
    offsetOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        flexBasis: '48%',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D5BF',
        borderRadius: 10,
        padding: 6,
    },
    offsetOptionBtnActive: {
        backgroundColor: '#F5EADB',
        borderColor: '#D97706',
    },
    offsetGridInput: {
        backgroundColor: '#F3EFEA',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#451A03',
        textAlign: 'center',
        minWidth: 36,
        marginRight: 8,
    },
    offsetGridInputActive: {
        backgroundColor: '#FFFFFF',
        color: '#D97706',
    },
    offsetOptionLabel: {
        fontSize: 14,
        color: '#78350F',
        fontWeight: '500',
    },
    offsetOptionLabelActive: {
        color: '#D97706',
        fontWeight: 'bold',
    },
    customDateToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginBottom: 8,
    },
    customDateToggleText: {
        fontSize: 13,
        color: '#8e847dff',
        fontWeight: '500',
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
});
