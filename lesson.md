# Leçons et Erreurs Rencontrées

## Supabase Storage : `400 (Bad Request)` avec `createSignedUrl`

**Problème rencontré :**
Lors de l'utilisation de données "factices" (de démonstration), les fichiers audio insérés en base de données contenaient des URLs externes directement utilisables (`https://audio-samples...`). Cependant, lors de la tentative de lecture de ces audios, Supabase retournait systématiquement l'erreur réseau : `400 (Bad Request)` accompagnée du message `Signed URL Error: Object not found`.

**Cause racine :**
Dans notre application réelle, nous avons configuré Supabase Storage de telle sorte qu'il faille récupérer une autorisation d'accès via `createSignedUrl` (car nos buckets audios sont privés).
- **Fonctionnement normal :** On passe à `createSignedUrl` un "chemin de fichier" (ex: `1234-uuid/9876.m4a`). Supabase vérifie que le fichier existe dans le bucket et nous renvoie une URL temporaire valide générée spécifiquement pour notre session.
- **Pourquoi ça a crashé :** Quand l'application envoyait une URL publique externe complète (`https://...`), Supabase tentait de trouver un fichier littéralement nommé `https://...` à la racine de son bucket. N'existant pas, la création échouait poliment avec une erreur `400`.

**La Solution Apportée :**
Il faut implémenter une condition "bifurcation" ou "bypass" dans la couche service qui gère la récupération de l'URL pour la lecture du lecteur audio. 

Si l'URL sauvegardée en base commence par `http` (donc est publique/externe), on ne demande **aucune** signature.

Exemple de traitement adapté dans le getter (ex: `getAudioSource` dans `storage.js`) :
```javascript
export const getAudioSource = async (recording) => {
    // ... vérifications fichiers locaux ...

    // Fallback : cloud URL (fichier sur Firebase, Supabase, AWS, etc.)
    if (recording.remoteUrl) {
        
        // CORRECTION IMPORTANTE : bypass signature si l'URL est déjà résolue de manière absolue
        if (recording.remoteUrl.startsWith('http')) {
            return { uri: recording.remoteUrl };
        }

        // Sinon, c'est l'un de nos vrais fichiers privés sur notre backend (format : "dossier/fichier.ext")
        const { getSignedAudioUrl } = require('./cloud');
        const signedUrl = await getSignedAudioUrl(recording.remoteUrl);
        return signedUrl ? { uri: signedUrl } : null;
    }
    
    return null;
}
```

**Retenir pour la suite :**
Toujours s'assurer du format des éléments passés aux SDKs Cloud. Les méthodes `getSignedUrl`, `getDownloadUrl` n'attendent jamais d'URL complètes en entrées, seules des chaînes de caractères représentant le chemin ou le *path* du ressource doivent être transmises.

---

## Toujours penser à exploiter Supabase (RPC) avant de bricoler côté client

**Problème rencontré :**
Pour la fonctionnalité "Souvenir du jour" (récupérer un enregistrement audio aléatoire), la première approche implémentée faisait **2 requêtes côté client** :
1. Un `SELECT COUNT(*)` pour compter le nombre total d'enregistrements.
2. Un `SELECT ... OFFSET randomIndex LIMIT 1` pour récupérer l'enregistrement à un index aléatoire.

C'était fonctionnel, mais inutilement lourd : 2 allers-retours réseau, de la logique aléatoire dans le JavaScript du téléphone, et un code plus complexe à maintenir.

**L'erreur de réflexe :**
L'IA n'a pas pensé à proposer directement une **fonction RPC PostgreSQL** (`get_random_recording`) côté Supabase, alors que c'était la solution la plus adaptée dès le départ. Supabase permet de créer des fonctions SQL personnalisées appelables en une seule ligne depuis le client. Il aurait fallu solliciter l'utilisateur pour créer cette fonction dans Supabase, plutôt que de tout résoudre côté application.

