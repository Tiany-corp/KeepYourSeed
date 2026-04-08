# 🌱 INTENTION.md — Source de Vérité Design & UX

> **Rôle de ce document** : Centre de vérité vivant pour toute décision de design, d'identité visuelle et d'expérience utilisateur de **KeepYourSeed**. Ce document est lu et mis à jour à chaque itération pour garantir la cohérence du projet.
>
> 📅 Dernière mise à jour : 8 avril 2026 — v5 (Sync Code complet, Aura Signal)

---

## 1. 🧬 ADN du Projet

### Vision
KeepYourSeed est un **journal intime vocal**. L'utilisateur plante chaque jour une graine (un enregistrement vocal) et cultive un jardin de souvenirs qu'il peut revisiter.

### Philosophie
- **Voix uniquement** — pas de texte, pas de photos. La voix capture l'émotion brute.
- **Simplicité radicale** — Ouvrir → Enregistrer → Fermer. Moins de 10 secondes pour commencer.
- **Bienveillance** — L'app ne culpabilise jamais. Pas de streak punitive, pas de dark patterns.
- **Nostalgie positive** — Redécouvrir ses pensées passées comme un cadeau, pas comme une obligation.

### Métaphore centrale : La Graine 🌱
Le nom "KeepYourSeed" porte la métaphore. Chaque enregistrement est une graine plantée. Avec le temps, ces graines forment un jardin de souvenirs. 

---

## 2. 🎯 Cible Utilisateur

| Question | Réponse | Impact Design |
|----------|---------|---------------|
| Tranche d'âge | **Jeune / Jeune adulte (18-28 ans)** ✅ | Ton simple et direct, UI épurée, micro-interactions satisfaisantes |
| Durée typique d'un enregistrement | **2-3 minutes max** ✅ | Seek bar utile, pas besoin de vitesse ×2 pour le MVP |
| Moment d'utilisation privilégié | *À définir* | Mode sombre à considérer |
| Niveau tech de la cible | **Digital native** | Long press naturel, gestures familières |
| Nouveaux Segments | **Investisseurs & Entrepreneurs** | Focus sur le "Journal de Gratitude" et le recul émotionnel |

---

## 3. 🎨 Identité Visuelle

### Direction artistique : "Bloc-Notes Brut"
L'esthétique est inspirée des apps de notes minimalistes. **Carrée, simple, terrestre.** Pas de rondeurs excessives, pas de gradients — du brut, du sincère, comme un carnet qu'on ouvre.

### Palette de couleurs ✅
| Rôle | Couleur | Hex | Usage |
|------|---------|-----|-------|
| **Primaire** | Marron chaud | `#78350F` | CTA principaux, header, éléments actifs |
| Fond principal | Blanc cassé | `#FAF7F2` | Background de l'app |
| Accent souvenir | Ambre doré | `#D97706` | Pensée du Passé, Signal Aura |
| Danger / Stop | Rouge brique | `#B91C1C` | Arrêt enregistrement, pause active |

---

## 4. 🏗️ Architecture de l'Écran d'Accueil

### Écosystème Vertical (Métaphore)
- **Le Ciel (Haut)** : La zone des souvenirs (`DailyMemoryCard`). C'est la zone de la lumière et de la récompense.
- **La Terre (Milieu)** : La zone d'action (`RecordButton`). C'est là qu'on "plante" sa pensée.
- **Les Racines (Bas)** : La zone de stabilité (Footer, Streaks).

---

## 5. ✨ Signal Organique — "Aura/Glow" ✅ Implémenté

Contrairement au projet initial qui utilisait un cadenas (verrouillage), nous avons opté pour un **appel visuel bienveillant**.

### Concept
Le souvenir du jour n'est pas "bloqué", il est "en attente". Pour inciter à l'écoute sans stress, une aura lumineuse pulsante entoure la carte.

### Comportement
- **Animation** : Pulsation d'opacité (60 FPS via Reanimated) autour de la carte.
- **Interaction** : Un simple tap sur la carte lance la lecture instantanément. 
- **Extinction** : Le signal s'arrête dès que le souvenir a été consulté (état `isOpened` persisté par ID).

---

## 6. 🧠 Psychologie & Rétention

### Leviers d'engagement (sains)
- **Rareté** : Un seul souvenir par jour proposé en haut de la timeline.
- **Curiosité** : Le titre "Un souvenir t'attend" tant qu'il n'est pas écouté.
- **Streak Bienveillante** : Un indicateur de régularité qui encourage sans punir.

---

## 7. 🔊 Audio — Standards Techniques

- **Moteur** : `expo-audio` (Stabilité native et performance UI thread).
- **Format** : `.m4a` / AAC (Parité web/mobile).
- **Player Context** : Isolation de la progression pour protéger les performances de rendu.

---

## 8. 📐 Principes de Design
- **Coins** : `border-radius: 16px` (Équilibre entre douceur et structure).
- **Bordures** : Fines et visibles (`1px solid`) pour délimiter les zones sans utiliser d'ombres lourdes.
- **Logo** : Utilisation de la variante `outline` pour plus de légèreté visuelle dans les listes.

---

## 9. 📝 Journal des Décisions

### ✅ Décisions actées (8 avril 2026)
- [x] **Moteur Audio** : Abandon de `expo-av` pour `expo-audio`.
- [x] **Interaction de Révélation** : Suppression du Long Press au profit de l'accès instantané avec signal Aura.
- [x] **Cible** : Ouverture aux profils "Investisseurs" pour le journal de gratitude.
- [x] **Synchronisation** : Sync Wi-Fi uniquement pour préserver la data.
- [x] **Web Parity** : Interface centrée et gestion modale adaptée au desktop.
- [x] **Persistance** : Utilisation de l'ID pour tracker l'état "vu" du souvenir quotidien.

---

*Ce document évolue à chaque conversation. Chaque décision prise est enregistrée ici pour garantir la cohérence du projet.*
