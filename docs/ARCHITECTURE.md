# 🏗️ Architecture Technique

Ce document détaille les choix techniques pour **Keep Your Seed**.

## 🛠️ Stack Technologique
- **Framework** : React Native (via Expo)
- **Langage** : JavaScript
- **Audio** : `expo-av` (Enregistrement & Lecture)
- **Système de Fichiers** : `expo-file-system` (Stockage local des vocaux sur mobile)
- **Stockage Local** : Adaptateur Universel (`AsyncStorage` sur Mobile, `idb-keyval` / IndexedDB sur Web)
- **Cloud & Backend** : Supabase (Stockage des fichiers `.m4a` et base de données des métadonnées)

## 📦 Flux de Données (Audio Flow)

1.  **Enregistrement** :
    - L'utilisateur appuie sur REC (`hooks/useAudioRecorder.js`).
    - L'audio est capturé en qualité haute.
    - Format cible : `.m4a` (AAC) pour un bon ratio qualité/poids.

2.  **Sauvegarde (Mobile & Web)** :
    - À l'arrêt, le fichier est d'abord traité localement.
    - Sur Mobile : Gardé dans le cache local (URI `file://`).
    - Sur Web : Le Blob est extrait et sauvegardé de manière permanente dans **IndexedDB**.
    - Les métadonnées (`{ id, title, uri, duration }`) sont sauvegardées via l'Adaptateur Universel (`services/storage.js`).

3.  **Synchronisation Cloud (Supabase)** :
    - Le fichier est uploadé automatiquement ou manuellement vers le Bucket Supabase.
    - Les métadonnées sont insérées dans la table `user_recordings` associées à l'utilisateur.
    - L'URI locale est complétée par la `publicUrl` cloud.

4.  **Lecture** :
    - L'app charge la liste depuis le stockage local (ou Cloud si implémenté).
    - `expo-av` lit l'audio. Si c'est un blob Web localisé, l'Adapter recrée un lien jouable temporaire.

## 🌐 Stratégie Cloud
- **Backend actuel** : Supabase.
- Fichiers audios envoyés dans le bucket `audios`.
- Métadonnées envoyées dans la BDD PostgreSQL de Supabase.
## 📂 Structure des Dossiers
```
/assets         # Images, Fontes
/components     # Composants réutilisables (AudioPlayer, RecordButton)
/screens        # Écrans (HomeScreen, HistoryScreen)
/services       # Logique métier (AudioRecorder, StorageManager)
/utils          # Helpers (formatTime, dateHelpers)
App.js          # Point d'entrée
```