**La bonne solution (appliquée ensuite) :**
Créer une fonction SQL dans Supabase :
```sql
CREATE OR REPLACE FUNCTION get_random_recording(p_user_id UUID)
RETURNS TABLE (...) AS $$
    SELECT * FROM recordings
    WHERE user_id = p_user_id
    ORDER BY random()
    LIMIT 1;
$$;
```
Et l'appeler simplement depuis le client :
```javascript
const { data } = await supabase.rpc('get_random_recording', { p_user_id: userId });
```

**Retenir pour la suite :**
Quand une logique implique un calcul sur des données en base (tri, filtrage complexe, agrégation, aléatoire, etc.), **toujours se demander en premier** si Supabase (PostgreSQL) peut le faire nativement via une fonction RPC. C'est :
- **Plus performant** : 1 requête au lieu de N.
- **Plus robuste** : la logique est centralisée dans la base, pas éparpillée dans le code client.
- **Plus maintenable** : si l'algorithme change, on modifie la fonction SQL sans toucher à l'app.

---

## Vérification régulière du Build de Production & Erreurs "is not a function"

**Problème rencontré :**
Lors du développement, l'application fonctionnait parfaitement sur le serveur de développement local (`expo start`), mais le build de production web générait une page blanche avec une erreur obscure du type : `TypeError: u.create is not a function` (qui correspondait en réalité à `StyleSheet.create is not a function`).

**Cause racine :**
Les erreurs du type `X is not a function` dans un build proviennent très souvent de **fichiers de configuration globaux** (comme `babel.config.js` ou `metro.config.cjs`) ou de problèmes d'imports résolus différemment en production qu'en développement. Dans notre cas, c'était le plugin Babel de **NativeWind** qui entrait en conflit avec la version web lors de la compilation de production.

**Retenir pour la suite :**
91. **Les fichiers de configuration sont souvent coupables :** Si une erreur incompréhensible comme `is not a function` survient en production alors que tout marche en dev, c'est que les outils de compilation (Babel, Metro) transforment mal le code. Il faut isoler le problème en vérifiant les configurations et les imports globaux.
92. **Vérifier la version buildée régulièrement :** Ne pas attendre d'avoir terminé le développement pour tester un build de production. Il faut exporter régulièrement (ex: `npx expo export --platform web`) et tester localement le build (avec un script personnalisé serve-prod.js) pour s'assurer qu'aucune configuration n'a cassé le rendu final.

---

## Pièges de l'égalité référentielle dans les Hooks React

**Le Problème (suite à un refacto) :**
Lors de la simplification des props d'un composant, une erreur classique d'architecture a été tentée : passer directement l'objet entier retourné par un *custom hook* en tant que prop à un composant enfant (ex. `<AudioPlayer player={player} />` au lieu d'une dizaine de props isolées), et de l'utiliser dans le tableau de dépendances d'un `useCallback` (ex. `[player]`).

**La Cause (Comment React gère la mémoire) :**
Un *custom hook* (`useMemoryPlayer` par exemple) retourne généralement un **nouvel objet** `{ isPlaying, showPlayer, toggle... }` à **chaque rendu** du composant appelant.
1. **Passage d'objet global** : En passant `{player}` entier en prop, React détruit complètement "l'égalité référentielle". Le composant recevra *techniquement* un nouvel objet mémoire à chaque frame, causant un re-rendu perpétuel et bloquant toute optimisation avec `React.memo`. 
2. **Tableaux de dépendances** : Utiliser un objet retourné par un hook dans un dépendance de `useEffect` ou `useCallback` (`[player]`) empêche l'optimisation. La fonction sera recréée à chaque rendu du composant, car la référence de l'objet `{player}` aura muté par rapport au rendu précédent.

