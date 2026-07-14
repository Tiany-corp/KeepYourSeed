import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';

// Comportement par défaut des notifications quand l'application est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(session) {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Si l'utilisateur est connecté, on enregistre le token
    if (session?.user?.id) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          setExpoPushToken(token);
          saveTokenToSupabase(token, session.user.id);
        }
      });
    }

    // Écouteur quand une notification est reçue (app ouverte)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // Écouteur quand l'utilisateur clique sur la notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification cliquée:', response);
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [session?.user?.id]);

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Permission refusée pour les notifications push');
        return;
      }
      
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      if (!projectId) {
        console.log("Erreur: projectId non trouvé dans app.json");
        return;
      }

      try {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("Token généré:", token);
      } catch (e) {
        token = `${e}`;
        console.error("Erreur lors de la génération du token", e);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  async function saveTokenToSupabase(token, userId) {
    if (!token || !userId) return;

    try {
      // Upsert the token to Supabase
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({ 
          user_id: userId, 
          expo_push_token: token 
        }, { onConflict: 'expo_push_token' });
        
      if (error) {
        console.error('Erreur lors de la sauvegarde du token dans Supabase:', error);
      } else {
        console.log('Token sauvegardé avec succès !');
      }
    } catch (e) {
      console.error('Erreur inattendue:', e);
    }
  }

  // Fonction utilitaire pour tester une notification locale
  async function scheduleLocalNotification(title, body, delayInSeconds = 2) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || "🔔 Notification Test",
        body: body || "Ceci est un test de notification locale !",
        data: { data: 'test' },
      },
      trigger: { seconds: delayInSeconds },
    });
  }

  return {
    expoPushToken,
    notification,
    scheduleLocalNotification
  };
}
