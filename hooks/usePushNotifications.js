import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Comportement par défaut des notifications quand l'application est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const INSPIRING_MESSAGES = [
  "Qu'est-ce qui t'a fait sourire aujourd'hui ?",
  "Quel souvenir aimerais-tu retenir de ce jour ?",
  "As-tu une gratitude particulière aujourd'hui ?",
  "Quel enseignement as-tu tiré de cette journée ?",
  "Quel a été ton moment préféré de la journée ?",
  "Prends une seconde pour toi : comment te sens-tu ce soir ?",
  "Une victoire à célébrer aujourd'hui, même petite ?",
  "Qu'as-tu appris de nouveau aujourd'hui ?",
  "Y a-t-il quelqu'un que tu aimerais remercier aujourd'hui ?",
  "Transparence... Dit moi à quoi tu penses ?"
];

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

      // Recharger et planifier les rappels quotidiens si activé
      const loadAndScheduleReminders = async () => {
        try {
          const enabled = await AsyncStorage.getItem('dailyReminderEnabled');
          if (enabled === 'true') {
            const time = await AsyncStorage.getItem('dailyReminderTime');
            if (time) {
              const [h, m] = time.split(':').map(Number);
              scheduleRotatingDailyReminders(h, m);
            }
          }
        } catch (e) {
          console.error("Erreur chargement rappels", e);
        }
      };
      loadAndScheduleReminders();
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
        token = null;
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

  async function cancelDailyReminder() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Toutes les notifications programmées ont été annulées.');
  }

  async function scheduleRotatingDailyReminders(hour, minute) {
    await cancelDailyReminder(); // On nettoie les anciennes

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return false;
    }

    let countScheduled = 0;
    // On programme les 14 prochains jours
    for (let i = 0; i < 14; i++) {
      const trigger = new Date();
      trigger.setDate(trigger.getDate() + i);
      trigger.setHours(hour, minute, 0, 0);

      // Si l'heure est déjà passée aujourd'hui, on ignore ce jour
      if (i === 0 && trigger < new Date()) {
        continue;
      }

      const randomMessage = INSPIRING_MESSAGES[Math.floor(Math.random() * INSPIRING_MESSAGES.length)];

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🌱 KeepYourSeed",
            body: randomMessage,
            data: { type: 'daily_reminder' },
          },
          trigger: {
            type: 'date',
            date: trigger,
            channelId: 'default'
          },
        });
        countScheduled++;
      } catch (e) {
        console.error("Erreur lors de la programmation de la notification:", e);
      }
    }

    console.log(`Programmation de ${countScheduled} rappels quotidiens à ${hour}:${minute} terminée.`);
    return true;
  }

  return {
    expoPushToken,
    notification,
    scheduleLocalNotification,
    scheduleRotatingDailyReminders,
    cancelDailyReminder
  };
}
