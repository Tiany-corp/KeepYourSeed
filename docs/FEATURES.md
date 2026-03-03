# ✨ Fonctionnalités - Keep Your Seed

Ce document liste les fonctionnalités de l'application, classées par priorité.

## 🟢 Priorité 1 : MVP (Journal de Bord de vie)
Ces fonctionnalités sont indispensables pour la première version.

### 1. Enregistrement Vocal (Core)
- [ ] Interface simple avec un grand bouton micro.
- [ ] Visualisation de l'onde sonore (waveform) ou simple timer pendant l'enregistrement.
- [ ] Limite de durée : 5 minutes max.
- [ ] Compression automatique (`.m4a`).
- [ ] Gestion des interruptions (Appels, Background) : Sauvegarde automatique si interrompu.

### 2. Lecture (Player)
- [ ] Bouton Play/Pause.
- [ ] Barre de progression déplaçable (Seek bar).
- [ ] Affichage de la durée totale et écoulée.

### 3. Historique (Timeline)
- [ ] Liste chronologique des enregistrements.
- [ ] Regroupement par Mois / Année.
- [ ] Indicateur visuel pour les jours "manqués" (motivation à ne pas briser la chaîne).

### 4. Persistance (Stockage)
- [ ] Stockage local des fichiers audio.
- [ ] Base de données locale (JSON/AsyncStorage) pour lier les dates aux fichiers.
- [x] **Cloud Sync** : Sauvegarde en ligne (Supabase).


## 🟡 Priorité 2 : Améliorations (V1.1)
- [ ] **Titres / Humeur** : Ajouter un émoji ou un titre court après l'enregistrement.
- [ ] **Rappels** : notification quotidienne à 20h si pas d'enregistrement.
- [ ] **Capsule Temporelle ⏳** : Envoyer un message à son "Soi du futur".
    - Choisir une date de déverrouillage. // A garder pour plus tard mais je le voyais pas comme ca pour l'instant
    - Le fichier est invisible ou bloqué (cadenas) dans la timeline jusqu'à cette date. // => plutot invisible oui puis on recoit une notif vous avez un nouveau message

## 🔴 Priorité 3 : Futur (V2.0)
- [ ] **Statistiques** : "Vous avez enregistré 10 heures de votre vie".
- [ ] **Recherche** : Par date ou par tags.

Tu fais tes modifications de code.
Tu lances npm run build:web (Génère le dossier dist tout neuf).
Tu lances npm run test:prod (Prend le dossier dist, recrée l'architecture serveur dans temp_serve et te lance le serveur web).
Tu vas sur http://localhost:3000/kys-web-app/ et tu testes ton appli.
