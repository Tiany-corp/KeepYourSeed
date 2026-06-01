import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getAudioSource } from '../services/storage';
import { getSignedAudioUrl } from '../services/cloud';

/**
 * Prépare et pré-charge les ressources nécessaires au partage (Blobs, fichiers, signatures).
 * Appelée en arrière-plan à l'ouverture du menu d'options pour contourner les restrictions asynchrones.
 * 
 * @param {Object} item - L'enregistrement audio à préparer.
 * @returns {Promise<{file: File|null, urlToShare: string|null, downloadUrl: string|null}>}
 */
export const prepareShareData = async (item) => {
    if (!item) return { file: null, urlToShare: null, downloadUrl: null };

    let file = null;
    let blob = null;
    let blobUrl = null;
    let signedUrl = null;

    try {
        if (Platform.OS === 'web') {
            // 1. Récupération du Blob local IndexedDB
            const source = await getAudioSource(item);
            if (source && source.uri) {
                blobUrl = source.uri;
                try {
                    const res = await fetch(source.uri);
                    blob = await res.blob();
                } catch (e) {
                    console.warn("Échec du fetch du Blob local :", e);
                }
            }

            // 2. Si pas en local, récupération via Supabase
            if (!blob && item.remoteUrl) {
                try {
                    const { url, error } = await getSignedAudioUrl(item.remoteUrl);
                    if (!error && url) {
                        signedUrl = url;
                        const res = await fetch(url);
                        if (res.ok) {
                            blob = await res.blob();
                        }
                    }
                } catch (fetchErr) {
                    console.warn("Échec silencieux de la récupération du Blob Supabase en tâche de fond :", fetchErr);
                }
            }

            // 3. Création du fichier physique
            if (blob) {
                file = new File([blob], `${item.title || 'pensee'}.m4a`, { type: 'audio/mp4' });
            }

            // 4. Détermination du lien de partage (Supabase ou URL locale statique)
            let urlToShare = signedUrl;
            if (!urlToShare && item.remoteUrl) {
                if (item.remoteUrl.startsWith('public/') || item.remoteUrl.startsWith('http')) {
                    urlToShare = item.remoteUrl;
                } else {
                    const resUrl = await getSignedAudioUrl(item.remoteUrl);
                    urlToShare = resUrl.url;
                }
            }

            // 5. Détermination du lien de téléchargement
            let downloadUrl = blobUrl || signedUrl;
            if (!downloadUrl && item.remoteUrl) {
                if (item.remoteUrl.startsWith('public/') || item.remoteUrl.startsWith('http')) {
                    downloadUrl = item.remoteUrl;
                } else {
                    const res = await getSignedAudioUrl(item.remoteUrl);
                    downloadUrl = res.url;
                }
            }

            return { file, urlToShare, downloadUrl };
        }
    } catch (e) {
        console.warn("Erreur prepareShareData :", e);
    }

    return { file: null, urlToShare: null, downloadUrl: null };
};

/**
 * Service universel de partage audio (Web & Mobile).
 * Déclenche le partage natif système si possible (Web & Mobile), sinon télécharge le fichier.
 * 
 * @param {Object} item - L'enregistrement audio à partager.
 * @param {Function} showAlert - Fonction showAlert issue de AlertContext pour notifier l'utilisateur.
 * @param {Object|null} preloadedData - Données pré-chargées générées de manière synchrone par prepareShareData.
 */
