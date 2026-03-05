import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { X, Mic } from 'lucide-react-native';
import Logo from './Logo';

/**
 * Carte de pensée épinglée affichée sur l'écran d'accueil.
 * Long press → lance l'enregistrement d'un vocal enfant.
 * 
 * Props :
 * - thought (object)       : l'enregistrement épinglé
 * - onLongPress (fn)       : callback long press → démarrer enregistrement enfant
 * - onUnpin (fn)           : callback pour dépingler
 * - isRecording (bool)     : si on est en train d'enregistrer un enfant
 */
export default function PinnedThought({ thought, onLongPress, onUnpin, isRecording }) {
    if (!thought) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.sectionLabel}>📌 Pensée à nourrir</Text>
            <TouchableOpacity
                style={[styles.card, isRecording && styles.cardRecording]}
                onLongPress={onLongPress}
                delayLongPress={400}
                activeOpacity={0.8}
            >
                <View style={styles.logoWrapper}>
                    <Logo size={24} color={isRecording ? '#B91C1C' : '#78350F'} variant="outline" />
                </View>

                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{thought.title || 'Sans titre'}</Text>
                    <View style={styles.hintRow}>
                        <Mic size={11} color={isRecording ? '#B91C1C' : '#A8A29E'} strokeWidth={2} />
                        <Text style={[styles.hint, isRecording && styles.hintRecording]}>
                            {isRecording ? 'Enregistrement...' : 'Appui long pour nourrir'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.unpinBtn}
                    onPress={onUnpin}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={14} color="#78716C" strokeWidth={2} />
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 4,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#78716C',
        marginBottom: 6,
        marginLeft: 2,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F0E8',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#D4A574',
        borderStyle: 'dashed',
    },
    cardRecording: {
        borderColor: '#B91C1C',
        backgroundColor: '#FEF2F2',
    },
    logoWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FAF7F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#292524',
        marginBottom: 2,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    hint: {
        fontSize: 12,
        color: '#A8A29E',
        fontWeight: '500',
    },
    hintRecording: {
        color: '#B91C1C',
    },
    unpinBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FAF7F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});
