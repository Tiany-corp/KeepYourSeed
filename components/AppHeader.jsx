import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Menu, Clock } from 'lucide-react-native';
import Logo from './Logo';

/**
 * Header réutilisable sur tous les écrans.
 * 
 * Props :
 * - onOpenSettings (fn)      : ouvre le drawer settings (bouton gauche)
 * - title (string)           : texte central (défaut: "KeepYourSeed")
 * - showLogo (bool)          : affiche le logo à côté du titre (défaut: true)
 * - rightContent (JSX)       : contenu custom à droite (remplace le bouton Clock par défaut)
 * - onGoToHistory (fn)       : si pas de rightContent, affiche le bouton Clock
 */
export default function AppHeader({
    onOpenSettings,
    title = 'KeepYourSeed',
    showLogo = true,
    rightContent,
    onGoToHistory,
}) {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onOpenSettings} style={styles.iconButton}>
                <Menu size={22} color="#78350F" strokeWidth={1.5} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
                {showLogo && <Logo size={24} />}
                <Text style={styles.headerTitleText}>{title}</Text>
            </View>

            {rightContent ? (
                rightContent
            ) : onGoToHistory ? (
                <TouchableOpacity onPress={onGoToHistory} style={styles.iconButton}>
                    <Clock size={22} color="#78350F" strokeWidth={1.5} />
                </TouchableOpacity>
            ) : (
                <View style={styles.iconButton} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#D4A574', backgroundColor: '#FAF7F2' },
    iconButton: { padding: 8 },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    headerTitleText: { fontSize: 18, fontWeight: 'bold', color: '#292524' }
});
