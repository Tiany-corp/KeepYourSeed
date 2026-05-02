# Troubleshooting - KeepYourSeed

Ce document répertorie les problèmes techniques rencontrés lors du développement et leurs solutions.

## 🔐 Authentification Google (OAuth)

### Problème : Erreur "Failed to launch 'exp://...'" sur navigateur Web
**Date** : 26 Avril 2026
**Symptôme** : Lors d'une tentative de connexion Google sur PC (Web), après avoir choisi le compte Google, le navigateur essaie d'ouvrir une URL commençant par `exp://192.168.x.x:8081` au lieu de revenir sur l'application Web. Cela provoque un chargement infini ou une erreur de protocole.

#### 🚩 Cause Racine
Le paramètre `redirectTo` envoyé à Supabase était mal détecté ou mal formaté pour l'environnement Web. 
- Si l'app envoie une URL `exp://` (propre à Expo Go), Supabase redirige vers ce protocole que le navigateur PC ne sait pas gérer.
- Si l'app envoie une URL avec un `pathname` (ex: `/kys-web-app/`) qui n'est pas explicitement autorisé dans le dashboard Supabase, Supabase fait un "fallback" sur le **Site URL** configuré. Si ce Site URL est lui-même une adresse `exp://`, l'erreur survient.

#### ✅ Solution Appliquée
1.  **Code (`services/googleAuth.js`)** : 
    - Sécurisation de la détection du mode Web via `typeof window !== 'undefined'`.
    - Forçage du `redirectTo` vers la racine du domaine (`window.location.origin + '/'`) pour garantir la compatibilité avec le **Site URL** de Supabase.
