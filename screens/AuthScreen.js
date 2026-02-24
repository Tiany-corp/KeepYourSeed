import React, { useState } from 'react';
import LoginScreen from './LoginScreen';
import SignUpScreen from './SignUpScreen';

export default function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);

    return (
        <>
            {isLogin ? (
                <LoginScreen onSwitchToSignUp={() => setIsLogin(false)} />
            ) : (
                <SignUpScreen onSwitchToLogin={() => setIsLogin(true)} />
            )}
        </>
    );
}
