import { Platform, Linking } from 'react-native';
import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Required for native OAuth to complete properly
if (Platform.OS !== 'web') {
    WebBrowser.maybeCompleteAuthSession();
}

/**
 * Extract tokens from a Supabase OAuth callback URL and set the session.
 * Returns true if session was set successfully.
 */
async function extractAndSetSession(url) {
    try {
        const parsed = new URL(url);
        // Supabase returns tokens in the URL fragment (#access_token=...&refresh_token=...)
        const fragment = parsed.hash?.substring(1) || '';
        let params = new URLSearchParams(fragment);
        
        // Fallback si ce n'est pas dans le fragment mais dans les query params
        if (!params.get('access_token')) {
            params = parsed.searchParams;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
            console.log('🔑 [GoogleAuth] Tokens found, setting session...');
            const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            if (error) {
                console.error('🔑 [GoogleAuth] setSession error:', error.message);
                return false;
            }
            console.log('🔑 [GoogleAuth] Session set successfully!');
            return true;
        }
        console.warn('🔑 [GoogleAuth] No tokens found in URL');
        return false;
    } catch (e) {
        console.error('🔑 [GoogleAuth] Error parsing URL:', e.message);
        return false;
    }
}

/**
 * Sign in with Google — works on both web and native.
 * On web: uses OAuth redirect (full page redirect to Google).
 * On native: opens an in-app browser via expo-web-browser,
 * with a Linking fallback for Android browsers that don't return properly.
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
        const redirectUrl = AuthSession.makeRedirectUri({
            scheme: 'keepyourseed',
        });
        
        console.log('🔑 [GoogleAuth] Native Redirect URL:', redirectUrl);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;

        console.log('🔗 [DEBUG] URL de connexion générée par Supabase :', data.url);


        // Fallback: listen for deep links in case WebBrowser doesn't return properly
        // (common issue on Xiaomi/MIUI and some Samsung browsers)
        let linkingResolved = false;
        const linkingPromise = new Promise((resolve) => {
            const handleUrl = async ({ url }) => {
                console.log('🔑 [GoogleAuth] Deep link received:', url);
                if (url.startsWith(redirectUrl)) {
                    linkingResolved = true;
                    subscription.remove();
                    const success = await extractAndSetSession(url);
                    resolve(success);
                }
            };
            const subscription = Linking.addEventListener('url', handleUrl);

            // Clean up after 2 minutes in case nothing happens
            setTimeout(() => {
                subscription.remove();
                if (!linkingResolved) resolve(false);
            }, 120000);
        });

        // Open the Google auth page in the system browser
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        console.log('🔑 [GoogleAuth] WebBrowser result type:', result.type);

        if (result.type === 'success') {
            console.log('🔑 [GoogleAuth] WebBrowser returned URL:', result.url);
            await extractAndSetSession(result.url);
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
            // WebBrowser didn't capture the redirect — wait for Linking fallback
            console.log('🔑 [GoogleAuth] WebBrowser missed redirect, waiting for deep link fallback...');
            await linkingPromise;
        }
    }
}
