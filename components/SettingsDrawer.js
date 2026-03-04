import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Alert, StyleSheet } from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../services/supabase';
import { clearRecordings } from '../services/storage';
import { emptyAudiosBucket } from '../services/cloud';
import { Settings, X, Trash2, LogOut } from 'lucide-react-native';
import Logo from './Logo';

const DRAWER_WIDTH = 280;

export default function SettingsDrawer({ visible, onClose, session, onDataCleared }) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);
    const { showAlert } = useAlert();

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
                        <TouchableOpacity style={styles.menuItem} onPress={handleEmptyBucket}>
                            <Trash2 size={20} color="#ef4444" style={styles.menuIcon} />
                            <Text style={styles.menuItemTextDanger}>Vider le cloud</Text>
                        </TouchableOpacity>

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
    guestHint: { fontSize: 14, color: '#A8A29E', textAlign: 'center', paddingHorizontal: 20, paddingVertical: 24, lineHeight: 20, fontStyle: 'italic' }
});
