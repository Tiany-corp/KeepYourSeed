import { AVAILABLE_TAGS } from '../components/TitleModal';

/**
 * Retourne les informations complètes d'un tag (label, emoji, id).
 * Supporte les tags prédéfinis et les tags personnalisés (préfixés par 'custom_').
 */
export function getTagInfo(tagId) {
    if (!tagId) return null;
    
    // 1. Chercher dans les tags système
    const found = AVAILABLE_TAGS.find(t => t.id === tagId);
    if (found) return found;
    
    // 2. Gérer les tags personnalisés (ex: custom_Ma_Super_Tag)
    if (tagId.startsWith('custom_')) {
        const label = tagId.replace('custom_', '').replace(/_/g, ' ');
        return { 
            id: tagId, 
            label: label.charAt(0).toUpperCase() + label.slice(1), 
            emoji: '🏷️' 
        };
    }
    
    return null;
}
