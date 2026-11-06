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

## 🏷️ Système d'Étiquettes et Émojis (Dictionnaire Découplé)

L'architecture des étiquettes repose sur un principe de **découplage strict** entre la référence stockée sur la pensée et le dictionnaire visuel de l'utilisateur :

### 1. Stockage sur les Pensées (`recordings.tags`)
- Dans la table PostgreSQL `public.recordings`, la colonne `tags` est un simple tableau textuel (`text[]`).
- Les notes ne stockent **que des identifiants/clés de référence**, jamais les émojis ni les styles :
  ```json
  // Exemple de ligne en BDD dans recordings
  {
    "id": "uuid-123",
    "title": "Ma pensée",
    "tags": ["enseignement", "custom_force", "custom_musique"]
  }
  ```
- **Dérivation du libellé :** L'application dérive le label affiché par une règle simple (suppression du préfixe `custom_`, remplacement des underscores par des espaces, première lettre en majuscule : `"custom_force"` ➔ `"Force"`).

### 2. Le Dictionnaire Utilisateur (`auth.users.raw_user_meta_data`)
- Les émojis personnalisés et leurs libellés sont centralisés dans le profil du compte utilisateur Supabase, dans la colonne JSON `raw_user_meta_data` :
  ```json
  {
    "custom_tags": [
      { "id": "custom_force", "label": "Force", "emoji": "💪" },
      { "id": "custom_musique", "label": "Musique", "emoji": "🎵" }
    ]
  }
  ```
- **Cache local & Offline :** Au démarrage de l'app, ce dictionnaire est chargé en mémoire cache (`_customTagsCache`) et persisté en local (`@custom_tags_v1` via AsyncStorage / IndexedDB).

### 3. Résolution Visuelle (`getTagInfo`)
Quand l'interface affiche une étiquette :
1. Elle vérifie si c'est un tag système (`AVAILABLE_TAGS` : 🌱 *Enseignement*, 💛 *Gratitude*...).
2. Sinon, elle cherche dans le dictionnaire `custom_tags` de l'utilisateur pour trouver l'émoji correspondant.
3. Si le tag n'est pas encore présent dans le dictionnaire (ex: ancienne note créée sur un autre appareil avant synchronisation), elle utilise un filet de secours : émoji générique `🏷️` + nom dérivé de l'identifiant.

### 4. Avantages de ce Design
- **Mise à jour en cascade instantanée** : Changer l'émoji ou renommer une étiquette dans l'espace d'administration modifie une seule entrée dans le dictionnaire utilisateur. Les centaines de pensées liées affichent immédiatement le nouvel émoji sans nécessiter d'UPDATE SQL sur chaque note.
- **Légèreté de la base de données** : Aucun coût de stockage redondant d'émojis sur les milliers de lignes de `recordings`.
- **Portabilité multi-appareils** : La connexion sur un nouvel appareil ou sur le Web télécharge immédiatement le dictionnaire et restitue tous les émojis.

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

build aab : https://expo.dev/artifacts/eas/wUEvldc0jYxVnvmtLg1t1qC-R4RhKlTdOm3d2qFrwKo.aab