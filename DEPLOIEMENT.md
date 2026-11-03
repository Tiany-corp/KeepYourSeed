# Journal des Déploiements (EAS)

Ce fichier garde la trace des déploiements OTA effectués via Expo Application Services (EAS Update).

> [!NOTE]
> L'application actuellement installée sur le téléphone de test est configurée pour écouter la branche **`preview`**. Toutes les mises à jour de test doivent donc être déployées sur cette branche.

## 1 Novembre 2026

### 🚀 Harmonisation Icônes Cloud & Audio Background
- **Branche cible :** `preview` (commande: `eas update --branch preview`)
- **Message :** `Harmonisation icones cloud et audio background`
- **Lien du dashboard :** [Update be486609](https://expo.dev/accounts/tianyr/projects/KeepYourSeed/updates/be486609-9878-4248-a7e4-4c7bef8083ae)
- **Modifications principales :**
  - **Audio en arrière-plan :** Intégration de `setAudioModeAsync({ shouldPlayInBackground: true })` et commandes lockscreen/notification (`setActiveForLockScreen`).
  - **Harmonisation des icônes Cloud (`SettingsDrawer.js`) :**
    - Sauvegarde auto active : icône `Cloud` en vert émeraude (`#10B981`), identique à l'historique.
    - Sauvegarde auto inactive : icône `CloudOff` en gris (`#78716C`) avec opacité adoucie.
    - Stockage cloud : icône `Cloud` marron en mode contour (sans remplissage).

## 31 Octobre 2026

### 📦 Build Production Google Play Store AAB v4
- **Profil :** `production`
- **Application ID :** `com.tianyr.keepyourseeds`
- **Version :** `1.0.0` (Version code: `4`)
- **Commit :** `3cea58c`
- **Fichier AAB :** [Télécharger l'AAB v4](https://expo.dev/artifacts/eas/EJXrCKcAmcfvVE1sGl5i8PW134UOEh0ZAJKaCvzyV4I.aab)

### 📦 Build Production Google Play Store (AAB v3)
- **Profil :** `production` (commande: `eas build --platform android --profile production`)
- **Canal OTA associé :** `production`
- **Application ID (Package) :** `com.tianyr.keepyourseeds`
- **Version :** `1.0.0` (Version code: `3`)
- **Signature :** Signature avec la clé d'importation Play Store officielle (`SHA1: B9:36:C2:87:9A:60:E1:FA:BF:64:99:FF:8D:32:DB:69:B3:D9:F9:DD`)
- **Lien du dashboard :** [Build 4efe26f8](https://expo.dev/accounts/tianyr/projects/KeepYourSeed/builds/4efe26f8-73bc-4d58-b1ca-a2454ebfab4e)
- **Fichier AAB :** [Télécharger l'AAB v3](https://expo.dev/artifacts/eas/sAEySTz5jgvWlfq_3xnVNe5-TIzPU77TSMnFO3-NkF0.aab)
- **Statut Play Console :** Validé et importé avec succès sur la Google Play Console.




## 24 Octobre 2026

### 🚀 Optimisations Tiroir Paramètres & Section Cloud
- **Branche cible :** `preview` (commande: `eas update --branch preview`)
- **Message de commit/update :** `SettingsDrawer: fluidite, ratio Mo/Go, icones cloud et activation TreeDetail`
- **Lien du dashboard :** [Update d6f93758](https://expo.dev/accounts/tianyr/projects/KeepYourSeed/updates/d6f93758-e256-40fb-bbee-c123637e6b85)
- **Modifications principales :**
  - **Fluidité & Performance :** Utilisation de `useNativeDriver` sur les animations du tiroir et différé de `loadStorageStats` via `InteractionManager.runAfterInteractions` pour éliminer les saccades.
  - **Section Cloud :**
    - Ratio de stockage formaté proprement sur une seule unité (`1.2 / 30 Mo` ou `X / Y Go`) pour éviter toute collision textuelle.
    - Icône `Cloud` en mode rempli pour le stockage cloud.
    - Icône `CloudSync` en vert (`#15803d`) avec libellé « Sauvegarde Auto » quand la synchronisation automatique est active (et `CloudOff` si inactive).
    - Icône `CloudUpload` pour le bouton « Enregistrer dans le cloud ».
    - Modal de confirmation explicite lors de l'activation de la sauvegarde Cloud.
  - **TreeDetailScreen :** Connexion du bouton paramètres dans l'en-tête pour permettre l'ouverture du tiroir depuis la vue d'un arbre.

## 19 Août 2026

### 🎨 Refonte Design : Vocaux Parents
- **Branche cible :** `preview` (commande: `eas update --branch preview`)
- **Message de commit/update :** `Design: Mise a jour du style des vocaux parents avec bouton play transparent`
- **Lien du dashboard :** [Update 38fcd444](https://expo.dev/accounts/tianyr/projects/KeepYourSeed/updates/38fcd444-3085-4f23-a8c3-1cb984bedf72)
- **Modifications principales (`RecordingItem.js`) :**
  - Changement du fond de la carte parent pour un marron foncé (`#78350F`).
  - Suppression de la bordure d'accentuation pour un look plus minimaliste.
  - Transformation du bouton Play en un anneau fin (fond transparent, bordure `rgba(255, 255, 255, 0.8)`).
  - Harmonisation des couleurs de texte et d'icônes (Pin, GitBranch) en beige clair (`#E8D5BF`) pour un effet "luxe discret" et un respect parfait de la norme d'accessibilité WCAG AA.
