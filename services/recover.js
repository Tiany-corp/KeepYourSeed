import { Platform } from 'react-native';
import { getRecordings, STORAGE_KEY, saveRawRecordings } from './storage';

/**
 * Ce script est une bouée de sauvetage.
 * Il scanne le stockage brut du navigateur (IndexedDB) à la recherche de fichiers audio
 * dont les métadonnées Json ont été accidentellement écrasées par le dédoublonnage agressif.
 * Il ressuscite ces fichiers avec leur date originelle via leur timestamp caché dans l'ID du fichier.
 */
export const recoverOrphanedAudios = async () => {
    if (Platform.OS !== 'web') {
        return { success: false, msg: "Ce script de récupération spécial est conçu pour le Web." };
    }

    try {
        const { keys } = require('idb-keyval');
        const allKeys = await keys();
        const audioKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('audio_file_'));

        const localRecordings = await getRecordings();
        const activeLocalUris = new Set(localRecordings.map(r => r.localUri).filter(Boolean));
        const activeIds = new Set(localRecordings.map(r => r.id));

        let recoveredCount = 0;
        const orphans = [];

        for (const k of audioKeys) {
            const rawId = k.replace('audio_file_', '');
            const expectedUri = `indexeddb://${rawId}`;

            // Si cet audio n'est plus relié à aucun enregistrement dans notre JSON
            if (!activeLocalUris.has(expectedUri) && !activeIds.has(rawId)) {
                
                // L'ID était un timestamp : Date.now()
                const timestamp = parseInt(rawId, 10);
                const isValidDate = !isNaN(timestamp) && timestamp > 1600000000000 && timestamp < 2000000000000;
                
                const recDate = isValidDate ? new Date(timestamp).toISOString() : new Date().toISOString();

                orphans.push({
                    id: rawId,
                    localUri: expectedUri,
                    remoteUrl: null,
                    status: 'pending',
                    date: recDate,
                    updatedAt: new Date().toISOString(),
                    duration: 0, // Impossible de deviner la durée du blob instantanément, mis à 0
                    title: `Vocaux récupéré`,
                    type: 'note',
                    tags: ['Récupération Urgence']
                });

                recoveredCount++;
            }
        }

        if (recoveredCount > 0) {
            const merged = [...localRecordings, ...orphans];
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            await saveRawRecordings(merged);
        }

        return { success: true, count: recoveredCount };
    } catch (e) {
        console.error("Erreur de récupération:", e);
        return { success: false, msg: e.message };
    }
};