**Retenir pour la suite :**
- **Préférer l'aplatissement (Props Drilling sélectif)** : Même si l'écriture est plus longue `<AudioPlayer isPlaying={player.isPlaying} position={player.position} />`, cette syntaxe est infiniment plus sûre et optimale. React sait comparer des booléens (`isPlaying`) et des entiers (`position`), mais échoue sur les nouveaux objets générés à la volée.
- **Isoler les dépendances** : Les fonctions internes utiles dans un hook doivent être stabilisées (via `useCallback` intérieur). Et le composant utilisant ce hook, au lieu de dépendre du hook entier, doit dépendre de ses propriétés stables une à une (ex: utiliser `[player.toggle]` plutôt que `[player]`).

---

## Hygiène du Code & Maintien de la Fluidité

**Problème rencontré :**
L'application a subi une phase de ralentissement critique (lags au clic, scroll saccadé, latence audio) due à une accumulation de re-rendus inutiles et à l'utilisation d'une bibliothèque audio (`expo-av`) dont l'architecture synchrone bloquait le thread principal.

**Solutions et bonnes pratiques appliquées :**

1. **Ne jamais surcharger les Contextes Globaux** : 
   - **L'erreur** : Tout mettre dans un seul `AppContext`. Chaque changement de valeur (même minime) re-déclenche le rendu de TOUS les composants consommateurs.
   - **La bonne pratique** : Segmenter les contextes par domaine fonctionnel. Si une valeur change souvent (ex: progression audio), elle doit avoir son propre contexte isolé (`AudioPlayerProgressContext`) pour ne pas impacter le reste de l'interface.

2. **Migration vers les APIs Natives Modernes** : 
   - Sous SDK 54, `expo-av` est obsolète. Sa gestion des ressources matérielles est bloquante.
   - **La solution** : Utiliser `expo-audio` pour un "zapping" instantané et un arrêt d'enregistrement asynchrone (optimiste). Toujours privilégier les nouvelles bibliothèques modulaires d'Expo qui séparent le contrôle de l'UI du matériel.

3. **Mémorisation Sélective (React.memo & useMemo)** :
   - Pour les listes (`FlatList`) avec beaucoup d'items, l'utilisation de `React.memo` sur les composants de lignes (`RecordingItem`) est indispensable dès que l'état global de l'application (comme la lecture audio) change fréquemment. Sans cela, un simple compteur qui défile bloque le scroll du fait de la pression sur le CPU.

4. **Surveillance des Ressources Lourdes** :
   - Préférer les icônes vectorielles (`lucide-react-native`) aux images bitmap pour l'interface de base.
   - Pour les futures images (profil, miniatures), toujours prévoir une étape de compression/optimisation avant l'affichage pour éviter de saturer la mémoire vive de l'appareil.

**Retenir pour la suite :**
La fluidité n'est pas un bonus, c'est une exigence structurelle. Chaque nouvelle fonctionnalité doit être pensée sous l'angle : *"Est-ce que cet état va forcer un re-rendu inutile ailleurs ?"*. Si la réponse est oui, il faut isoler l'état ou mémoriser le composant.

---

## Pièges du Native Bridge avec \`expo-audio\` SDK 54 (Crash silencieux)

**Problème rencontré :**
Le bouton "fermer la modale" du lecteur audio ne fonctionnait plus sur l'APK Android (l'audio s'arrêtait mais la modale restait figée à l'écran), alors qu'il fonctionnait très bien sur le web ou lorsqu'on cliquait sur la zone d'ombre à l'extérieur. De plus, des erreurs massives apparaissaient dans les logs de développement (`Exception in HostFunction`).

