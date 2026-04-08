# 🏗️ Architecture Technique (Keep Your Seed)

Ce document détaille les choix techniques, les flux de données et les règles d'hygiène de code du projet.

## 🛠️ Stack Technologique (Moderne SDK 54+)
- **Framework** : React Native (via Expo)
- **Audio Engine** : `expo-audio` (Enregistrement & Lecture Haute Performance)
  - *Note : Remplacement définitif de `expo-av` pour déporter le traitement sur le thread natif.*
- **UI & Animations** : `react-native-reanimated` (Moteur 60 FPS / UI Thread)
- **Styling** : Vanilla CSS + NativeWind (Système de Design Cohérent)
- **Flux de Données** : Local-First (Persistance via `AsyncStorage` / IndexedDB)
- **Cloud** : Supabase (Buckets Audio + PostgreSQL DB)

---

## ⚡ Stratégie de Performance (Segmented State)

Afin de garantir une interface fluide sans micro-saccades, l'état de l'application est segmenté :

### 1. `AppContext` (Bas de fréquence)
Gère uniquement les états globaux stables :
- Session utilisateur (Supabase)
- Thème et Drawer de réglages
- Notifications Alertes

### 2. `AudioPlayerContext` & `ProgressContext` (Isolement)
- **`AudioPlayerContext`** : Contrôle métier (Play/Pause, Track en cours).
- **`AudioPlayerProgressContext`** : **Isolé**. Gère uniquement la position de lecture (ms). Cela permet de mettre à jour les barres de progression 60 fois par seconde sans re-render les composants lourds (écrans entiers ou listes).

---

## 🔄 Flux de Synchronisation (Local-First 2.0)

L'application privilégie toujours les données locales pour une réactivité instantanée.

### Cycle d'un enregistrement :
1. **Capture** : `useAudioRecorder` enregistre en local (`file://` ou `indexeddb://`).
2. **Persistance** : Les métadonnées sont stockées via `storage.js`.
3. **Synchronisation** :
   - **Initial Sync** : Au lancement de `HistoryScreen`, `syncAll` répare les écarts entre local et cloud.
   - **Sync Wi-Fi (One-Shot)** : Détecteur intelligent (NetInfo) qui lance l'upload dès qu'un réseau haut débit est détecté pour préserver la data mobile.

---

## ✨ Système d'Animations Visuelles

### Glow & Aura (DailyMemoryCard)
Pour notifier l'utilisateur d'un nouveau souvenir sans alourdir le DOM React :
- **Architecture de calques** : Un `glowLayer` est placé en `zIndex: -1` derrière la carte.
- **Performance** : Seule l'opacité est animée via Reanimated, évitant les recalculs de layout (Shadows/Padding).

---

## 🛡️ Hygiène du Code (Règles Antigravity)

1. **Mémorisation Stricte** :
   - Tout composant de liste (`RecordingItem`) doit être enveloppé dans `React.memo`.
2. **ExtraData Pattern** :
   - Les `FlatList` utilisent la prop `extraData` pour écouter les changements d'état globaux (ex: "Vu" du souvenir quotidien) sans reconstruire tous les composants enfants.
3. **Optimisation Médias** :
   - Compression systématique des audios via `LOW_QUALITY` ou `HIGH_QUALITY` optimisé pour la voix humaine (bitrate réduit).

---

## 📂 Structure du Projet
```text
/components/history  # Logique spécifique à l'historique (Card, Items)
/contexts            # Architecture de contextes segmentés
/hooks               # Hooks natifs (Audio, Animations)
/services            # Bridge Storage <-> Supabase
/utils               # Formatage et aides métier
App.js               # Orchestrateur de navigation & Providers
```
