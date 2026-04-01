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
