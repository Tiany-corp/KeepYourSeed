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
