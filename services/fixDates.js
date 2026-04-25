import { supabase } from './supabase';
import { getRecordings } from './storage';
import { fetchCloudRecordings } from './cloud';

export const fixServerDatesFromLocal = async (userId) => {
    try {
        console.log("Démarrage du script de correction des dates...");
        const localRecordings = await getRecordings();
        const cloudRecordings = await fetchCloudRecordings(userId);
        
        let fixedCount = 0;
        let errorCount = 0;

        for (const localRec of localRecordings) {
            // On a besoin d'un ID cloud et d'une date valide
            if (!localRec.dbId || !localRec.date) continue;

            const cloudRec = cloudRecordings.find(c => c.dbId === localRec.dbId);
            if (cloudRec) {
                const localDate = new Date(localRec.date).getTime();
                const cloudDate = new Date(cloudRec.date).getTime();

                // Si la date du serveur est très différente de la date locale originale (ex: plus de 2 heures d'écart)
                if (Math.abs(localDate - cloudDate) > 7200000) {
                    console.log(`Correction pour "${localRec.title}": ${new Date(cloudDate).toLocaleDateString()} -> ${new Date(localDate).toLocaleDateString()}`);
                    
                    const { error } = await supabase
                        .from('recordings')
                        .update({ created_at: localRec.date })
                        .eq('id', localRec.dbId);

                    if (error) {
                        console.error('Erreur Supabase pour', localRec.title, error);
                        errorCount++;
                    } else {
                        fixedCount++;
                    }
                }
            }
        }
        
        return { success: true, fixed: fixedCount, errors: errorCount };
    } catch (err) {
        console.error("Erreur critique dans le script de date:", err);
        return { success: false, error: err };
    }
};

/**
 * Script Inverse (Pour le téléphone) :
 * Aligne brutalement les dates locales sur les dates du serveur.
 * Utile quand le serveur a de bonnes dates (ex: suite à fixServerDatesFromLocal)
 * mais que le téléphone refuse de les absorber naturellement.
 */
export const fixLocalDatesFromServer = async (userId) => {
    try {
        const { saveRawRecordings } = require('./storage');
        const localRecordings = await getRecordings();
        const cloudRecordings = await fetchCloudRecordings(userId);

        if (!cloudRecordings || cloudRecordings.length === 0) {
            return { success: false, msg: "Impossible de récupérer les données du serveur." };
        }

        let fixedCount = 0;
        const cloudMap = new Map(cloudRecordings.map(c => [c.dbId, c]));

        const updatedLocals = localRecordings.map(localRec => {
            if (localRec.dbId && cloudMap.has(localRec.dbId)) {
                const cloudRec = cloudMap.get(localRec.dbId);
                if (localRec.date !== cloudRec.date) {
                    fixedCount++;
                    return {
                        ...localRec,
                        date: cloudRec.date,
                        updatedAt: cloudRec.updatedAt // On prend aussi l'updatedAt du cloud
                    };
                }
            }
            return localRec;
        });

        if (fixedCount > 0) {
            // Trier par date pour être sûr que l'historique est propre
            updatedLocals.sort((a, b) => new Date(b.date) - new Date(a.date));
            await saveRawRecordings(updatedLocals);
        }

        return { success: true, fixed: fixedCount };
    } catch (err) {
        console.error("Erreur critique dans le script de date local:", err);
        return { success: false, msg: err.message };
    }
};
