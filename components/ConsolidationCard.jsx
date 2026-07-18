import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { X, Mic } from 'lucide-react-native';
import Logo from './Logo';

/**
 * Carte d'exercice de consolidation (synthèse cognitive).
 * Proposée automatiquement quand une pensée a été beaucoup nourrie.
 * Long press → lance l'enregistrement.
 *
 * Props :
 * - parent (object)        : l'enregistrement parent (titre, childrenCount, id)
 * - onLongPress (fn)       : callback long press → démarrer enregistrement synthèse
 * - onDismiss (fn)         : callback pour ignorer l'exercice
 * - isRecording (bool)     : si on est en train d'enregistrer la synthèse
 */
const ConsolidationCard = React.memo(({ parent, onLongPress, onDismiss, isRecording }) => {
    if (!parent) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.sectionLabel}>🧠 Exercice de Synthèse</Text>
            <TouchableOpacity
                style={[styles.card, isRecording && styles.cardRecording]}
                onLongPress={onLongPress}
                delayLongPress={400}
                activeOpacity={0.8}
            >
                <View style={styles.logoWrapper}>
                    <Logo size={32} color={isRecording ? '#B91C1C' : '#D97706'} variant="outline" />
                </View>

                <View style={styles.info}>
                    <Text style={styles.description}>
                        Tu as nourri la pensée <Text style={styles.bold}>"{parent.title || 'Sans titre'}"</Text> {parent.childrenCount} fois. Prends 30s pour te remémorer tes expériences et définir ce que tu veux pour la suite.
                    </Text>
                    <View style={styles.hintRow}>
                        <Mic size={11} color={isRecording ? '#B91C1C' : '#A8A29E'} strokeWidth={2} />
                        <Text style={[styles.hint, isRecording && styles.hintRecording]}>
                            {isRecording ? 'Enregistrement de la synthèse...' : 'Appui long pour synthétiser'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={onDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={14} color="#78716C" strokeWidth={2} />
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
});

export default ConsolidationCard;

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 4,
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#D97706',
        marginBottom: 6,
        marginLeft: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#Fef9f1',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#E8D5BF',
        borderStyle: 'solid',
        shadowColor: '#78350F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
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
        borderWidth: 1,
        borderColor: '#E8D5BF',
    },
    info: {
        flex: 1,
    },
    description: {
        fontSize: 13,
        color: '#292524',
        marginBottom: 6,
        lineHeight: 18,
    },
    bold: {
        fontWeight: 'bold',
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
    dismissBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F5F0E8',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});
