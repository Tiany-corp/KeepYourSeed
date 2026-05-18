import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { ArrowLeft, ShieldCheck, Lock, Cloud, Trash2 } from 'lucide-react-native';
import Logo from '../components/Logo';

export default function TermsScreen({ onBack }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={20} color="#78350F" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Conditions d'Utilisation</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.introSection}>
                    <Logo size={60} style={styles.logo} />
                    <Text style={styles.appName}>KeepYourSeed</Text>
                    <Text style={styles.version}>Version Bêta 1.2</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <ShieldCheck size={20} color="#D4A574" style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>1. Objet du Service</Text>
                    </View>
                    <Text style={styles.text}>
                        KeepYourSeed est une plateforme de "capsules temporelles" audio. Elle vous permet d'enregistrer des pensées pour votre "futur vous" ou pour vos proches, avec une livraison différée.
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Lock size={20} color="#D4A574" style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>2. Confidentialité & Données</Text>
                    </View>
                    <Text style={styles.text}>
                        Vos audios sont privés. Grâce au Row Level Security (RLS) de Supabase, seul le propriétaire d'un compte peut accéder à ses propres enregistrements. Nous ne vendons jamais vos données.
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Cloud size={20} color="#D4A574" style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>3. Stockage & Quota</Text>
                    </View>
                    <Text style={styles.text}>
                        Pendant la phase Bêta, chaque utilisateur bénéficie d'un quota de <Text style={styles.bold}>30 Mo</Text> de stockage Cloud gratuit. Au-delà, les nouveaux enregistrements seront stockés exclusivement en local sur votre appareil.
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Trash2 size={20} color="#D4A574" style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>4. Suppression des comptes</Text>
                    </View>
                    <Text style={styles.text}>
                        Vous restez maître de vos données. À tout moment, vous pouvez supprimer vos enregistrements depuis l'Historique ou vider votre cache local depuis les Paramètres.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        En utilisant KeepYourSeed, vous acceptez ces conditions et vous vous engagez à utiliser le service de manière respectueuse.
                    </Text>
                    <TouchableOpacity style={styles.acceptButton} onPress={onBack}>
                        <Text style={styles.acceptButtonText}>J'ai compris</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF7F2',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E8D5BF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#292524',
    },
    backButton: {
        padding: 8,
        backgroundColor: '#F5F0E8',
        borderRadius: 12,
    },
    content: {
        padding: 20,
    },
    introSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logo: {
        marginBottom: 10,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#78350F',
    },
    version: {
        fontSize: 14,
        color: '#A8A29E',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E8D5BF',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
            android: { elevation: 2 },
            web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }
        })
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionIcon: {
        marginRight: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#292524',
    },
    text: {
        fontSize: 15,
        lineHeight: 22,
        color: '#78716C',
    },
    bold: {
        fontWeight: 'bold',
        color: '#78350F',
    },
    footer: {
        marginTop: 20,
        marginBottom: 40,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#A8A29E',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 18,
    },
    acceptButton: {
        backgroundColor: '#78350F',
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 14,
        width: '100%',
        alignItems: 'center',
    },
    acceptButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