2.  **Configuration Supabase (Dashboard)** :
    - Positionner le **Site URL** sur `http://localhost:8081` (ou l'URL de production).
    - Ajouter les URLs de redirection autorisées :
        - `http://localhost:8081/`
        - `http://localhost:3000/`
        - `keepyourseed://auth-callback` (pour le build natif Android/iOS)

---

## 📁 Stockage & Synchronisation

### Problème : "Audio pas encore disponible en local" sur le Souvenir du Jour
**Date** : 26 Avril 2026
**Symptôme** : Au clic sur "Play" de la pensée souvenir, le fichier audio ne se lance pas et la console affiche `Audio "..." pas encore disponible en local`.
#### 🚩 Cause Racine
La fonction `fetchRandomRecording` récupérait un enregistrement aléatoire depuis Supabase via RPC. Comme le serveur ignore l'emplacement physique du fichier sur le téléphone, il renvoyait l'objet avec un `localUri` nul. Cet objet était mis en cache tel quel, rendant la lecture impossible par le lecteur "Local-First".
#### ✅ Solution Appliquée
Dans `services/storage.js` (`getDailyMemory`), avant de retourner l'objet mis en cache ou venant du cloud, on recherche une correspondance locale basée sur le `remoteUrl` ou le `dbId` pour lui ré-attacher dynamiquement son `localUri`.

---

## 🎨 UI & Animations

### Problème : Animation "Pulse/Glow" invisible sur Android/Web
**Date** : 26 Avril 2026
**Symptôme** : L'effet de halo (Glow) autour de la "Pensée souvenir" fonctionnait sur iOS mais était totalement invisible sur Android et Web.
#### 🚩 Cause Racine
La couche "Glow" utilisait exactement les mêmes dimensions que la carte principale (`top: 0, bottom: 0...`) et s'appuyait uniquement sur l'ombre (`elevation` sur Android). Or, sur Android, une ombre sous un objet de même taille reste cachée si l'opacité est animée.
#### ✅ Solution Appliquée
Modification de `glowLayer` dans `DailyMemoryCard.js` pour utiliser des coordonnées négatives (`top: -8, bottom: -8...`) et un `backgroundColor` translucide, créant un vrai "débordement" visible cross-platform.

### Problème : Animation "Glow" absente à la première connexion
**Date** : 26 Avril 2026
**Symptôme** : Malgré un statut "non vu", l'animation de halo orange ne se déclenche pas lors de la première arrivée sur l'Historique après un Login.
#### 🚩 Cause Racine
1. **État initial** : `isDailyMemorySeen` était à `true` par défaut, masquant l'animation pendant le chargement.
2. **Race Condition** : Dans `RecordScreen.js`, le clic sur le badge de notification marquait la pensée comme "vue" dans le stockage local *avant* de naviguer vers l'Historique. L'Historique recevait donc un état déjà "vu".
#### ✅ Solution Appliquée
1. Initialisation de `isDailyMemorySeen` à `null` pour attendre la confirmation du stockage avant de monter le composant.
2. Suppression du marquage "vu" prématuré dans `RecordScreen.js`. Le statut ne passe à "vu" que lors de l'interaction réelle avec la carte dans l'Historique.

---

## ☁️ Cloud & Architecture

### Problème : Pensées souvenir différentes entre PC et Mobile
**Date** : 26 Avril 2026
**Symptôme** : Un utilisateur connecté au même compte voit une pensée A sur son téléphone et une pensée B sur son PC le même jour.
#### 🚩 Cause Racine
La fonction SQL `get_random_recording` utilisait `ORDER BY random()`. Sans cache partagé entre les appareils, chaque appel retournait un résultat différent, brisant la cohérence de l'expérience utilisateur.
#### ✅ Solution Appliquée
Implémentation d'une logique **déterministe** dans `services/storage.js`. L'application récupère la liste des enregistrements et en choisit un via un index calculé sur le `dayOfYear` + un hash de l' `userId`. La pensée est ainsi identique sur tous les supports pour une journée donnée.

### Problème : Historique vide sur un nouvel appareil (4G/WiFi)
**Date** : 26 Avril 2026
**Symptôme** : Lors d'une première connexion sur un nouveau device en 4G, l'historique restait vide alors que des données existaient sur le Cloud.
#### 🚩 Cause Racine
La synchronisation était totalement bloquée si la préférence "WiFi uniquement" était active et que l'utilisateur était en 4G. Cela bloquait non seulement les fichiers audio (lourds) mais aussi les métadonnées (légères), donnant l'impression que le compte était vide.
#### ✅ Solution Appliquée
Découplage de la synchronisation dans `services/sync.js` :
1. **Métadonnées** : Toujours synchronisées (4G autorisée) pour peupler l'UI immédiatement.
2. **Fichiers Audio** : Restent soumis à la restriction WiFi (mise en cache locale différée).
3. Ajout d'un indicateur visuel dans les paramètres pour forcer le téléchargement manuel si besoin.

---

## 🔄 Synchronisation & Doublons

### Problème : Apparition de doublons lors de la synchronisation (ID dupliqués dans React)
**Date** : 26 Avril 2026
**Symptôme** : Après un enregistrement ou un refresh, des vocaux apparaissent en double. Tenter d'en supprimer un supprime les deux. Erreur console : `Encountered two children with the same key`.

#### 🚩 Cause Racine (Multiples)
1.  **UUID Corrompus** : La fonction `saveRecordingToDatabase` renvoyait l'objet complet de la ligne Supabase au lieu de juste l'UUID. Cet objet était stocké tel quel dans le `dbId` local, créant des erreurs de syntaxe UUID (`[object Object]`) lors des tentatives de suppression ou de matching.
2.  **Matching par Date instable** : Le format de date différait parfois entre le Cloud (`T` séparateur ISO) et le Local (espace séparateur SQL), empêchant la réconciliation immédiate après upload.
3.  **Logique de Fusion Fragile** : L'utilisation de 3 listes séparées (`new`, `updated`, `cleaned`) dans `sync.js` permettait des chevauchements si un item n'était pas correctement identifié.

#### ✅ Solution Appliquée
1.  **Sanitisation Auto (`storage.js`)** : Ajout d'un filtre dans `getRecordings` qui détecte les `dbId` de type "objet" et les convertit dynamiquement en UUID string (id).
2.  **Architecture Map-Based (`sync.js`)** : Réécriture complète de `pullCloudRecordings` utilisant un `Map` unique indexé par ID local. Il est désormais structurellement impossible d'avoir deux fois le même ID local dans la liste fusionnée.
3.  **Dédoublonnage au Rendu (`HistoryScreen.js`)** : Ajout d'une fonction `dedup` systématique avant de peupler le state `recordings`, servant de dernier filet de sécurité pour la stabilité de la FlatList.

### Problème : Consommation de stockage excessive (Cloud)
**Date** : 26 Avril 2026
**Symptôme** : Les enregistrements audio consomment trop d'espace (~50MB pour 2 mois d'usage solo), risquant de saturer le quota gratuit de Supabase (1GB) avec plusieurs utilisateurs.

