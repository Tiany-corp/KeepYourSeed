import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { Trash2, Plus, X } from 'lucide-react-native';
import CustomDatePicker from './CustomDatePicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, set } from 'idb-keyval';

const CUSTOM_TAGS_KEY = '@custom_tags_v1';

export const AVAILABLE_TAGS = [
    { id: 'enseignement', label: 'Enseignement', emoji: '🌱' },
    { id: 'gratitude', label: 'Gratitude', emoji: '💛' },
    { id: 'idee', label: 'Idée', emoji: '💡' },
    { id: 'reflexion', label: 'Réflexion', emoji: '🧠' },
    { id: 'souvenir', label: 'Souvenir', emoji: '🌿' },
    { id: 'priere', label: 'Prière exaucée', emoji: '🙏' },
    { id: 'objectif', label: 'Objectif', emoji: '🎯' },
    { id: 'temoignage', label: 'Témoignage', emoji: '💬' },
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
export default function TitleModal({ visible, defaultTitle, initialMode = 'note', recordingDuration = 0, onConfirm, onCancel }) {
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState('note');
    const [deliverDate, setDeliverDate] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [customTags, setCustomTags] = useState([]);
    const [newTagText, setNewTagText] = useState('');
    const [showConfirmCancel, setShowConfirmCancel] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setTitle(defaultTitle || '');
            setMode(initialMode);
            setDeliverDate('');
            setSelectedTags([]);
            setNewTagText('');
            setShowConfirmCancel(false);
            loadCustomTags().then(setCustomTags);
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [visible, defaultTitle, initialMode]);

    const getMinDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    const setDateOffset = (type) => {
        const date = new Date();
        if (type === 'day') {
            date.setDate(date.getDate() + 1);
        } else if (type === 'week') {
            date.setDate(date.getDate() + 7);
        } else if (type === 'month') {
            date.setMonth(date.getMonth() + 1);
        } else if (type === 'year') {
            date.setFullYear(date.getFullYear() + 1);
        }
        setDeliverDate(date.toISOString().split('T')[0]);
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
        const newTag = { id, label, emoji: '🏷️' };
        const updated = [...customTags, newTag];
        setCustomTags(updated);
        persistCustomTags(updated);
        setSelectedTags(prev => [...prev, id]);
        setNewTagText('');
    };

    const handleDeleteCustomTag = (tagId) => {
        const updated = customTags.filter(t => t.id !== tagId);
        setCustomTags(updated);
        persistCustomTags(updated);
        setSelectedTags(prev => prev.filter(t => t !== tagId));
    };

    const allTags = [...AVAILABLE_TAGS, ...customTags];

    const handleConfirm = () => {
        const finalTitle = title.trim() || defaultTitle || 'Sans titre';
        if (mode === 'message' && !deliverDate) return;
        const finalDeliverDate = mode === 'message' ? new Date(deliverDate).toISOString() : null;
        onConfirm(finalTitle, mode, finalDeliverDate, selectedTags);
    };

    const handleCancel = () => {
        if (recordingDuration > 10 && !showConfirmCancel) {
            setShowConfirmCancel(true);
            return;
        }
        setShowConfirmCancel(false);
        if (onCancel) {
            onCancel();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleCancel}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>
                        {mode === 'message' ? 'Message au futur' : 'Nommer votre pensée'}
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
                                    <View key={tag.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity
                                            style={[styles.tagChip, isActive && styles.tagChipActive]}
                                            onPress={() => toggleTag(tag.id)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.tagChipText, isActive && styles.tagChipTextActive]}>
                                                {tag.emoji} {tag.label}
                                            </Text>
                                        </TouchableOpacity>
                                        {isCustom && (
                                            <TouchableOpacity
                                                style={styles.deleteTagBtn}
                                                onPress={() => handleDeleteCustomTag(tag.id)}
                                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                                            >
                                                <X size={10} color="#78716C" strokeWidth={2.5} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Input pour créer un nouveau tag */}
                        <View style={styles.newTagRow}>
                            <TextInput
                                style={styles.newTagInput}
                                value={newTagText}
                                onChangeText={setNewTagText}
                                placeholder="Nouveau tag..."
                                placeholderTextColor="#A8A29E"
                                maxLength={30}
                                onSubmitEditing={handleAddCustomTag}
                                returnKeyType="done"
                            />
                            <TouchableOpacity
                                style={[styles.newTagButton, !newTagText.trim() && { opacity: 0.4 }]}
                                onPress={handleAddCustomTag}
                                disabled={!newTagText.trim()}
                            >
                                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Sélecteur de date pour les messages */}
                    {mode === 'message' && (
                        <View style={styles.dateSection}>
                            <Text style={styles.dateLabel}>Se l'envoyer pour dans</Text>

                            {/* Raccourcis de dates */}
                            <View style={styles.quickDateRow}>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('day') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('day')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('day') && styles.quickDateTextActive]}>
                                        1 jour
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('week') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('week')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('week') && styles.quickDateTextActive]}>
                                        1 sem
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('month') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('month')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('month') && styles.quickDateTextActive]}>
                                        1 mois
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('year') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('year')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('year') && styles.quickDateTextActive]}>
                                        1 an
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <CustomDatePicker
                                selectedDate={deliverDate}
                                onSelectDate={setDeliverDate}
                                minDate={getMinDate()}
                            />
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Trash2 size={14} color="#78716C" strokeWidth={1.5} />
                                    <Text style={styles.cancelText}>Supprimer</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.confirmButton, mode === 'message' && !deliverDate && { opacity: 0.4 }]}
                                onPress={handleConfirm}
                                disabled={mode === 'message' && !deliverDate}
                            >
                                <Text style={styles.confirmText}>
                                    {mode === 'message' ? 'Envoyer' : 'Enregistrer'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Lien contextuel pour changer de mode */}
                    <TouchableOpacity
                        style={styles.modeSwitchLink}
                        onPress={() => setMode(mode === 'note' ? 'message' : 'note')}
                    >
                        <Text style={styles.modeSwitchText}>
                            {mode === 'note'
                                ? '✉️ Transformer en message au futur'
                                : '📝 Enregistrer comme note classique'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
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
        fontWeight: '600',
        color: '#78716C',
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
        fontWeight: '600',
        color: '#78716C',
        marginBottom: 8,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tagChip: {
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
    deleteTagBtn: {
        marginLeft: -4,
        marginRight: 4,
        padding: 2,
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
});
