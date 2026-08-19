# Journal des Déploiements (EAS)

Ce fichier garde la trace des déploiements OTA effectués via Expo Application Services (EAS Update).

> [!NOTE]
> L'application actuellement installée sur le téléphone de test est configurée pour écouter la branche **`preview`**. Toutes les mises à jour de test doivent donc être déployées sur cette branche.


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
