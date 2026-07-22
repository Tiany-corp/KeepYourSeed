# KeepYourSeed

## Mode Local‑First & Gestion du réseau

Cette application suit une approche **Local‑First** : les enregistrements sont d’abord sauvegardés sur l’appareil, puis synchronisés avec Supabase selon les conditions réseau.

### Comportement attendu
| Situation | Action | Détails |
|-----------|--------|--------|
| **Premier rendu** | Affiche immédiatement les enregistrements locaux (audio déjà présent). | Aucun appel réseau requis. |
| **Synchronisation (bouton en haut)** | - En **4G** : propose d’uploader les nouveaux vocaux, **ne télécharge** pas les audios distants.<br>- En **Wi‑Fi** : **télécharge** automatiquement tous les audios manquants après le pull. |
| **Pull manuel** | Le bouton de synchronisation déclenche le pull (récupération des métadonnées) et le cache des audios (selon le type de connexion). |
| **Préférence “Wi‑Fi uniquement”** | Quand activée, les uploads sont bloqués en 4G et les téléchargements ne s’effectuent qu’en Wi‑Fi. |

### Préférences disponibles
- **Wi‑Fi uniquement** : toggle dans les paramètres. Lorsque désactivé, les uploads sont autorisés en 4G mais les téléchargements restent réservés au Wi‑Fi.
- **Économiseur de données** : option supplémentaire (non implémentée) pour désactiver les uploads en 4G.

### Déduplication des enregistrements
Lors du **pull**, on compare :
- `remoteUrl` : si déjà présent localement, on ignore.
- `hash` : si le fichier audio possède le même hash qu’un enregistrement local, il est considéré comme dupliqué même avec un ID différent.
Cette logique évite de télécharger deux fois le même fichier audio.

### Gestion du réseau
Le module `utils/network.js` expose `getConnectionInfo()` qui renvoie :
- `isWifi`
- `isCellular`
- `isConnected`
Ces informations sont utilisées par le service de synchronisation pour décider d’uploader ou de télécharger.

### Points d’attention
- Les fichiers audio sont stockés : **IndexedDB** sur le web, **FileSystem.documentDirectory** sur mobile.
- Les erreurs de téléchargement affichent un toast : *« Téléchargement d’une pensée échoué, réessayez plus tard »*.
- La suppression d’un enregistrement supprime également le fichier audio local.

---

Pour plus de détails, consultez le code source des services `storage.js`, `sync.js` et le composant `SettingsDrawer.js`.

---

## 📱 Architecture Expo & Profils de Compilation (EAS Build)

Pour exécuter et tester l'application sur un appareil mobile Android via un fichier APK, deux profils de compilation distincts configurés dans `eas.json` sont à utiliser selon les besoins :

### 1. Profil de Développement (`--profile development`) - Development Client
* **Principe** : Il compile une coquille native de l'application (semblable à Expo Go) mais n'embarque **pas** le code JavaScript de l'application.
* **Comportement** : 
  * Affiche un écran intermédiaire d'Expo pour se connecter à ton serveur de développement local (Metro).
  * **Ne fonctionne pas hors-ligne** : Il nécessite une connexion Wi-Fi ou filaire active avec ton ordinateur (`npx expo start`) pour charger le JavaScript.
  * Sert uniquement à tester et débugger en direct avec le rechargement à chaud (Hot Reloading).
* **Commande de build** : `eas build -p android --profile development`

### 2. Profil de Preview (`--profile preview`) - APK Autonome (Standalone)
* **Principe** : Il compile et intègre directement l'ensemble du code JavaScript et des assets (le bundle JS) à l'intérieur du fichier binaire `.apk`.
* **Comportement** :
  * S'ouvre instantanément directement sur l'application KeepYourSeed, sans menu intermédiaire.
  * **Fonctionne parfaitement hors-ligne** (indispensable pour valider la logique Local-First).
  * Permet de tester en conditions réelles de production (partage de fichiers natifs, notifications push, etc.).
* **Commande de build** : `eas build -p android --profile preview`
