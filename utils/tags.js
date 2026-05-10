import { get } from 'idb-keyval';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CUSTOM_TAGS_KEY = '@custom_tags_v1';
let _customTagsCache = [];

export const AVAILABLE_TAGS = [
    { id: 'enseignement', label: 'Enseignement', emoji: '🌱' },
    { id: 'gratitude', label: 'Gratitude', emoji: '💛' },
    { id: 'idee', label: 'Idée', emoji: '💡' },
    { id: 'reflexion', label: 'Réflexion', emoji: '🧠' },
    { id: 'souvenir', label: 'Souvenir', emoji: '🌿' },
    { id: 'priere', label: 'Prière exaucée', emoji: '🙏' },
    { id: 'objectif', label: 'Objectif', emoji: '🎯' },
    { id: 'temoignage', label: 'Témoignage', emoji: '💬' },
];

/**
 * Charge les tags personnalisés depuis le stockage pour le cache synchrone.
 */
export const loadCustomTagsCache = async () => {
    try {
        let data;
        if (Platform.OS === 'web') {
            data = await get(CUSTOM_TAGS_KEY);
        } else {
            data = await AsyncStorage.getItem(CUSTOM_TAGS_KEY);
        }
        if (data) {
            _customTagsCache = JSON.parse(data);
        }
    } catch (e) {
        console.warn('Failed to load custom tags cache', e);
    }
};

/**
 * Retourne les informations complètes d'un tag (label, emoji, id).
 */
export function getTagInfo(tagId) {
    if (!tagId) return null;
    
    const lowerId = tagId.toLowerCase();

    // 1. Chercher dans les tags système
    const found = AVAILABLE_TAGS.find(t => t.id.toLowerCase() === lowerId || t.label.toLowerCase() === lowerId);
    if (found) return found;
    
    // 2. Chercher dans le cache des tags personnalisés
    const customFound = _customTagsCache.find(t => t.id === tagId);
    if (customFound) return customFound;

    // 3. Fallback pour les tags personnalisés non encore mis en cache
    if (tagId.startsWith('custom_')) {
        const label = tagId.replace('custom_', '').replace(/_/g, ' ');
        return { 
            id: tagId, 
            label: label.charAt(0).toUpperCase() + label.slice(1), 
            emoji: '🏷️' 
        };
    }
    
    return {
        id: tagId,
        label: tagId.charAt(0).toUpperCase() + tagId.slice(1),
        emoji: '🏷️'
    };
}
