import React, { useState, useEffect } from 'react';
import LoginScreen from './LoginScreen';
import SignUpScreen from './SignUpScreen';
import TermsScreen from './TermsScreen';

export default function AuthScreen({ route, onGoBack }) {
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'terms'

    useEffect(() => {
        if (route?.params?.initialMode) {
            setMode(route.params.initialMode);
        }
    }, [route?.params?.initialMode]);

    if (mode === 'terms') {
        return <TermsScreen onBack={() => setMode('signup')} />;
    }

    return (
        <>
            {mode === 'login' ? (
                <LoginScreen 
                    onSwitchToSignUp={() => setMode('signup')} 
                    onGoBack={onGoBack} 
                />
            ) : (
                <SignUpScreen 
                    onSwitchToLogin={() => setMode('login')} 
                    onShowTerms={() => setMode('terms')}
                    onGoBack={onGoBack} 
                />
            )}
        </>
    );
}
