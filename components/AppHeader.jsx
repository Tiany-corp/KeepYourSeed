import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Menu, Clock } from 'lucide-react-native';
import Logo from './Logo';

export default function AppHeader({ onOpenSettings, onGoToHistory }) {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onOpenSettings} style={styles.iconButton}>
                <Menu size={22} color="#78350F" strokeWidth={1.5} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
                <Logo size={24} />
                <Text style={styles.headerTitleText}>KeepYourSeed</Text>
            </View>
            <TouchableOpacity onPress={onGoToHistory} style={styles.iconButton}>
                <Clock size={22} color="#78350F" strokeWidth={1.5} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D4A574', backgroundColor: '#FAF7F2' },
    iconButton: { padding: 8 },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    headerTitleText: { fontSize: 18, fontWeight: 'bold', color: '#292524' }
});
