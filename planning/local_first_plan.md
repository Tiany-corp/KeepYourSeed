# Local‑First Implementation Plan – Tracking File

## Decisions confirmed by the user
- **Valeur par défaut du toggle** : **Off** – les uploads sont autorisés en 4G.
- **Libellés UI**
  - **Icônes**
    - `Cloud` : "En local" (audio déjà présent sur l’appareil).
    - `CloudOff` : "Disponible en ligne" (audio uniquement sur le serveur).
    - `Upload` : "En attente d’envoi" (audio local non synchronisé).
  - **Toasts / Alerts**
    - Upload réussi : `"Enregistrement envoyé avec succès"`.
    - Upload échoué : `"Échec de l’envoi, réessayez plus tard"`.
    - Download déclenché : `"Téléchargement en cours…"`.
    - Download échoué : `"Téléchargement d’une pensée échoué, réessayez plus tard"`.
    - Download différé (Wi‑Fi only) : `"Téléchargement différé – connexion Wi‑Fi requise"`.
- **Algorithme de hash** : **SHA‑256**
  - **Pourquoi** : SHA‑256 offre un excellent compromis entre sécurité, vitesse et disponibilité native dans les environnements JavaScript (via `crypto.subtle.digest`). Il produit un hash de 256 bits (64 caractères hexadécimaux) qui est pratiquement unique, ce qui permet une déduplication fiable sans risque de collisions significatives.
  - **Où le calculer** : au moment de l’enregistrement local, juste après la sauvegarde du fichier audio (dans `services/storage.js` – fonction `saveRecording`). Le hash sera stocké dans le champ `hash` de l’objet d’enregistrement.
- **Écoute du réseau**
  - Le comportement de l’écoute (`NetInfo.addEventListener`) reste à définir : **devons‑nous désactiver l’écoute après le premier déclenchement** pour éviter des appels répétés ou la garder active en permanence ? *Merci de préciser votre préférence.*

## Open Questions (awaiting user response)
1. **Gestion de l’écoute du réseau** – désactiver après le premier déclenchement ou garder active ?

## Next Steps (to be executed after confirmation)
- Implémenter le calcul du hash SHA‑256 lors de l’enregistrement.
- Ajouter le toggle avec la valeur par défaut Off.
- Intégrer les libellés UI et les toasts dans les composants concernés.
- Mettre en place l’écoute du réseau selon la décision finale.
- Ajouter les tests unitaires pour la déduplication et le calcul du hash.
- Mettre à jour le README (section déjà créée) avec les nouveaux libellés si besoin.

---
*Ce fichier sert de plan de suivi. Les tâches seront marquées dans `task.md` au fur et à mesure de l’avancement.*