export const shareAudio = async (item, showAlert, preloadedData = null) => {
    if (!item) return;

    // --- LOGIQUE DE PARTAGE WEB ---
    if (Platform.OS === 'web') {
        let file = preloadedData?.file || null;
        let urlToShare = preloadedData?.urlToShare || null;
        let downloadUrl = preloadedData?.downloadUrl || null;

        // Si l'utilisateur clique si vite que le préchargement n'est pas encore fini (Fallback)
        if (!preloadedData) {
            let blob = null;
            let blobUrl = null;
            let signedUrl = null;
            try {
                const source = await getAudioSource(item);
                if (source && source.uri) {
                    blobUrl = source.uri;
                    const res = await fetch(source.uri);
                    blob = await res.blob();
                }

                if (!blob && item.remoteUrl) {
                    try {
                        const { url, error } = await getSignedAudioUrl(item.remoteUrl);
                        if (!error && url) {
                            signedUrl = url;
                            const res = await fetch(url);
                            if (res.ok) {
                                blob = await res.blob();
                            }
                        }
                    } catch (fetchErr) {
                        console.warn("Échec de la récupération du Blob Supabase en direct :", fetchErr);
                    }
                }

                if (blob) {
                    file = new File([blob], `${item.title || 'pensee'}.m4a`, { type: 'audio/mp4' });
                }

                urlToShare = signedUrl;
                if (!urlToShare && item.remoteUrl) {
                    if (item.remoteUrl.startsWith('public/') || item.remoteUrl.startsWith('http')) {
                        urlToShare = item.remoteUrl;
                    } else {
                        const resUrl = await getSignedAudioUrl(item.remoteUrl);
                        urlToShare = resUrl.url;
                    }
                }

                downloadUrl = blobUrl || signedUrl;
                if (!downloadUrl && item.remoteUrl) {
                    if (item.remoteUrl.startsWith('public/') || item.remoteUrl.startsWith('http')) {
                        downloadUrl = item.remoteUrl;
                    } else {
                        const res = await getSignedAudioUrl(item.remoteUrl);
                        downloadUrl = res.url;
                    }
                }
            } catch (err) {
                console.error("Échec de la préparation à la volée :", err);
            }
        }

        // --- EXÉCUTION DU PARTAGE DE MANIÈRE 100% SYNCHRONE (SI DÉJÀ EN MÉMOIRE) ---
        try {
            // --- Stratégie 1 : Partage du fichier physique via Web Share API ---
            if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: item.title,
                        text: `Écoute ma pensée : ${item.title}`
                    });
                    showAlert('Partagé', 'Votre pensée a été partagée !', 'success');
                    return;
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') {
                        console.log('Partage annulé par l\'utilisateur.');
                        return;
                    }
                    console.warn('Échec stratégie 1 (partage fichier physique) :', shareErr.message || shareErr);
                }
            }

            // --- Stratégie 2 : Partage du lien cloud Supabase via Web Share API ---
            if (navigator.share && urlToShare) {
                try {
                    await navigator.share({
                        title: item.title,
                        text: `Écoute ma pensée : ${item.title}`,
                        url: urlToShare
                    });
                    showAlert('Partagé', 'Lien de partage envoyé !', 'success');
                    return;
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') {
                        console.log('Partage annulé par l\'utilisateur.');
                        return;
                    }
                    console.warn('Échec stratégie 2 (partage lien) :', shareErr.message || shareErr);
                }
            }

            // --- Stratégie 3 (Fallback ultime) : Téléchargement direct du fichier ---
            if (downloadUrl) {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `${item.title || 'pensee'}.m4a`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showAlert('Téléchargé', "Le partage n'étant pas supporté sur ce navigateur, le fichier audio a été téléchargé.", 'success');
            } else {
                showAlert('Indisponible', 'Fichier introuvable pour le partage ou le téléchargement.', 'error');
            }
        } catch (err) {
            console.error('Erreur partage web:', err);
            showAlert('Erreur', 'Impossible de partager ce fichier.', 'error');
        }
        return;
    }

    // --- LOGIQUE DE PARTAGE MOBILE NATIVE ---
    try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            showAlert('Non disponible', 'Le partage n\'est pas disponible sur cet appareil.', 'info');
            return;
        }

        let fileUri = item.localUri;

        if (!fileUri && item.remoteUrl) {
            const { url, error } = await getSignedAudioUrl(item.remoteUrl);
            if (error || !url) {
                showAlert('Erreur', 'Impossible de récupérer le fichier audio.', 'error');
                return;
            }
            const ext = item.remoteUrl.split('.').pop() || 'm4a';
            const tmpPath = `${FileSystem.cacheDirectory}share_${item.id}.${ext}`;
            const download = await FileSystem.downloadAsync(url, tmpPath);
            fileUri = download.uri;
        }

        if (!fileUri) {
            showAlert('Fichier introuvable', 'Cet audio n\'est pas encore disponible en local.', 'info');
            return;
        }

        await Sharing.shareAsync(fileUri, {
            mimeType: 'audio/mp4',
            dialogTitle: `Partager "${item.title}"`,
            UTI: 'public.mpeg-4-audio',
        });
    } catch (error) {
        console.error('Erreur de partage:', error);
        showAlert('Erreur', 'Le partage a échoué.', 'error');
    }
};
