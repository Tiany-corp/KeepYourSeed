import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';

// --- Contexte global des alertes ---
const AlertContext = createContext(null);

/**
 * Hook pour afficher une alerte cross-platform depuis n'importe quel composant.
 * Usage : const { showAlert } = useAlert();
 *         showAlert('Titre', 'Message ici');
 *         showAlert('Erreur', 'Message', 'error');   // rouge
 *         showAlert('Succès', 'Message', 'success');  // vert
 */
export const useAlert = () => {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error('useAlert must be used within AlertProvider');
    return ctx;
};

/**
 * Provider global pour les alertes. À placer dans App.js.
 */
export function AlertProvider({ children }) {
    const [alert, setAlert] = useState(null); // { title, message, type }

    const showAlert = useCallback((title, message, type = 'info') => {
        setAlert({ title, message, type });
    }, []);

    const hideAlert = useCallback(() => {
        setAlert(null);
    }, []);

    // Couleur selon le type
    const getTypeColor = (type) => {
        switch (type) {
            case 'error': return '#B91C1C';
            case 'success': return '#16a34a';
            case 'warning': return '#D97706';
            default: return '#78350F'; // info
        }
    };

    const getTypeEmoji = (type) => {
        switch (type) {
            case 'error': return '❌';
            case 'success': return '✅';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    };

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}

            {alert && (
                <Modal
                    visible={true}
                    transparent
                    animationType="fade"
                    onRequestClose={hideAlert}
                >
                    <Pressable style={styles.backdrop} onPress={hideAlert}>
                        <Pressable onPress={e => e.stopPropagation()} style={styles.card}>
                            {/* Barre de couleur en haut */}
                            <View style={[styles.colorBar, { backgroundColor: getTypeColor(alert.type) }]} />

                            <View style={styles.content}>
                                <Text style={styles.emoji}>{getTypeEmoji(alert.type)}</Text>
                                <Text style={[styles.title, { color: getTypeColor(alert.type) }]}>
                                    {alert.title}
                                </Text>
                                <Text style={styles.message}>{alert.message}</Text>

                                <TouchableOpacity
                                    onPress={hideAlert}
                                    style={[styles.button, { backgroundColor: getTypeColor(alert.type) }]}
                                >
                                    <Text style={styles.buttonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}
        </AlertContext.Provider>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(41, 37, 36, 0.5)',
    },
    card: {
        backgroundColor: '#FAF7F2',
        borderRadius: 20,
        width: 300,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    colorBar: {
        height: 4,
        width: '100%',
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    emoji: {
        fontSize: 32,
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#57534E',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
