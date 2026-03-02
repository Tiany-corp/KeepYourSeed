import React, { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';

export default function LoginScreen({ onSwitchToSignUp }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) Alert.alert('Erreur de connexion', error.message);
        setLoading(false);
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Logo size={100} style={styles.logo} />
                <Text style={styles.title}>Se connecter</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        onChangeText={(text) => setEmail(text)}
                        value={email}
                        placeholder="email@address.com"
                        autoCapitalize={'none'}
                        style={styles.input}
                        placeholderTextColor="#999"
                    />
                </View>

                <View style={[styles.inputContainer, styles.mt2]}>
                    <TextInput
                        onChangeText={(text) => setPassword(text)}
                        value={password}
                        secureTextEntry={true}
                        placeholder="Mot de passe"
                        autoCapitalize={'none'}
                        style={styles.input}
                        placeholderTextColor="#999"
                    />
                </View>

                <View style={[styles.inputContainer, styles.mt5]}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={signInWithEmail}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Se connecter</Text>}
                    </TouchableOpacity>
                </View>

                <View style={[styles.inputContainer, styles.mt5]}>
                    <Text style={styles.secondaryText}>Pas encore de compte ?</Text>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onSwitchToSignUp}
                        disabled={loading}
                    >
                        <Text style={styles.secondaryButtonText}>Créer un compte</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#FAF7F2', // seed-bg
    },
    card: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    logo: {
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 40,
        color: '#292524', // seed-text
    },
    inputContainer: {
        paddingVertical: 4,
    },
    input: {
        backgroundColor: '#F5F0E8', // seed-card
        padding: 16,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#D4A574', // seed-border
        color: '#292524',
    },
    mt2: {
        marginTop: 8,
    },
    mt5: {
        marginTop: 20,
    },
    primaryButton: {
        backgroundColor: '#78350F', // seed-primary
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryText: {
        textAlign: 'center',
        color: '#78716C', // seed-muted
        marginBottom: 8,
    },
    secondaryButton: {
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#78350F',
    },
    secondaryButtonText: {
        color: '#78350F',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
