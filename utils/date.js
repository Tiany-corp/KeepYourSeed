/**
 * Utilitaires de formatage de dates — réutilisables dans toute l'app.
 */

/**
 * Retourne un texte contextuel selon la distance temporelle.
 * Ex: "Mardi soir", "Il y a 2 semaines", "Le 5 mars"
 */
export function getRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    // Moment de la journée
    const hour = date.getHours();
    let moment = '';
    if (hour >= 5 && hour < 12) moment = ' matin';
    else if (hour >= 12 && hour < 18) moment = ' après-midi';
    else if (hour >= 18 && hour < 22) moment = ' soir';
    else moment = ' dans la nuit';

    // Jour de la semaine
    const joursSemaine = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const jour = joursSemaine[date.getDay()];

    // < 7 jours : jour nommé + moment ("Mardi soir")
    if (diffDays === 0) return `Ce${moment}`;
    if (diffDays === 1) return `Hier${moment}`;
    if (diffDays < 7) return `${jour}${moment}`;

    // 7 jours - 3 mois : relatif ("Il y a 2 semaines")
    if (diffDays < 14) return 'La semaine dernière';
    if (diffDays < 90) {
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
        }
        const months = Math.floor(diffDays / 30);
        return `Il y a ${months} mois`;
    }

    // > 3 mois : date nommée ("Le 5 mars")
    const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return `Le ${dateStr}`;
}

/**
 * Retourne un texte relatif + date complète.
 * Ex: "Il y a 3 mois, le 27 novembre 2025"
 */
export function formatMemoryDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    let relativeText = '';
    if (diffDays === 0) relativeText = "Aujourd'hui";
    else if (diffDays === 1) relativeText = 'Hier';
    else if (diffDays < 30) relativeText = `Il y a ${diffDays} jours`;
    else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        relativeText = `Il y a ${months} mois`;
    } else {
        const years = Math.floor(diffDays / 365);
        relativeText = `Il y a ${years} an${years > 1 ? 's' : ''}`;
    }

    const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${relativeText}, le ${dateStr}`;
}

/**
 * Formate des millisecondes en "M:SS".
 * Ex: 65000 → "1:05"
 */
export function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}
