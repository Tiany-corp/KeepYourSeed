import { Platform } from 'react-native';
import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Required for native OAuth to complete properly
if (Platform.OS !== 'web') {
    WebBrowser.maybeCompleteAuthSession();
}

/**
 * Sign in with Google — works on both web and native.
 * On web: uses OAuth redirect (full page redirect to Google).
 * On native: opens an in-app browser via expo-web-browser.
 */
export async function signInWithGoogle() {
    if (Platform.OS === 'web') {
        // Web: simple OAuth redirect
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href.split('#')[0],
            },
        });
        if (error) throw error;
    } else {
        // Native: open browser for auth, then capture tokens
        const redirectUrl = AuthSession.makeRedirectUri();

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;

        // Open the Google auth page in the system browser
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success') {
            const url = new URL(result.url);

            // Supabase returns tokens in the URL fragment (#access_token=...&refresh_token=...)
            const params = new URLSearchParams(url.hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (sessionError) throw sessionError;
            }
        }
    }
}