#### 🚩 Cause Racine
Utilisation du preset `RecordingPresets.HIGH_QUALITY` d'Expo qui enregistre en Stéréo, 44.1kHz avec un débit élevé, non nécessaire pour de la voix simple.

#### ✅ Solution Appliquée
Passage à une configuration manuelle optimisée dans `useAudioRecorder.js` :
- **Bitrate** : 64 kbps (au lieu de ~192+ kbps).
- **Canaux** : Mono (au lieu de Stéréo).
- **Gain d'espace** : Réduction d'environ 3x à 4x du poids des fichiers sans perte de compréhension vocale.

---

## 🗓️ Système Daily Memory (Pile du haut)

### Problème : Boucle infinie / Blocage au chargement de l'Historique
**Date** : 2 Mai 2026
**Symptôme** : L'écran Historique reste figé ou l'application plante lors du chargement des souvenirs.
#### 🚩 Cause Racine
Une récursion infinie s'était glissée entre `getDailyMemories` et `getDailyMemory` dans `services/storage.js`. De plus, une dépendance circulaire entre `storage.js` et `cloud.js` empêchait l'initialisation correcte sur certains appareils mobiles.
#### ✅ Solution Appliquée
1. Refonte de `getDailyMemories` pour être totalement autonome.
2. Déplacement de la logique de requête Supabase directement dans `storage.js` (en important uniquement `supabase`) pour casser le cycle d'importation avec `cloud.js`.

### Problème : Messages du jour "invisibles" dans la pile (mais présents dans la liste)
**Date** : 2 Mai 2026
**Symptôme** : Un message enregistré pour "Aujourd'hui" apparaît bien dans la liste du bas, mais la catégorie "Message reçu" en haut reste absente ou vide.
#### 🚩 Cause Racine
**Décalage horaire (UTC vs Local)**. La requête Supabase utilisait des filtres `gte`/`lte` basés sur `ISOString` (UTC). Un message envoyé à 1h du matin à Paris (UTC+2) était considéré par la base de données comme envoyé la veille à 23h, et donc exclu du filtre "Aujourd'hui".
#### ✅ Solution Appliquée
Assouplissement du filtre serveur : l'application récupère désormais tous les messages non ouverts arrivés à échéance, puis effectue un tri précis sur le téléphone en comparant la date avec l'heure locale réelle de l'appareil.

### Problème : État "Ouvert" non persistant après redémarrage
**Date** : 2 Mai 2026
**Symptôme** : Ouvrir un message enlève bien son halo lumineux (glow), mais si on ferme et rouvre l'application, le message redevient "brillant" comme s'il n'avait jamais été lu.
#### 🚩 Cause Racine
Le contenu de la pile quotidienne est mis en cache dans `AsyncStorage` pour la journée afin de garantir la vitesse. L'action d'ouvrir un message mettait à jour l'affichage (State React) mais ne mettait pas à jour l'objet JSON stocké dans le cache.
#### ✅ Solution Appliquée
Création de `updateDailyMemoryInCache` dans `storage.js`. Chaque interaction (ouverture/lecture) met désormais à jour instantanément la copie locale du cache pour que l'état soit préservé tout au long de la journée, même hors-ligne.

### Problème : Ralentissement de l'écran Historique sur Mobile
**Date** : 2 Mai 2026
**Symptôme** : Plus l'utilisateur a de messages, plus l'écran Historique met du temps à s'afficher sur téléphone.
#### 🚩 Cause Racine
L'application récupérait la totalité des enregistrements locaux (`getRecordings`) **avant** de vérifier si un cache valide existait déjà, provoquant des lectures disque inutiles à chaque ouverture d'écran.
#### ✅ Solution Appliquée
Optimisation du flux dans `getDailyMemories` : l'application vérifie d'abord la validité du cache (opération ultra-rapide). Elle ne sollicite le moteur de recherche local et le cloud que si le cache est absent, expiré ou si l'utilisateur force manuellement le rafraîchissement (Pull-to-Refresh).

