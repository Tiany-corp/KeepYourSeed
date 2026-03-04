
import React, { Component, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { supabase } from './services/supabase';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import RecordScreen from './screens/RecordScreen';
import HistoryScreen from './screens/HistoryScreen';
import AuthScreen from './screens/AuthScreen';
import SettingsDrawer from './components/SettingsDrawer';
import AudioPlayer from './components/AudioPlayer';

// --- ERROR BOUNDARY ---
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#FEE2E2' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#B91C1C', marginBottom: 10 }}>
            ❌ Erreur de rendu
          </Text>
          <Text style={{ fontSize: 14, color: '#292524', textAlign: 'center' }}>
            {this.state.error?.toString()}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [session, setSession] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('record');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

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
          <View style={{ flex: 1 }}>
            {currentScreen === 'record' ? (
              <RecordScreen session={session} onGoToHistory={() => setCurrentScreen('history')} onOpenSettings={() => setDrawerOpen(true)} />
            ) : (
              <HistoryScreen key={refreshKey} onGoBack={() => setCurrentScreen('record')} session={session} onOpenSettings={() => setDrawerOpen(true)} />
            )}
          </View>

          {/* Mini player bar global — persiste entre les écrans */}
          <AudioPlayer />
        </>
      )}
      {session && <SettingsDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} session={session} onDataCleared={() => setRefreshKey(k => k + 1)} />}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AudioPlayerProvider>
        <AppContent />
      </AudioPlayerProvider>
    </ErrorBoundary>
  );
}

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
