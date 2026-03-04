# 🏗️ Architecture Technique

Ce document détaille les choix techniques pour **Keep Your Seed**.

## 🛠️ Stack Technologique
- **Framework** : React Native (via Expo)
- **Langage** : JavaScript
- **Audio** : `expo-av` (Enregistrement & Lecture)
- **Système de Fichiers** : `expo-file-system` (Stockage local des vocaux sur mobile)
- **Stockage Local** : Adaptateur Universel (`AsyncStorage` sur Mobile, `idb-keyval` / IndexedDB sur Web)
- **Cloud & Backend** : Supabase (Stockage des fichiers `.m4a` et base de données des métadonnées)

## � Structure des Dossiers
```
/assets         # Images, Fontes
/components     # Composants réutilisables (AudioPlayer, RecordButton, TitleModal, AppHeader...)
/contexts       # Contextes React globaux (AudioPlayerContext)
/hooks          # Custom hooks (useAudioRecorder, useRevealAnimation)
/screens        # Écrans (RecordScreen, HistoryScreen, AuthScreen)
/services       # Logique métier (storage.js, cloud.js, supabase.js)
/utils          # Helpers (formatTime, dateHelpers)
/docs           # Documentation (ARCHITECTURE.md, FEATURES.md, STYLE_GUIDE.md)
App.js          # Point d'entrée + routing conditionnel
```

---

## 🔀 Workflow Conditionné

### Arbre de décision principal (`App.js`)

```
App
├── ❌ Pas de session → AuthScreen (login)
└── ✅ Session active
    ├── currentScreen === 'record' → RecordScreen
    ├── currentScreen === 'history' → HistoryScreen
    ├── 🎵 AudioPlayer (global, toujours visible si un track est actif)
    └── ⚙️ SettingsDrawer (overlay)
```

### 📱 RecordScreen

```
RecordScreen
├── AppHeader (Menu + Logo + Clock→History)
│
├── Zone 1 (haut)
│   ├── !isRecording && session.user → MemoryCard (pensée du jour)
│   │   ├── isMemoryLoading → Skeleton
│   │   ├── dailyMemory existe → Carte avec animation reveal
│   │   │   └── onReveal → audioPlayer.play() + openModal()
│   │   └── dailyMemory null → "Pas encore de souvenir"
│   └── isRecording || !session → (espace vide)
│
├── Zone 2 (centre)
│   ├── isUploading → ActivityIndicator
│   └── RecordButton
│       ├── !isRecording → 🎙️ "Capturer une pensée" (start)
│       └── isRecording → ⏹️ "Arrêter" (stop)
│           └── onStop → TitleModal s'ouvre
│               ├── "Enregistrer" → saveRecording + upload si connecté
│               └── "Passer" → saveRecording avec titre par défaut
│
└── Footer
```

### 📜 HistoryScreen

```
HistoryScreen
├── AppHeader (title="Historique", bouton Retour)
│
└── FlatList (recordings)
    ├── vide → "Aucun enregistrement."
    └── Chaque item :
        ├── Tap → audioPlayer.toggle(item)
        │   ├── Même track en cours → pause
        │   ├── Autre track → charge + play
        │   └── Après fin → replay depuis le début
        │
        └── Bouton Cloud
            ├── status 'synced' → ☁️ vert (désactivé)
            ├── status 'error' → ☁️ rouge
            ├── uploadingId → spinner
            └── status 'pending' → ☁️ brun → tap = upload
```

### 🎵 AudioPlayer Global

Le lecteur audio vit dans `AudioPlayerContext` et persiste entre les écrans.

```
AudioPlayer
├── !currentTrack → invisible
└── currentTrack existe
    ├── !modalVisible → Mini Player Bar (position: absolute, bottom)
    │   ├── Tap bar → ouvre la modale fullscreen
    │   ├── Tap play → toggle play/pause
    │   └── Tap X → stop (arrête tout)
    └── modalVisible → Modale fullscreen
        ├── Tap backdrop sombre → ferme la modale → mini player
        ├── Tap play → toggle play/pause/replay
        └── Tap X → stop (arrête + ferme)
```

---

## �📦 Flux de Données (Audio Flow)

1.  **Enregistrement** :
    - L'utilisateur appuie sur REC (`hooks/useAudioRecorder.js`).
    - L'audio est capturé en qualité haute.
    - Format cible : `.m4a` (AAC) pour un bon ratio qualité/poids.

2.  **Nommage** :
    - À l'arrêt, `TitleModal` s'ouvre pour que l'utilisateur nomme sa pensée.
    - Titre par défaut : "Note HH:MM" (heure de l'enregistrement).

3.  **Sauvegarde (Mobile & Web)** :
    - Le fichier est d'abord sauvegardé localement.
    - Sur Mobile : Gardé dans le cache local (URI `file://`).
    - Sur Web : Le Blob est extrait et sauvegardé dans **IndexedDB** (`indexeddb://`).
    - Les métadonnées (`{ id, title, localUri, remoteUrl, status, duration }`) via l'Adaptateur Universel (`services/storage.js`).

4.  **Synchronisation Cloud (Supabase)** :
    - Si connecté, le fichier est uploadé vers le Bucket Supabase `audios`.
    - Les métadonnées sont insérées dans la table `user_recordings`.
    - Le `remoteUrl` est renseigné avec le chemin bucket (ex: `userId/timestamp.m4a`).

5.  **Lecture** (`AudioPlayerContext`) :
    - `getAudioSource()` choisit la meilleure source :
      1. Local d'abord (`indexeddb://` → blob URL, ou `file://` direct)
      2. Cloud ensuite (génère une URL signée temporaire via Supabase)
    - `expo-av` lit l'audio via `Audio.Sound.createAsync()`.

6.  **Données de démo (Web uniquement)** :
    - Si l'historique est vide sur Web → injecte un enregistrement démo depuis Supabase (`public/WelcomeInKYS.mp3`).
    - L'audio est téléchargé en arrière-plan et caché en IndexedDB pour les lectures suivantes.

## 🌐 Stratégie Cloud
- **Backend** : Supabase.
- Fichiers audios envoyés dans le bucket `audios`.
- Métadonnées envoyées dans la BDD PostgreSQL de Supabase.
- URLs signées temporaires (1h) pour la lecture sécurisée.
- Pensée du jour : fonction RPC `get_random_recording()` + cache local journalier.
