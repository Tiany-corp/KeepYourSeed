# ✨ Fonctionnalités - Keep Your Seed

Ce document liste les fonctionnalités de l'application, organisées par état d'avancement.

## 🟢 1. Core Experience (MVP) - TERMINÉ ✅
Ces fonctionnalités constituent le cœur de l'application.

### Enregistrement & Capture
- [x] **Enregistrement Audio** : Interface simple avec bouton central dominant.
- [x] **Timer & Feedback** : Timer haute précision (60 FPS) via Reanimated.
- [x] **Titres & Émojis** : Fenêtre de nommage (`TitleModal`) après chaque capture.
- [x] **Tags Contextuels** : Système de tags personnalisables avec sélecteur d'émojis.

### Lecture & Consultation
- [x] **Lecteur Universel** : Play/Pause, barre de progression et mémorisation de position.
- [x] **Historique Tactile** : FlatList optimisée avec mémorisation (`React.memo`).
- [x] **Souvenir du Jour (Daily Memory)** : Signal Aura pulsant pour encourager l'écoute.

### Persistance & Cloud
- [x] **Local-First** : Stockage asynchrone ultra-réactif (AsyncStorage / IndexedDB).
- [x] **Cloud Sync (Supabase)** : Sauvegarde automatique des audios et métadonnées.
- [x] **Dédoublonage** : Gestion intelligente des uploads lors des passages offline/online.

---

## 🟡 2. Améliorations (V1.1) - EN COURS 🏗️

### Social & Partage
- [ ] **Partage Externe** : Partager un souvenir via WhatsApp/Instagram (génération d'un visuel).
- [ ] **Export MP3** : Possibilité de télécharger ses pensées en dehors de l'app.

### Expérience Utilisateur
- [ ] **Notifications Rappel** : Notification douce le soir si aucune pensée n'a été gardée.
- [ ] **Capsule Temporelle ⏳** : Envoyer un message à son "Soi du futur" (invisible jusqu'à date T).

---

## 🔴 3. Vision Long Terme (V2.0)
- [ ] **Croissance de la Plante** : Évolution visuelle d'un arbre basée sur la régularité des pensées.
- [ ] **Insight IA** : Résumé hebdomadaire des thématiques abordées (via analyse de tags/transcription).
- [ ] **Mode Méditation** : Fonds sonores ambiants pendant l'écoute des souvenirs.

---

*Note : La documentation technique du build et des tests se situe désormais dans les scripts du package.json.*
