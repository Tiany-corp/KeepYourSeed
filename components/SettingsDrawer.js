import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Alert, StyleSheet, Switch, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../services/supabase';
import { clearRecordings, getWifiOnlyPreference, setWifiOnlyPreference } from '../services/storage';
import { emptyAudiosBucket } from '../services/cloud';
import { fixServerDatesFromLocal, fixLocalDatesFromServer } from '../services/fixDates';
import { recoverOrphanedAudios, undoRecoveredAudios } from '../services/recover';
import { purgeHardDeletedCloudItems } from '../services/sync';
import { Settings, X, Trash2, LogOut, LogIn, CloudUpload, Rocket, CalendarClock, LifeBuoy, Flame, DatabaseBackup } from 'lucide-react-native';
import Logo from './Logo';

const DRAWER_WIDTH = 280;

export default function SettingsDrawer({ visible, onClose, session, onDataCleared, onGoToAuth }) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [wifiOnly, setWifiOnly] = useState(false);
    const { showAlert } = useAlert();
    const navigation = useNavigation();

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
                    if (result.pushed > 0) msg += `${result.pushed} envoyée(s). \n`;
                    if (result.pulled > 0) {
                        msg += `${result.pulled} récupérée(s)`;
                        if (result.newTitles && result.newTitles.length > 0) {
                            const titles = result.newTitles.slice(0, 3).map(t => `"${t}"`).join(', ');
                            const more = result.newTitles.length > 3 ? ` et ${result.newTitles.length - 3} autre(s)` : '';
                            msg += ` : ${titles}${more}.`;
                        } else {
                            msg += '.';
                        }
                    }
                    showAlert('Succès', msg.trim() || 'Synchronisation terminée !', 'success');
                    if (onDataCleared) onDataCleared(); // Rafraîchir l'historique
                }

                // --- ALERTE GROUPÉE POUR LES SUPPRESSIONS DÉFINITIVES ---
                if (result.orphans > 0) {
                    const confirmMsg = `${result.orphans} vocal/vocaux ont été supprimés définitivement du Cloud. Veux-tu les supprimer de cet appareil pour rester synchronisé ?`;
                    setTimeout(() => {
                        if (Platform.OS === 'web') {
                            if (window.confirm(confirmMsg)) {
                                handlePurgeCloudDeletes();
                            }
                        } else {
                            Alert.alert(
                                'Désynchronisation détectée',
                                confirmMsg,
                                [
                                    { text: 'Garder', style: 'cancel' },
                                    { text: 'Supprimer', style: 'destructive', onPress: handlePurgeCloudDeletes }
                                ]
                            );
                        }
                    }, 500); // Petit délai pour laisser la première alerte de succès s'afficher
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

    const handleForcePush = async () => {
        if (!session?.user?.id) return;
        setIsSyncing(true);
        try {
            const { forcePushAllLocalNotes } = require('../services/sync');
            const result = await forcePushAllLocalNotes(session.user.id);
            if (result.success) {
                if (result.repaired > 0 || result.pushed > 0) {
                    showAlert('Succès', `${result.repaired} notes réparées, ${result.pushed} envoyées.`, 'success');
                    if (onDataCleared) onDataCleared();
                } else {
                    showAlert('Info', 'Aucune note locale bloquée n\'a été trouvée.', 'info');
                }
            } else {
                showAlert('Erreur', 'Le forçage a échoué.', 'error');
            }
        } catch (e) {
            console.error('Force push failed:', e);
            showAlert('Erreur', 'Une erreur est survenue lors du forçage de l\'envoi.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleFixDates = async () => {
        if (!session?.user?.id) return;
        setIsSyncing(true);
        try {
            const result = await fixServerDatesFromLocal(session.user.id);
            if (result.success) {
                if (result.fixed > 0) {
                    showAlert('Succès', `${result.fixed} dates ont été réparées sur le serveur !`, 'success');
                    if (onDataCleared) onDataCleared();
                } else {
                    showAlert('Info', 'Toutes les dates semblent déjà correctes.', 'info');
                }
            } else {
                showAlert('Erreur', 'Le script de date a échoué.', 'error');
            }
        } catch (e) {
            console.error('Date fix failed:', e);
            showAlert('Erreur', 'Erreur critique du script.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleFixLocalDates = async () => {
        setIsSyncing(true);
        try {
            const result = await fixLocalDatesFromServer(session?.user?.id);
            if (result.success) {
                showAlert('Succès', `${result.fixed} vocaux ont récupéré leur vraie date originelle depuis Supabase.`, 'success');
                if (onDataCleared) onDataCleared();
            } else {
                showAlert('Erreur', result.msg || "Échec de l'alignement des dates.", 'error');
            }
        } catch (e) {
            console.error('Fix local dates fail:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleRecover = async () => {
        setIsSyncing(true);
        try {
            const result = await recoverOrphanedAudios();
            if (result.success) {
                if (result.count > 0) {
                    showAlert('Sauvetage réussi', `${result.count} vocaux perdus ont été restaurés ! Va vite voir ta liste.`, 'success');
                    if (onDataCleared) onDataCleared();
                } else {
                    showAlert('Info', 'Aucun vocal orphelin trouvé dans ton navigateur.', 'info');
                }
            } else {
                showAlert('Erreur', result.msg || 'La récupération a échoué.', 'error');
            }
        } catch (e) {
            console.error('Recover failed:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUndoRecover = async () => {
        setIsSyncing(true);
        try {
            const result = await undoRecoveredAudios();
            if (result.success) {
                if (result.count > 0) {
                    showAlert('Purge réussie', `${result.count} fichiers audio ont été définitivement supprimés.`, 'success');
                    if (onDataCleared) onDataCleared();
                } else {
                    showAlert('Info', 'Aucun vocal de récupération à purger.', 'info');
                }
            }
        } catch (e) {
            console.error('Undo fail:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePurgeCloudDeletes = async () => {
        setIsSyncing(true);
        try {
            const result = await purgeHardDeletedCloudItems(session?.user?.id);
            if (result.success) {
                if (result.count > 0) {
                    showAlert('Nettoyage', `${result.count} fichiers supprimés sur Supabase ont été purgés de ton téléphone.`, 'success');
                    if (onDataCleared) onDataCleared();
                } else {
                    showAlert('Info', 'Ton téléphone est déjà aligné avec Supabase.', 'info');
                }
            }
        } catch (e) {
            console.error('Hard purge fail:', e);
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
                    <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
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

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleForcePush}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#78350F" style={styles.menuIcon} />
                            ) : (
                                <Rocket size={20} color="#059669" style={styles.menuIcon} />
                            )}
                            <Text style={[styles.menuItemText, { color: '#059669' }]}>
                                Forcer l'envoi des notes locales
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleFixDates}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#78350F" style={styles.menuIcon} />
                            ) : (
                                <CalendarClock size={20} color="#CA8A04" style={styles.menuIcon} />
                            )}
                            <Text style={[styles.menuItemText, { color: '#CA8A04' }]}>
                                Corriger les dates sur le serveur
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleFixLocalDates}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#059669" style={styles.menuIcon} />
                            ) : (
                                <CalendarClock size={20} color="#059669" style={styles.menuIcon} />
                            )}
                            <Text style={[styles.menuItemText, { color: '#059669' }]}>
                                Absorber les dates du serveur
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleRecover}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#991B1B" style={styles.menuIcon} />
                            ) : (
                                <LifeBuoy size={20} color="#991B1B" style={styles.menuIcon} />
                            )}
                            <Text style={[styles.menuItemText, { color: '#991B1B', fontWeight: 'bold' }]}>
                                Urgence: Récupérer mémos perdus
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleUndoRecover}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#DC2626" style={styles.menuIcon} />
                            ) : (
                                <Flame size={20} color="#DC2626" style={styles.menuIcon} />
                            )}
                            <Text style={[styles.menuItemText, { color: '#DC2626' }]}>
                                Purger vocaux de récupération
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handlePurgeCloudDeletes}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size={20} color="#78350F" style={styles.menuIcon} />
                            ) : (
                                <DatabaseBackup size={20} color="#000000" style={styles.menuIcon} />
                            )}
                            <Text style={[styles.menuItemText, { color: '#000000', fontWeight: 'bold' }]}>
                                Synchro destructive (Aligner tél)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); navigation.navigate('Trash'); }}>
                            <Trash2 size={20} color="#78350F" style={styles.menuIcon} />
                            <Text style={styles.menuItemText}>Ma Corbeille</Text>
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
                            <LogOut size={20} color="#78350F" style={styles.menuIcon} />
                            <Text style={styles.menuItemText}>Se déconnecter</Text>
                        </TouchableOpacity>
                    </ScrollView>
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
