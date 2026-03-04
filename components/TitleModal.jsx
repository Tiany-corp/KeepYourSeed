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
} from 'react-native';

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
export default function TitleModal({ visible, defaultTitle, initialMode = 'note', onConfirm, onCancel }) {
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState('note');
    const [deliverDate, setDeliverDate] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setTitle(defaultTitle || '');
            setMode(initialMode);
            setDeliverDate('');
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

    const handleConfirm = () => {
        const finalTitle = title.trim() || defaultTitle || 'Sans titre';
        if (mode === 'message' && !deliverDate) return;
        const finalDeliverDate = mode === 'message' ? new Date(deliverDate).toISOString() : null;
        onConfirm(finalTitle, mode, finalDeliverDate);
    };

    const handleCancel = () => {
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
                    <Text style={styles.title}>Nommer votre pensée</Text>

                    {/* Toggle Note / Message */}
                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[styles.toggleTab, mode === 'note' && styles.toggleTabActive]}
                            onPress={() => setMode('note')}
                        >
                            <Text style={[styles.toggleText, mode === 'note' && styles.toggleTextActive]}>
                                Note
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleTab, mode === 'message' && styles.toggleTabActive]}
                            onPress={() => setMode('message')}
                        >
                            <Text style={[styles.toggleText, mode === 'message' && styles.toggleTextActive]}>
                                Message au futur
                            </Text>
                        </TouchableOpacity>
                    </View>

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

                    {/* Sélecteur de date pour les messages */}
                    {mode === 'message' && (
                        <View style={styles.dateSection}>
                            <Text style={styles.dateLabel}>Date de réception</Text>

                            {/* Raccourcis de dates */}
                            <View style={styles.quickDateRow}>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('day') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('day')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('day') && styles.quickDateTextActive]}>
                                        +1 jour
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('week') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('week')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('week') && styles.quickDateTextActive]}>
                                        +1 sem.
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('month') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('month')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('month') && styles.quickDateTextActive]}>
                                        +1 mois
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.quickDateBtn, isDateSelected('year') && styles.quickDateBtnActive]}
                                    onPress={() => setDateOffset('year')}
                                >
                                    <Text style={[styles.quickDateText, isDateSelected('year') && styles.quickDateTextActive]}>
                                        +1 an
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    min={getMinDate()}
                                    value={deliverDate}
                                    onChange={(e) => setDeliverDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 12,
                                        border: '1px solid #D4A574',
                                        backgroundColor: '#FFFFFF',
                                        fontSize: 16,
                                        color: '#292524',
                                        fontFamily: 'inherit',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            ) : (
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setDeliverDate(getMinDate())}
                                >
                                    <Text style={styles.dateButtonText}>
                                        {deliverDate ? formatDisplayDate(deliverDate) : 'Choisir une date'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={styles.cancelText}>Annuler</Text>
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
                </View>
            </KeyboardAvoidingView>
        </Modal>
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
});
