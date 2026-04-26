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
