# 🌱 INTENTION.md — Source de Vérité Design & UX

> **Rôle de ce document** : Centre de vérité vivant pour toute décision de design, d'identité visuelle et d'expérience utilisateur de **KeepYourSeed**. Ce document est lu et mis à jour à chaque itération pour garantir la cohérence du projet.
>
> 📅 Dernière mise à jour : 27 février 2026 — v3 (reveal implémenté, dates contextuelles)

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
Le nom "KeepYourSeed" porte la métaphore. Chaque enregistrement est une graine plantée. Avec le temps, ces graines forment un jardin de souvenirs. Cette métaphore peut guider les choix visuels (germination, croissance, floraison) mais doit rester **subtile et élégante**, jamais infantile.

---

## 2. 🎯 Cible Utilisateur

| Question | Réponse | Impact Design |
|----------|---------|---------------|
| Tranche d'âge | **Jeune / Jeune adulte (18-28 ans)** ✅ | Ton simple et direct, UI épurée, micro-interactions satisfaisantes |
| Durée typique d'un enregistrement | **2-3 minutes max** ✅ | Seek bar utile, pas besoin de vitesse ×2 pour le MVP |
| Moment d'utilisation privilégié | *À définir* | Mode sombre à considérer |
| Niveau tech de la cible | **Digital native** (déduit de la tranche d'âge) | Long press naturel, gestures familières |

---

## 3. 🎨 Identité Visuelle

### Direction artistique : "Bloc-Notes Brut"
L'esthétique est inspirée des apps de notes minimalistes (Bloc-notes iOS/Android, Notion en mode épuré). **Carrée, simple, terrestre.** Pas de rondeurs excessives, pas de gradients — du brut, du sincère, comme un carnet qu'on ouvre.

### Palette de couleurs ✅ Validée

| Rôle | Couleur | Hex | Usage |
|------|---------|-----|-------|
| **Primaire** | Marron chaud | `#78350F` | CTA principaux, header, éléments actifs |
| Primaire clair | Marron doux | `#A16207` | Hover, variantes actives |
| Secondaire | Beige sable | `#D4A574` | Accents, badges streak, icônes |
| Fond principal | Blanc cassé | `#FAF7F2` | Background de l'app |
| Fond carte | Beige pâle | `#F5F0E8` | Cards, zones secondaires |
| Texte principal | Brun très foncé | `#292524` | Texte courant (quasi-noir chaud) |
| Texte secondaire | Gris-brun | `#78716C` | Labels, métadonnées |
| Accent souvenir | Ambre doré | `#D97706` | Pensée du Passé, moments spéciaux |
| Succès | Vert olive | `#4D7C0F` | Confirmations, sync OK |
| Danger / Stop | Rouge brique | `#B91C1C` | Arrêt enregistrement, erreurs |

> 💡 **Logique** : Le marron ancre l'app dans le terrestre et l'organique. Ça évoque le papier kraft, le carnet, la terre (où on plante les graines). Cohérent avec la métaphore "KeepYourSeed".

### Typographie ✅ Validée

| Usage | Police | Pourquoi |
|-------|--------|----------|
| **Titres + Corps** | **Outfit** | Validée — moderne, lisible, polyvalente. Seule police nécessaire. |
| Timer / chiffres | **Outfit** (avec `fontVariant: tabular-nums`) | Même police, poids light/thin pour le timer |

> 💡 **Choix une seule police** : Outfit servira partout. On joue sur les poids (Light pour le timer, Regular pour le corps, SemiBold/Bold pour les titres). Ça simplifie le chargement et renforce l'identité "bloc-notes".

### Principes visuels ✅
- **Coins carrés / légèrement arrondis** : `border-radius` de **4-8px max** → esthétique bloc-notes, angulaire, simple
- **Pas d'ombres portées** : bordures fines (`1px solid`) ou `elevation: 0` → flat design, comme du papier
- **Pas de gradients** : couleurs aplates, franches
- **Icônes outline fines** : style linéaire (comme Lucide ou Feather Icons) → cohérent avec le minimalisme
- **Espacement généreux** : beaucoup de blanc, aéré
- **Bordures visibles** : utiliser des `border` subtiles plutôt que des ombres pour délimiter les zones

---

## 4. 🏗️ Architecture de l'Écran d'Accueil

### Hiérarchie des zones

```
┌─────────────────────────────────┐
│  ☰ Menu          📜 Historique  │  HEADER — navigation
├─────────────────────────────────┤
│                                 │
│   💭 Pensée du Passé            │  ZONE RÉCOMPENSE (~25%)
│   [Carte verrouillée/mystère]   │  Visuellement attrayante mais secondaire
│                                 │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│                                 │
│          00:00:00               │  ZONE ACTION PRINCIPALE (~50%)
│                                 │  Centre gravitationnel de l'écran
│     [ 🎙 Enregistrer ]          │  CTA dominant en taille et couleur
│                                 │
├─────────────────────────────────┤
│   🔥 Streak · 🌱 Info          │  ZONE MOTIVATION (footer léger)
└─────────────────────────────────┘
```

### Règles de cohabitation
- Le **CTA d'enregistrement est toujours l'élément n°1** visuellement (taille, contraste, position)
- La **Pensée du Passé est l'élément n°2** — elle attire l'œil mais ne vole pas la vedette
- Pendant l'enregistrement, la zone récompense **disparaît** → focus total sur la voix
- La zone motivation est **discrète** — jamais agressive, jamais culpabilisante

---

## 5. ✨ Interaction de Révélation — "Pensée du Passé" ✅ Implémenté

### Concept
La Pensée du Passé est un souvenir aléatoire proposé chaque jour. Elle n'est **pas visible immédiatement** : l'utilisateur doit effectuer une interaction pour la "débloquer". Cela crée un effet de surprise et une micro-dose de dopamine.

### État verrouillé (carte compacte)
- **Layout** : Horizontal — 🔒 Lock icon à gauche + texte teaser à droite
- **Teaser** : Date contextuelle + accroche → *"Mardi soir, tu pensais à..."*
- **Sous-texte** : *"Maintiens pour écouter"* (mobile) / *"Clique et maintiens pour écouter"* (web)
- **Barre de progression** : En bas de la carte, ambre doré (`#D97706`) sur fond beige (`#F5F0E8`)

### Mécanique Long Press (~1.5s)
- `onPressIn` → la barre se remplit via `Animated.timing` (1500ms)
- À 50% → vibration légère (mobile uniquement, ignorée sur web)
- À 100% → vibration nette + fade-in du contenu révélé
- Si relâché avant → la barre se vide (200ms), annulé
- **Web compatible** via `Pressable` (mousedown/mouseup)

### État révélé
- **Teaser émotionnel** en ambre : *"Mardi soir, tu pensais à..."*
- **Titre** de la note en gras + **date courte** (5 mars 2026)
- **Bouton ▶ carré** (44×44px) inline à droite — play/stop toggle
- **Indicateur de lecture** : Fine barre ambre en bas quand l'audio joue
- La carte reste débloquée pour la session

### Dates contextuelles ✅ Implémenté
Le texte de date s'adapte selon la distance temporelle + le moment de la journée :

| Distance | Format | Exemple |
|----------|--------|----------|
| Aujourd'hui | Moment | *"Ce matin, tu pensais à..."* |
| Hier | Hier + moment | *"Hier soir, tu pensais à..."* |
| < 7 jours | Jour nommé + moment | *"Mardi après-midi, tu pensais à..."* |
| 7-14 jours | Relatif | *"La semaine dernière, tu pensais à..."* |
| 14j - 3 mois | Relatif | *"Il y a 2 semaines / 2 mois, tu pensais à..."* |
| > 3 mois | Date nommée | *"Le 5 mars, tu pensais à..."* |

Moments de la journée : matin (5h-12h), après-midi (12h-18h), soir (18h-22h), nuit (22h-5h)

---

## 6. 🧠 Psychologie & Rétention

### Leviers d'engagement (sains)

| Levier | Implémentation | Priorité |
|--------|---------------|----------|
| **Streak bienveillante** | Compteur de jours consécutifs, mais message doux si cassée : *"Pas de souci 🌱"* | MVP |
| **Rareté** | Un seul souvenir par jour → la rareté crée la valeur | MVP |
| **Nostalgie contextuelle** | Dates contextuelles avec moment de la journée (matin/soir) | ✅ MVP |
| **Distances temporelles variées** | Parfois la veille, parfois 6 mois — plus l'écart est grand, plus l'émotion est forte | MVP |
| **Notifications curieuses** | *"Un souvenir du 14 juillet t'attend..."* (opt-in, heure choisie) | V1.1 |
| **Milestones** | Badges visuels à 7, 30, 100 jours | V2 |
| **Croissance visuelle** | Plante/arbre qui évolue avec la streak | V2 |

### Anti-patterns (ce qu'on ne fait JAMAIS)
- ❌ Notification culpabilisante (*"Tu n'as pas enregistré aujourd'hui !"*)
- ❌ Perte de streak punitive (pas de reset à zéro brutal)
- ❌ Compteur de jours manqués visible
- ❌ Pop-up intrusive au lancement
- ❌ Gamification excessive (pas de points, pas de classement)

---

## 7. 🔊 Audio — Bonnes Pratiques UI

### Pendant l'enregistrement
- Timer central, gros, lisible (monospace pour la stabilité visuelle)
- Indicateur visuel d'activité (icône 🔴 pulsante ou waveform temps réel)
- Un seul bouton : Start → Stop (pas de pause pour le MVP)

### Pendant la lecture
- **Play/Pause** : Un seul bouton toggle
- **Barre de progression** : Draggable / seek bar (surtout si > 30s)
- **Temps** : Affiché en `0:45 / 2:30`
- **Waveform** : Visualisation statique de l'onde (optionnel V1.1)
- **Vitesse** : ×1, ×1.5, ×2 (V1.1)

### Accessibilité
- `accessibilityLabel` sur tous les boutons audio
- Feedback visuel clair quand l'audio joue (animation, couleur qui change)
- Gestion du conflit audio : `staysActiveInBackground: false`

---

## 8. 📐 Tokens de Design

### Implémentés (dans `tailwind.config.js`)
- **Couleurs** : namespace `seed-*` (seed-primary, seed-bg, seed-card, seed-text, seed-muted, seed-accent, seed-border, etc.)
- **Border radius** : `rounded-seed` = 6px
- **Animations** : `REVEAL_DURATION` = 1500ms, fade-in = 300ms, cancel = 200ms

### À définir
- Spacing scale
- Breakpoints web responsive

---

## 9. 📝 Journal des Décisions

### ✅ Décisions actées (27 fév. 2026)
- [x] **Cible** : Jeune / Jeune adulte (18-28 ans)
- [x] **Durée typique** : 2-3 minutes max
- [x] **Couleur primaire** : Marron chaud (`#78350F`)
- [x] **Esthétique** : Carrée, bloc-notes, minimaliste (inspiré Bloc-notes / Notes apps)
- [x] **Interaction de révélation** : Long Press (~1.5s) avec barre de progression ambre
- [x] **Typographie** : Outfit (unique police pour tout)
- [x] **Animations** : Simples et sobres (fade-in, pas de bounce/confetti)
- [x] **Distances temporelles** : Varier (veille → 6 mois) pour amplifier l'émotion
- [x] **Dates contextuelles** : Jour nommé + moment (matin/soir) pour les récents, date nommée pour les anciens
- [x] **Mode sombre** : Non prévu
- [x] **Jeu d'icônes** : Lucide Icons (`lucide-react-native`)
- [x] **Bordures des cartes** : Marron léger (`seed-border`)
- [x] **CTA principal** : "Garder une pensée" (wording validé)
- [x] **Carte verrouillée** : Layout compact horizontal (Lock + teaser + barre)
- [x] **État révélé** : Teaser émotionnel + titre + bouton play carré inline

### 🟡 Décisions en attente
- [ ] **Métaphore graine** : Subtile en texte seulement, ou élément visuel (plante, arbre) ?

---

*Ce document évolue à chaque conversation. Chaque décision prise est enregistrée ici pour garantir la cohérence du projet.*