**Cause racine :**
1. **L'erreur native** : L'API d'expo-audio (SDK 54) est très récente. L'instruction \`player.replace(null)\` était utilisée pour vider le lecteur audio. Sur le web, le DOM le tolérait, mais sur le Native Bridge (Android), cette méthode n'accepte pas \`null\` (elle attend obligatoirement une source valide) et faisait exploser la fonction JavaScript silencieusement.
2. **L'ordre des états** : La modification des états React (\`setModalVisible(false)\`) était située *après* l'appel natif défaillant (\`player.replace(null)\`). Quand le natif crashait, l'exécution s'arrêtait et l'instruction de cacher la modale n'était jamais atteinte !
3. **Le "Stuck Modal" d'Android** : Une tentative de réparation (\`if (!currentTrack) return null;\`) détruisait brutalement le composant \`<Modal>\` dans l'arbre React alors qu'il était réputé encore visible par le système Android, causant un *glitch* très connu où la modale native reste physiquement bloquée au premier plan.

**La Solution Apportée :**
1. **Suppression de la rustine** destructrice pour les Modals. On laisse le composant persister et on gère uniquement sa propriété \`visible={false}\`.
2. **Nettoyage de l'API** : Suppression de l'appel brutal \`player.replace(null)\` en faveur d'un simple \`player.pause()\`.
3. **L'ordre de l'Optimistic UI** : On modifie **toujours** l'Interface Utilisateur (les React States) *avant* d'envoyer des commandes instables vers le Kernel (matériel).
4. **Sécurité maximale** : Ajout d'un bloc \`try / catch\` autour des sollicitations matérielles (manipulation de modules natifs).

**Retenir pour la suite :**
- **Cacher les symptômes ne règle rien** : Résoudre un "problème de clic" sans écouter les "erreurs bizarres" des logs fait perdre du temps.
- **Méfiance systémique envers le Bridge** : Le JavaScript de React Native doit survivre (via des \`try/catch\`) à toute excentricité d'iOS ou Android.
- **Isoler l'UI** : L'UI doit réagir localement malgré les erreurs en tâche de fond.

---

## 🐞 Le Piège du `.single()` dans Supabase (Erreur "Aucun Push Token trouvé")

**Le Problème :**
L'Edge Function Deno renvoyait systématiquement l'erreur "Aucun Push Token trouvé pour cet utilisateur" lors des tests de notifications distantes, avec un code HTTP 400. Dans l'application mobile, l'erreur était masquée par le message générique *"Edge Function returned a non-2xx status code"* issu du SDK Supabase.

**L'Investigation :**
En interrogeant directement la base de données, nous avons constaté que la table `user_push_tokens` contenait **plusieurs lignes** pour le même utilisateur ! 
En effet, lors des tests sur Web ou Émulateurs, Expo ne parvenait pas à générer de vrais jetons et renvoyait des **phrases d'erreur** (`Error: You must provide notification...`).
L'application sauvegardait naïvement ces textes via `upsert({ onConflict: 'expo_push_token' })`. Chaque erreur étant textuellement différente, Supabase créait de multiples nouvelles lignes au lieu d'écraser la précédente.

**Le Crash :**
Dans l'Edge Function Deno, la requête SQL se terminait par la méthode `.single()`. Cette méthode exige de trouver **strictement une et une seule ligne**. Face à ces multiples lignes, Supabase Postgres renvoyait une erreur `PGRST116 (multiple rows returned)`, déclenchant le bloc `catch` et l'échec de la fonction.

**La Solution Apportée :**
1. **Extraction de l'erreur client** : Mise à jour de `SettingsDrawer.js` avec `await error.context.json()` pour forcer le client à afficher la VRAIE erreur envoyée par le serveur Deno.
2. **Robustesse de l'Edge Function** : 
   - Modification de la requête Supabase dans `index.ts`.
   - Utilisation de `.like('expo_push_token', 'ExponentPushToken%')` pour filtrer et ignorer toutes les fausses chaînes d'erreurs.
   - Remplacement du `.single()` mortel par `.order('created_at', { ascending: false }).limit(1)`, afin de toujours prendre le jeton valide le plus récent sans jamais crasher (ce qui prépare aussi l'application au support multi-appareils).
   - Sécurisation de l'authentification Deno en passant explicitement le JWT (`supabaseClient.auth.getUser(jwt)`).

---

## Modales React Native : Séparer les animations (Slide & Fade) et gérer la Barre d'état

**Le Problème (Effet visuel indésirable) :**
Lorsqu'on utilise le composant `<Modal>` par défaut de React Native avec `animationType="slide"` et `transparent={true}`, l'animation de glissement (vers le haut) affecte **la totalité de l'écran**, y compris l'overlay/le fond noir semi-transparent. Cela crée un effet étrange où l'ombre glisse depuis le bas au lieu d'apparaître naturellement.

De plus, sur Android, le fond transparent de la modale s'arrêtait net juste en dessous de la barre d'état (StatusBar), créant une bande claire disgracieuse tout en haut de l'écran.

**La Solution Apportée :**
1. **Séparation des Animations via l'API `Animated` :**
   - Remplacement de `animationType="slide"` par `animationType="none"`.
   - Utilisation de deux variables animées (`fadeAnim` pour l'opacité du fond noir et `slideAnim` pour le déplacement vertical du bloc de contenu).
   - Utilisation de `Animated.parallel()` dans un `useEffect` pour jouer les deux animations simultanément à l'ouverture.
   - **Interception de la fermeture** : Création d'une fonction `handleClose` qui joue les animations à l'envers (disparition du fond noir et glissement vers le bas du contenu) avant de déclencher l'unmount réel de la modale.
2. **Couverture de la Barre d'état :**
   - Ajout de la propriété `statusBarTranslucent={true}` sur le composant `<Modal>`. Cela force la modale à s'étendre sur 100% de la hauteur de l'écran (y compris derrière la barre d'état et l'encoche), permettant à l'overlay noir de recouvrir intégralement l'application.

**Retenir pour la suite :**
Pour des composants d'interface premium comme des "Bottom Sheets" ou des roulettes de sélection, ne pas s'appuyer sur l'animation native basique de la modale. Créer sa propre composition `Animated` offre un rendu beaucoup plus professionnel, et ne pas oublier `statusBarTranslucent={true}` pour éviter les artefacts visuels sur Android.

---

## ⏰ Notifications Programmées : Syntaxe du Trigger (Erreur expo-notifications)

**Le Problème :**
Les notifications distantes Push fonctionnaient parfaitement, mais les rappels quotidiens (programmés localement via `scheduleNotificationAsync`) ne se déclenchaient pas.
Aucune erreur n'était visible dans le terminal, ou une erreur discrète "The trigger object you provided is invalid" survenait selon la version d'Expo.

**La Cause :**
Dans les versions récentes d'`expo-notifications`, passer directement un objet `Date` Javascript à la propriété `trigger` ne fonctionne plus de manière fiable, particulièrement sur Android où un identifiant de canal (`channelId`) est exigé pour que la notification locale soit acceptée par le système d'exploitation.

**La Solution Apportée :**
Encapsuler la date dans un objet spécifique, préciser IMPÉRATIVEMENT `type: 'date'` pour qu'Expo ne l'ignore pas, et renseigner explicitement le `channelId` pour Android :
```javascript
// Avant (Incorrect / Déprécié) :
trigger: new Date()

// Après (Correct et Robuste) :
trigger: { 
  type: 'date',
  date: new Date(),
  channelId: 'default' // Identifiant défini lors de setNotificationChannelAsync
}
```

**Retenir pour la suite :**
Si l'objet `trigger` passé à Expo n'est pas strictement reconnu (ex: oubli de la propriété `type: 'date'`), **Expo ignorera silencieusement la date et déclenchera la notification IMMÉDIATEMENT**. C'est ce qui provoque l'apparition de 14 notifications simultanées lors d'une boucle `for` de programmation !

---

## 🔜 Prochaines Optimisations Prévues (À faire plus tard)

1. **Fluidité de la Barre de Progression (Interpolation) [FAIT]** :
   - **Enjeu** : L'affichage natif fait des "sauts" ( Bridge JS). 
   - **Solution** : Implémenté via `react-native-reanimated`. La SharedValue `animatedPosition` est synchronisée avec `withTiming` pour un défilement fluide à 60 FPS, offrant une expérience premium.
