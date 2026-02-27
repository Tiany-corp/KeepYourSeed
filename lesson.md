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
