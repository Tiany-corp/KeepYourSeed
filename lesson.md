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
