import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getAudioSource } from '../services/storage';
import { getSignedAudioUrl } from '../services/cloud';

/**
 * Service universel de partage audio (Web & Mobile).
 * 
 * @param {Object} item - L'enregistrement audio à partager.
 * @param {Function} showAlert - Fonction showAlert issue de AlertContext pour notifier l'utilisateur.
 */
export const shareAudio = async (item, showAlert) => {
    if (!item) return;

    // --- LOGIQUE DE PARTAGE WEB ---
    if (Platform.OS === 'web') {
        let blob = null;
        let blobUrl = null;
        let signedUrl = null;
        try {
            // 1. Essayer de récupérer le Blob local (IndexedDB)
            const source = await getAudioSource(item);
            if (source && source.uri) {
                blobUrl = source.uri;
                const res = await fetch(source.uri);
                blob = await res.blob();
            }

            // 2. Si pas en local, essayer de le récupérer via Supabase (sécurisé contre les erreurs CORS)
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
                    console.warn("Échec silencieux de la récupération du Blob Supabase (CORS ou réseau) :", fetchErr);
                }
            }

            // 3. Préparer le fichier physique pour le partage
            let file = null;
            if (blob) {
                file = new File([blob], `${item.title || 'pensee'}.m4a`, { type: 'audio/mp4' });
            }

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
                    // On ne lève pas d'erreur globale, on laisse les stratégies suivantes prendre le relais
                }
            }

            // --- Stratégie 2 : Partage du lien cloud Supabase via Web Share API ---
            if (navigator.share && (signedUrl || item.remoteUrl)) {
                let urlToShare = signedUrl;
                if (!urlToShare && item.remoteUrl) {
                    if (item.remoteUrl.startsWith('public/') || item.remoteUrl.startsWith('http')) {
                        urlToShare = item.remoteUrl;
                    } else {
                        const resUrl = await getSignedAudioUrl(item.remoteUrl);
                        urlToShare = resUrl.url;
                    }
                }
                if (urlToShare) {
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
                        // On continue vers le fallback ultime
                    }
                }
            }

            // --- Stratégie 3 (Fallback ultime) : Téléchargement direct du fichier ---
            let downloadUrl = blobUrl || signedUrl;
            if (!downloadUrl && item.remoteUrl) {
                if (item.remoteUrl.startsWith('public/') || item.remoteUrl.startsWith('http')) {
                    downloadUrl = item.remoteUrl;
                } else {
                    const res = await getSignedAudioUrl(item.remoteUrl);
                    downloadUrl = res.url;
                }
            }

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
        // Vérifier si le partage est dispo sur cet appareil (Mobile)
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            showAlert('Non disponible', 'Le partage n\'est pas disponible sur cet appareil.', 'info');
            return;
        }

        let fileUri = item.localUri;

        // Si pas de fichier local mais un fichier cloud, le télécharger temporairement
        if (!fileUri && item.remoteUrl) {
            const { url, error } = await getSignedAudioUrl(item.remoteUrl);
            if (error || !url) {
                showAlert('Erreur', 'Impossible de récupérer le fichier audio.', 'error');
                return;
            }
            // Télécharger dans le cache temporaire
            const ext = item.remoteUrl.split('.').pop() || 'm4a';
            const tmpPath = `${FileSystem.cacheDirectory}share_${item.id}.${ext}`;
            const download = await FileSystem.downloadAsync(url, tmpPath);
            fileUri = download.uri;
        }

        if (!fileUri) {
            showAlert('Fichier introuvable', 'Cet audio n\'est pas encore disponible en local.', 'info');
            return;
        }

        // Ouvrir la feuille de partage native (WhatsApp, iMessage, Mail, etc.)
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
