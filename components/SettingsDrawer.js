import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Alert, StyleSheet, Switch, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAlert } from '../contexts/AlertContext';
import { supabase } from '../services/supabase';
import { clearRecordings, getWifiOnlyPreference, setWifiOnlyPreference, getAutoSyncPreference, setAutoSyncPreference, getRecordings, calculateStorageSize, formatSize } from '../services/storage';
import { Settings, X, Trash2, LogOut, LogIn, CloudUpload, ShieldCheck, Database, Info, Wifi, RefreshCcw, Inbox, Cloud, CloudOff } from 'lucide-react-native';
import { fetchTotalCloudUsage } from '../services/cloud';
import Logo from './Logo';

const DRAWER_WIDTH = 280;

export default function SettingsDrawer({ visible, onClose, session, onDataCleared, onGoToAuth }) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [wifiOnly, setWifiOnly] = useState(false);
    const [autoSync, setAutoSync] = useState(true);
    const { showAlert } = useAlert();
    const navigation = useNavigation();
    const [storageStats, setStorageStats] = useState({ local: 0, total: 0, percent: 100, formattedSize: '0 Mo' });
    const [cloudUsage, setCloudUsage] = useState(0); // en octets
    const CLOUD_QUOTA = 30 * 1024 * 1024; // 30 Mo en octets

    const loadStorageStats = async () => {
        const recordings = await getRecordings();
        const nonDeleted = recordings.filter(r => !r.deletedAt);
        const local = nonDeleted.filter(r => r.localUri).length;
        const total = nonDeleted.length;
        const percent = total > 0 ? Math.round((local / total) * 100) : 100;
        
        const sizeBytes = await calculateStorageSize(recordings);
        const formattedSize = formatSize(sizeBytes);
        
        // Estimation du poids manquant (1 min = ~0.5 Mo)
        const missing = nonDeleted.filter(r => !r.localUri);
        const totalMissingDurationMs = missing.reduce((sum, r) => sum + (r.duration || 60000), 0);
        const missingMo = ((totalMissingDurationMs / 60000) * 0.5).toFixed(1);
        
        setStorageStats({ local, total, percent, formattedSize, missingMo });

        // Charger aussi l'usage Cloud réel depuis Supabase
        if (session?.user?.id) {
            const usage = await fetchTotalCloudUsage(session.user.id);
            setCloudUsage(usage);
        }
    };

    // Load preferences and stats on mount or when visible
    useEffect(() => {
        if (visible) {
            loadStorageStats();
            (async () => {
                const pref = await getWifiOnlyPreference();
                setWifiOnly(pref);
                const autoSyncPref = await getAutoSyncPreference();
                setAutoSync(autoSyncPref);
            })();
        }
    }, [visible]);

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
                    loadStorageStats(); // Mettre à jour les stats de stockage
                } else {
                    showAlert('À jour', 'Toutes vos pensées sont déjà synchronisées.', 'success');
                    loadStorageStats();
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

    const handleClearLocalData = () => {
        const confirmMsg = "Supprimer toutes les notes sur ce téléphone ? Elles resteront sur ton Cloud.";
        const executeClear = async () => {
            setIsSyncing(true);
            try {
                await clearRecordings();
                if (onDataCleared) onDataCleared();
                showAlert('Succès', 'Stockage local vidé.', 'success');
                loadStorageStats();
            } finally {
                setIsSyncing(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) executeClear();
        } else {
            Alert.alert('⚠️ Attention', confirmMsg, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Vider', style: 'destructive', onPress: executeClear }
            ]);
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
                        
                        {/* Info de stockage CLOUD */}
                        <View style={{ paddingVertical: 14, paddingHorizontal: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <Cloud size={20} color="#78350F" style={[styles.menuIcon, { marginTop: 2 }]} />
                                <View style={{ flex: 1 }}>
                                    {/* Ligne 1 : Titre et Chiffres */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={[styles.menuItemText, { fontSize: 15 }]}>Stockage Cloud</Text>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: (cloudUsage / CLOUD_QUOTA) > 0.9 ? '#991B1B' : '#78350F' }}>
                                            {formatSize(cloudUsage)} <Text style={{ color: '#A8A29E', fontWeight: '500' }}>/ 30 Mo</Text>
                                        </Text>
                                    </View>
                                    
                                    {/* Ligne 2 : La barre */}
                                    <View style={{ height: 6, backgroundColor: '#E8D5BF', borderRadius: 3, overflow: 'hidden' }}>
                                        <View 
                                            style={{ 
                                                height: '100%', 
                                                width: `${Math.min((cloudUsage / CLOUD_QUOTA) * 100, 100)}%`,
                                                backgroundColor: (cloudUsage / CLOUD_QUOTA) > 0.9 ? '#DC2626' : '#78350F',
                                                borderRadius: 3
                                            }} 
                                        />
                                    </View>

                                    {/* Ligne 3 : Alerte dynamique selon le quota */}
                                    {cloudUsage >= CLOUD_QUOTA ? (
                                        <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 6, fontWeight: '700' }}>
                                            ❌ Quota atteint. Vos prochains audios seront sauvegardés uniquement sur ce téléphone.
                                        </Text>
                                    ) : (cloudUsage / CLOUD_QUOTA) > 0.9 ? (
                                        <Text style={{ fontSize: 11, color: '#D97706', marginTop: 6, fontWeight: '500' }}>
                                            ⚠️ Quota presque atteint, pensez à faire du tri.
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                        {/* Info de stockage simplifiée */}
                        <View style={{ paddingVertical: 16, paddingHorizontal: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Database size={20} color="#78350F" style={styles.menuIcon} />
                                    <View>
                                        <Text style={styles.menuItemText}>Stockage local</Text>
                                        <Text style={{ fontSize: 13, color: '#A8A29E', marginTop: 2 }}>{storageStats.formattedSize} ({storageStats.local} audios)</Text>
                                    </View>
                                </View>
                                {storageStats.local < storageStats.total && (
                                    <TouchableOpacity 
                                        style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center' }}
                                        onPress={async () => {
                                            setIsSyncing(true);
                                            const recordings = await getRecordings();
                                            const { cacheSupabaseAudioLocally } = require('../services/storage');
                                            await cacheSupabaseAudioLocally(recordings);
                                            await loadStorageStats();
                                            setIsSyncing(false);
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '600' }}>
                                            {(storageStats.total - storageStats.local)} en attente
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>
                                            (~{storageStats.missingMo} Mo)
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={handleSync}
                            disabled={isSyncing}
                        >
                            <RefreshCcw size={20} color="#78350F" style={styles.menuIcon} />
                            <Text style={styles.menuItemText}>
                                {isSyncing ? 'Synchronisation...' : 'Synchroniser mes pensées'}
                            </Text>
                            {isSyncing && <ActivityIndicator size="small" color="#78350F" style={{ marginLeft: 10 }} />}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.menuItem} 
                            onPress={() => { onClose(); navigation.navigate('Trash'); }}
                        >
                            <Trash2 size={20} color="#78350F" style={styles.menuIcon} />
                            <Text style={styles.menuItemText}>Ma Corbeille</Text>
                        </TouchableOpacity>

                        <View style={[styles.menuItem, { paddingVertical: 8, justifyContent: 'space-between' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Wifi size={20} color="#78350F" style={styles.menuIcon} />
                                <Text style={styles.menuItemText}>Wi-Fi uniquement</Text>
                            </View>
                            <Switch
                                value={wifiOnly}
                                onValueChange={async (value) => {
                                    setWifiOnly(value);
                                    await setWifiOnlyPreference(value);
                                }}
                                trackColor={{ false: '#E7E5E4', true: '#D4A574' }}
                                thumbColor={wifiOnly ? '#78350F' : '#F5F5F4'}
                            />
                        </View>

                        <View style={[styles.menuItem, { paddingVertical: 8, justifyContent: 'space-between' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <CloudOff size={20} color="#78350F" style={styles.menuIcon} />
                                <Text style={styles.menuItemText}>Synchro auto</Text>
                            </View>
                            <Switch
                                value={autoSync}
                                onValueChange={async (value) => {
                                    setAutoSync(value);
                                    await setAutoSyncPreference(value);
                                }}
                                trackColor={{ false: '#E7E5E4', true: '#D4A574' }}
                                thumbColor={autoSync ? '#78350F' : '#F5F5F4'}
                            />
                        </View>

                        <View style={[styles.separator, { marginVertical: 16 }]} />

                        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                            <LogOut size={20} color="#991B1B" style={styles.menuIcon} />
                            <Text style={[styles.menuItemText, { color: '#991B1B' }]}>Se déconnecter</Text>
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
    emailText: { fontSize: 14, color: '#78716C', marginBottom: 12 },
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
    authButtonOutlineText: { fontSize: 16, fontWeight: '600', color: '#78350F' },
    section: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#A8A29E',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    statsContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E8D5BF',
        // Shadow for premium look
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
            android: { elevation: 2 },
            web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }
        })
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statsLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#78350F',
    },
    statsValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#78350F',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#F5F0E8',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#D4A574',
    },
    statsSublabel: {
        fontSize: 12,
        color: '#A8A29E',
    },
    statsFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    downloadBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#D4A574',
        textDecorationLine: 'underline',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
