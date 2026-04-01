import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Alert, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../services/supabase';
import { clearRecordings, getWifiOnlyPreference, setWifiOnlyPreference } from '../services/storage';
import { emptyAudiosBucket } from '../services/cloud';
import { Settings, X, Trash2, LogOut, LogIn, CloudUpload } from 'lucide-react-native';
import Logo from './Logo';

const DRAWER_WIDTH = 280;

export default function SettingsDrawer({ visible, onClose, session, onDataCleared }) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [wifiOnly, setWifiOnly] = useState(false);
    const { showAlert } = useAlert();

    // Load Wi‑Fi‑only preference on mount
    useEffect(() => {
        (async () => {
            const pref = await getWifiOnlyPreference();
            setWifiOnly(pref);
        })();
    }, []);

    useEffect(() => {
        if (visible) {
            setIsRendered(true);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: false,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: false,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 200,
                    useNativeDriver: false,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                }),
            ]).start(() => setIsRendered(false));
        }
    }, [visible]);

    const handleSync = async () => {
        if (!session?.user?.id) return;
        
        setIsSyncing(true);
        try {
            const { syncAll } = require('../services/sync');
            const result = await syncAll(session.user.id, true); // true = Manual sync
            if (result.success) {
                if (result.pushed > 0 || result.pulled > 0) {
                    let msg = '';
                    if (result.pushed > 0) msg += `${result.pushed} envoyée(s). `;
                    if (result.pulled > 0) msg += `${result.pulled} récupérée(s).`;
                    showAlert('Succès', msg || 'Synchronisation terminée !', 'success');
                    if (onDataCleared) onDataCleared(); // Rafraîchir l'historique
                } else {
                    showAlert('Info', 'Tout est déjà à jour !', 'success');
                }
            } else {
                showAlert('Erreur', 'La synchronisation a échoué.', 'error');
            }
        } catch (e) {
            console.error('Sync failed:', e);
            showAlert('Erreur', 'Un problème est survenu lors de la synchronisation.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            onClose();
        } catch (e) {
            console.error('Logout failed:', e);
        }
    };

    const doEmptyBucket = async () => {
        const success = await emptyAudiosBucket(session?.user?.id);
        if (success) {
            await clearRecordings();
            if (onDataCleared) onDataCleared();
            showAlert('Succès', 'Le cloud et le stockage local ont été vidés.', 'success');
        } else {
            showAlert('Erreur', 'Impossible de vider le bucket.', 'error');
        }
    };

    const handleEmptyBucket = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('⚠️ Tous les fichiers audio seront supprimés. Continuer ?')) {
                doEmptyBucket();
            }
        } else {
            Alert.alert(
                '⚠️ Vider le cloud',
                'Tous les fichiers audio seront supprimés du cloud. Cette action est irréversible.',
                [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer tout', style: 'destructive', onPress: doEmptyBucket },
                ]
            );
        }
    };

    if (!isRendered) return null;

    return (
        <View style={styles.container}>
            {/* Overlay sombre cliquable pour fermer */}
            <Animated.View
                style={[styles.overlay, { opacity: overlayOpacity }]}
            >
                <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            {/* Drawer animé */}
            <Animated.View
                style={[
                    styles.drawer,
                    { transform: [{ translateX: slideAnim }] },
                    Platform.OS === 'web'
                        ? { boxShadow: '4px 0 15px rgba(0,0,0,0.15)' }
                        : { shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 }
                ]}
            >
                {/* Header */}
                <View style={[styles.header, Platform.OS === 'web' ? { paddingTop: 20 } : { paddingTop: 48 }]}>
                    <View style={styles.headerTitleContainer}>
                        <Settings size={20} color="#292524" style={{ marginRight: 8 }} />
                        <Text style={styles.headerTitle}>Paramètres</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#78716C" />
                    </TouchableOpacity>
                </View>

                {/* Infos utilisateur */}
                {session?.user ? (
                    <View style={styles.userInfoContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {session.user.email?.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <Text style={styles.emailText} numberOfLines={1}>
                            {session.user.email}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.userInfoContainer}>
                        <View style={[styles.avatar, { backgroundColor: '#A8A29E' }]}>
                            <Text style={styles.avatarText}>?</Text>
                        </View>
                        <Text style={styles.notConnectedText}>
                            Connecte-toi pour sauvegarder{'\n'}tes pensées dans le cloud
                        </Text>
                    </View>
                )}

                <View style={styles.separator} />

                {/* Menu items — seulement si connecté */}
                {session?.user ? (
                    <View style={styles.menuContainer}>
                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleSync}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#78350F" style={styles.menuIcon} />
                            ) : (
                                <CloudUpload size={20} color="#78350F" style={styles.menuIcon} />
                            )}
                            <Text style={styles.menuItemText}>
                                {isSyncing ? 'Synchronisation...' : 'Synchroniser mes pensées'}
                            </Text>
                        </TouchableOpacity>

                        {/* Wi‑Fi‑only toggle */}
                        <View style={styles.menuItem}>
                            <Switch
                                value={wifiOnly}
                                onValueChange={async (value) => {
                                    setWifiOnly(value);
                                    await setWifiOnlyPreference(value);
                                    showAlert('Info', value ? 'Synchronisation Wi‑Fi uniquement activée' : 'Synchronisation Wi‑Fi uniquement désactivée', 'info');
                                }}
                            />
                            <Text style={styles.menuItemText}>Wi‑Fi uniquement (uploads autorisés en 4G)</Text>
                        </View>

                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                            <LogOut size={20} color="#292524" style={styles.menuIcon} />
                            <Text style={styles.menuItemText}>Se déconnecter</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.menuContainer}>
                        <Text style={styles.guestHint}>
                            Les enregistrements sont sauvegardés{'\n'}localement sur cet appareil.
                        </Text>

                        <TouchableOpacity
                            style={styles.authButton}
                            onPress={() => { onClose(); if (onGoToAuth) onGoToAuth('login'); }}
                        >
                            <Text style={styles.authButtonText}>Se connecter</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.authButton, styles.authButtonOutline]}
                            onPress={() => { onClose(); if (onGoToAuth) onGoToAuth('signup'); }}
                        >
                            <Text style={styles.authButtonOutlineText}>Créer un compte</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Logo size={24} style={styles.footerLogo} />
                    <Text style={styles.footerText}>KeepYourSeed v1.0</Text>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    overlayTouchable: { flex: 1 },
    drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#FAF7F2' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#D4A574' },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#292524' },
    closeButton: { padding: 4 },
    userInfoContainer: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#78350F', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
    emailText: { fontSize: 14, color: '#78716C' },
    separator: { height: 1, backgroundColor: '#D4A574', marginHorizontal: 20 },
    menuContainer: { flex: 1, paddingTop: 8 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
    menuIcon: { marginRight: 16 },
    menuItemTextDanger: { fontSize: 16, color: '#ef4444' },
    menuItemText: { fontSize: 16, color: '#292524' },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#D4A574', alignItems: 'center' },
    footerLogo: { marginBottom: 6 },
    footerText: { fontSize: 12, color: '#78716C' },
    notConnectedText: { fontSize: 14, color: '#78716C', textAlign: 'center', lineHeight: 20 },
    guestHint: { fontSize: 14, color: '#A8A29E', textAlign: 'center', paddingHorizontal: 20, paddingVertical: 24, lineHeight: 20, fontStyle: 'italic' },
    authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#78350F', marginHorizontal: 20, marginBottom: 12, paddingVertical: 14, borderRadius: 12 },
    authButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
    authButtonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#78350F' },
    authButtonOutlineText: { fontSize: 16, fontWeight: '600', color: '#78350F' }
});
