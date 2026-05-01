# ✨ Fonctionnalités - Keep Your Seed

Ce document liste les fonctionnalités de l'application, organisées par état d'avancement.

## 🟢 1. Core Experience (MVP) - TERMINÉ ✅
Ces fonctionnalités constituent le cœur de l'application.

### Enregistrement & Capture
- [x] **Enregistrement Audio** : Interface simple avec bouton central dominant.
- [x] **Optimisation Stockage** : Compression vocale intelligente (64kbps Mono) pour diviser par 4 l'espace disque.
- [x] **Timer & Feedback** : Timer haute précision (60 FPS) via Reanimated.
- [x] **Titres & Émojis** : Fenêtre de nommage (`TitleModal`) après chaque capture.
- [x] **Tags Contextuels** : Système de tags personnalisables avec sélecteur d'émojis.

### Lecture & Consultation
- [x] **Lecteur Universel** : Play/Pause, barre de progression et mémorisation de position.
- [x] **Historique Tactile** : FlatList optimisée avec mémorisation (`React.memo`).
- [x] **Souvenir du Jour (Daily Memory)** : Algorithme déterministe (identique sur tous les supports). Signal Aura pulsant pour encourager l'écoute.

### Persistance & Cloud
- [x] **Local-First** : Stockage asynchrone ultra-réactif (AsyncStorage / IndexedDB).
- [x] **Cloud Sync (Supabase)** : Sauvegarde automatique des audios et métadonnées.
- [x] **Sync Hybride** : Métadonnées prioritaires (4G) et audios intelligents (WiFi/Manuel).
- [x] **Dédoublonage & Sanitisation** : Nettoyage automatique des doublons et réparation des données corrompues.


### Capsule Temporelle (Messages au futur)
- [x] **Message à ton futur toi** : Envoi de messages audio différés (🚀).
- [x] **Livraison Intelligente** : Les messages apparaissent dans le "Souvenir du jour" dès qu'ils sont dus.
- [x] **Visualisation "DM"** : Icône style messagerie pour une expérience plus intime.

---

## 🔴 3. Vision Long Terme (V2.0)
- [ ] **Croissance de la Plante** : Évolution visuelle d'un arbre basée sur la régularité des pensées.
- [ ] **Insight IA** : Résumé hebdomadaire des thématiques abordées (via analyse de tags/transcription).
- [ ] **Mode Méditation** : Fonds sonores ambiants pendant l'écoute des souvenirs.

---

*Note : La documentation technique du build et des tests se situe désormais dans les scripts du package.json.*
