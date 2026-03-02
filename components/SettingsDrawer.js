import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { clearRecordings } from '../services/storage';
import Logo from './Logo';

const DRAWER_WIDTH = 280;

export default function SettingsDrawer({ visible, onClose, session, onDataCleared }) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsRendered(true);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
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
        const { emptyAudiosBucket } = require('../services/cloud');
        const success = await emptyAudiosBucket(session?.user?.id);
        if (success) {
            await clearRecordings();
            if (onDataCleared) onDataCleared();
            Alert.alert('✅ Succès', 'Le cloud et le stockage local ont été vidés.');
        } else {
            Alert.alert('❌ Erreur', 'Impossible de vider le bucket.');
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
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999 }}>
            {/* Overlay sombre cliquable pour fermer */}
            <Animated.View
                style={{ ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }, opacity: overlayOpacity }}
            >
                <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} />
            </Animated.View>

            {/* Drawer animé */}
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: DRAWER_WIDTH,
                    backgroundColor: '#fff',
                    transform: [{ translateX: slideAnim }],
                    ...(Platform.OS === 'web'
                        ? { boxShadow: '4px 0 15px rgba(0,0,0,0.15)' }
                        : { shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 }),
                }}
            >
                {/* Header */}
                <View className={`flex-row justify-between items-center px-5 pb-4 border-b border-gray-100 ${Platform.OS === 'web' ? 'pt-5' : 'pt-12'}`}>
                    <Text className="text-lg font-bold text-gray-800">⚙️ Paramètres</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text className="text-xl text-gray-400 p-1">✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Infos utilisateur */}
                {session?.user && (
                    <View className="items-center py-6 px-5">
                        <View className="w-16 h-16 rounded-full bg-blue-500 justify-center items-center mb-3">
                            <Text className="text-white text-2xl font-bold">
                                {session.user.email?.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <Text className="text-sm text-gray-500" numberOfLines={1}>
                            {session.user.email}
                        </Text>
                    </View>
                )}

                <View className="h-px bg-gray-100 mx-5" />

                {/* Menu items */}
                <View className="flex-1 pt-2">
                    <TouchableOpacity className="flex-row items-center py-4 px-5" onPress={handleEmptyBucket}>
                        <Text className="text-xl mr-4">🗑️</Text>
                        <Text className="text-base text-red-500">Vider le cloud</Text>
                    </TouchableOpacity>

                    <View className="h-px bg-gray-100 mx-5" />

                    <TouchableOpacity className="flex-row items-center py-4 px-5" onPress={handleLogout}>
                        <Text className="text-xl mr-4">🚪</Text>
                        <Text className="text-base text-gray-800">Se déconnecter</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View className="p-5 border-t border-gray-100 items-center">
                    <Logo size={24} style={{ marginBottom: 6 }} />
                    <Text className="text-xs text-gray-400">KeepYourSeed v1.0</Text>
                </View>
            </Animated.View>
        </View>
    );
}
