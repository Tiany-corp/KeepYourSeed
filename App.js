import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from './services/supabase'; // Import Supabase client
import RecordScreen from './screens/RecordScreen';
import HistoryScreen from './screens/HistoryScreen';
import AuthScreen from './screens/AuthScreen'; // Import AuthScreen
import SettingsDrawer from './components/SettingsDrawer';

export default function App() {
  const [session, setSession] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('record'); // 'record' | 'history'
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for auth changes (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      {!session ? (
        <AuthScreen />
      ) : (
        <>
          {currentScreen === 'record' ? (
            <RecordScreen session={session} onGoToHistory={() => setCurrentScreen('history')} onOpenSettings={() => setDrawerOpen(true)} />
          ) : (
            <HistoryScreen key={refreshKey} onGoBack={() => setCurrentScreen('record')} session={session} onOpenSettings={() => setDrawerOpen(true)} />
          )}
        </>
      )}
      {session && <SettingsDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} session={session} onDataCleared={() => setRefreshKey(k => k + 1)} />}
      <StatusBar style="auto" />
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? {
      maxWidth: 480,
      width: '100%',
      height: '100vh',
      alignSelf: 'center',
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: '#eee',
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    } : {})
  },
});
