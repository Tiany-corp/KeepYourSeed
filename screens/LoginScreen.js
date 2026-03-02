import React, { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';

export default function LoginScreen({ onSwitchToSignUp }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ //Ca ca envoie une requete à supabase mais il sait ou mettre le compte grace à quoi ?
            email: email,
            password: password,
        });

        if (error) Alert.alert('Erreur de connexion', error.message);
        setLoading(false);
    }

    return (
        <View className="flex-1 justify-center p-5 bg-[#FAF7F2]">
            <View className="w-full max-w-sm self-center">
                <Logo size={100} style={{ alignSelf: 'center', marginBottom: 20 }} />
                <Text className="text-3xl font-bold text-center mb-10 text-gray-800">Se connecter</Text>

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

                <View className="py-1 mt-5">
                    <TouchableOpacity
                        className="bg-blue-500 p-4 rounded-lg items-center justify-center"
                        onPress={signInWithEmail}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-bold">Se connecter</Text>}
                    </TouchableOpacity>
                </View>

                <View className="py-1 mt-5">
                    <Text className="text-center text-gray-500 mb-2">Pas encore de compte ?</Text>
                    <TouchableOpacity
                        className="p-4 rounded-lg items-center justify-center bg-transparent border border-blue-500"
                        onPress={onSwitchToSignUp}
                        disabled={loading}
                    >
                        <Text className="text-blue-500 text-base font-bold">Créer un compte</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
