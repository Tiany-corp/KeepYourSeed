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
 * 
 * Props :
 * - visible (bool)        : contrôle l'affichage de la modale
 * - defaultTitle (string)  : titre pré-rempli (ex: "Note 15:00")
 * - onConfirm (fn)        : callback appelé avec le titre final → (title) => void
 * - onCancel (fn)         : callback si l'user annule (optionnel, sauvegarde avec le titre par défaut)
 */
export default function TitleModal({ visible, defaultTitle, onConfirm, onCancel }) {
    const [title, setTitle] = useState('');
    const inputRef = useRef(null);

    // Pré-remplir le champ quand la modale s'ouvre
    useEffect(() => {
        if (visible) {
            setTitle(defaultTitle || '');
            // Focus automatique sur le TextInput après l'ouverture
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [visible, defaultTitle]);

    const handleConfirm = () => {
        // Si le champ est vide, utilise le titre par défaut
        const finalTitle = title.trim() || defaultTitle || 'Sans titre';
        onConfirm(finalTitle);
    };

    const handleCancel = () => {
        // Annuler = sauvegarder quand même avec le titre par défaut
        if (onCancel) {
            onCancel();
        } else {
            onConfirm(defaultTitle || 'Sans titre');
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
                    <Text style={styles.subtitle}>
                        Donnez un titre à cet enregistrement
                    </Text>

                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ex: Réflexion du matin..."
                        placeholderTextColor="#A8A29E"
                        maxLength={100}
                        selectTextOnFocus
                        onSubmitEditing={handleConfirm}
                        returnKeyType="done"
                    />

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={styles.cancelText}>Passer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <Text style={styles.confirmText}>Enregistrer</Text>
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
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#78716C',
        textAlign: 'center',
        marginBottom: 20,
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
        marginBottom: 20,
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
