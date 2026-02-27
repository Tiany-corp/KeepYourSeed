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
