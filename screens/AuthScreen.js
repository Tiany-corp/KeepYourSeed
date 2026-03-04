import React, { useState } from 'react';
import LoginScreen from './LoginScreen';
import SignUpScreen from './SignUpScreen';

export default function AuthScreen({ onGoBack }) {
    const [isLogin, setIsLogin] = useState(true);

    return (
        <>
            {isLogin ? (
                <LoginScreen onSwitchToSignUp={() => setIsLogin(false)} onGoBack={onGoBack} />
            ) : (
                <SignUpScreen onSwitchToLogin={() => setIsLogin(true)} onGoBack={onGoBack} />
            )}
        </>
    );
}
