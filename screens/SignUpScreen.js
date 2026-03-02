import React, { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';

export default function SignUpScreen({ onSwitchToLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
            Alert.alert('Erreur d\'inscription', error.message);
        } else if (!session) {
            Alert.alert('Vérifiez vos emails', 'Un lien de confirmation a été envoyé à votre adresse email.');
        }

        setLoading(false);
    }

    return (
        <View className="flex-1 justify-center p-5 bg-[#FAF7F2]">
            <View className="w-full max-w-sm self-center">
                <Logo size={80} style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text className="text-3xl font-bold text-center mb-10 text-gray-800">Créer un compte</Text>

                <View className="py-1">
                    <TextInput
                        onChangeText={(text) => setEmail(text)}
                        value={email}
                        placeholder="email@address.com"
                        autoCapitalize={'none'}
                        className="bg-gray-100 p-4 rounded-lg text-base border border-gray-200"
                        placeholderTextColor="#999"
                    />
                </View>

                <View className="py-1 mt-2">
                    <TextInput
                        onChangeText={(text) => setPassword(text)}
                        value={password}
                        secureTextEntry={true}
                        placeholder="Mot de passe"
                        autoCapitalize={'none'}
                        className="bg-gray-100 p-4 rounded-lg text-base border border-gray-200"
                        placeholderTextColor="#999"
                    />
                </View>

                <View className="py-1 mt-2">
                    <TextInput
                        onChangeText={(text) => setConfirmPassword(text)}
                        value={confirmPassword}
                        secureTextEntry={true}
                        placeholder="Confirmer le mot de passe"
                        autoCapitalize={'none'}
                        className="bg-gray-100 p-4 rounded-lg text-base border border-gray-200"
                        placeholderTextColor="#999"
                    />
                </View>

                <View className="py-1 mt-5">
                    <TouchableOpacity
                        className="bg-blue-500 p-4 rounded-lg items-center justify-center"
                        onPress={signUpWithEmail}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-bold">S'inscrire</Text>}
                    </TouchableOpacity>
                </View>

                <View className="py-1 mt-5">
                    <Text className="text-center text-gray-500 mb-2">Déjà un compte ?</Text>
                    <TouchableOpacity
                        className="p-4 rounded-lg items-center justify-center bg-transparent border border-blue-500"
                        onPress={onSwitchToLogin}
                        disabled={loading}
                    >
                        <Text className="text-blue-500 text-base font-bold">Se connecter</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
