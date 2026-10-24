# Journal des Déploiements (EAS)

Ce fichier garde la trace des déploiements OTA effectués via Expo Application Services (EAS Update).

> [!NOTE]
> L'application actuellement installée sur le téléphone de test est configurée pour écouter la branche **`preview`**. Toutes les mises à jour de test doivent donc être déployées sur cette branche.


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
