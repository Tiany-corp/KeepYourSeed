import React, { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { signInWithGoogle } from '../services/googleAuth';
import Logo from '../components/Logo';

export default function SignUpScreen({ onSwitchToLogin, onShowTerms, onGoBack }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    async function signUpWithEmail() {
        if (password !== confirmPassword) {
            Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
            return;
        }

        setLoading(true);
        const { data: { session }, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            console.log("Erreur complète:", error);
            Alert.alert("Erreur d'inscription", error.message);
        } else if (!session) {
            Alert.alert('Vérifiez vos emails', 'Un lien de confirmation a été envoyé à votre adresse email.');
        }

        setLoading(false);
    }

    async function handleGoogleSignIn() {
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            Alert.alert('Erreur', error.message);
        } finally {
            setGoogleLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
                <Logo size={80} style={styles.logo} />
                <Text style={styles.title}>Créer un compte</Text>

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

                <View style={[styles.inputContainer, styles.mt2]}>
                    <TextInput
                        onChangeText={(text) => setConfirmPassword(text)}
                        value={confirmPassword}
                        secureTextEntry={true}
                        placeholder="Confirmer le mot de passe"
                        autoCapitalize={'none'}
                        style={styles.input}
                        placeholderTextColor="#999"
                    />
                </View>

                <View style={[styles.inputContainer, styles.mt5]}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={signUpWithEmail}
                        disabled={loading || googleLoading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>S'inscrire</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.separator}>
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>ou</Text>
                    <View style={styles.separatorLine} />
                </View>

                <View style={styles.inputContainer}>
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={handleGoogleSignIn}
                        disabled={loading || googleLoading}
                    >
                        {googleLoading ? (
                            <ActivityIndicator color="#292524" />
                        ) : (
                            <View style={styles.googleButtonContent}>
                                <Text style={styles.googleIcon}>G</Text>
                                <Text style={styles.googleButtonText}>Continuer avec Google</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={[styles.inputContainer, styles.mt5]}>
                    <Text style={styles.secondaryText}>Déjà un compte ?</Text>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onSwitchToLogin}
                        disabled={loading || googleLoading}
                    >
                        <Text style={styles.secondaryButtonText}>Se connecter</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onShowTerms} style={{ marginTop: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#A8A29E', fontSize: 12, textAlign: 'center' }}>
                        En vous inscrivant, vous acceptez nos{'\n'}
                        <Text style={{ color: '#78350F', fontWeight: 'bold', textDecorationLine: 'underline' }}>Conditions d'Utilisation</Text>
                    </Text>
                </TouchableOpacity>

                {onGoBack && (
                    <TouchableOpacity onPress={onGoBack} style={{ marginTop: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#78716C', fontSize: 14 }}>Continuer sans compte</Text>
                    </TouchableOpacity>
                )}
            </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF7F2' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 400, alignSelf: 'center' },
    logo: { alignSelf: 'center', marginBottom: 20 },
    title: { fontSize: 30, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, color: '#292524' },
    inputContainer: { paddingVertical: 4 },
    input: { backgroundColor: '#F5F0E8', padding: 16, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#D4A574', color: '#292524' },
    mt2: { marginTop: 8 },
    mt5: { marginTop: 20 },
    primaryButton: { backgroundColor: '#78350F', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    secondaryText: { textAlign: 'center', color: '#78716C', marginBottom: 8 },
    secondaryButton: { padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#78350F' },
    secondaryButtonText: { color: '#78350F', fontSize: 16, fontWeight: 'bold' },
    separator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    separatorLine: { flex: 1, height: 1, backgroundColor: '#D4A574' },
    separatorText: { marginHorizontal: 12, color: '#78716C', fontSize: 14 },
    googleButton: { padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4A574', elevation: 1 },
    googleButtonContent: { flexDirection: 'row', alignItems: 'center' },
    googleIcon: { fontSize: 20, fontWeight: 'bold', color: '#4285F4', marginRight: 10 },
    googleButtonText: { color: '#292524', fontSize: 16, fontWeight: '600' },
});
