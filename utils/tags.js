import { get, set } from 'idb-keyval';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';

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

export const CUSTOM_TAG_EMOJIS = [
    '🔥', '⭐', '💪', '❤️', '🎵', '📖', '✨', '🌍',
    '🏆', '💎', '🕊️', '🌙', '⚡', '🎨', '📌', '🔑',
    '🎯', '🌿', '💡', '🌱', '☀️', '☕', '🚀', '💬'
];

/**
 * Charge les tags personnalisés depuis le stockage local (AsyncStorage / IndexedDB).
 */
export const loadCustomTags = async () => {
    try {
        if (Platform.OS === 'web') {
            const data = await get(CUSTOM_TAGS_KEY);
            return data ? JSON.parse(data) : [];
        } else {
            const data = await AsyncStorage.getItem(CUSTOM_TAGS_KEY);
            return data ? JSON.parse(data) : [];
        }
    } catch {
        return [];
    }
};

/**
 * Sauvegarde les tags personnalisés en local et les envoie sur Supabase si l'utilisateur est connecté.
 */
export const persistCustomTags = async (tags, syncWithCloud = true) => {
    try {
        const str = JSON.stringify(tags);
        if (Platform.OS === 'web') {
            await set(CUSTOM_TAGS_KEY, str);
        } else {
            await AsyncStorage.setItem(CUSTOM_TAGS_KEY, str);
        }
        _customTagsCache = tags;

        if (syncWithCloud) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                supabase.auth.updateUser({
                    data: { custom_tags: tags }
                }).catch(err => console.warn('Erreur sync cloud tags:', err));
            }
        }
    } catch (e) {
        console.warn('Failed to save custom tags', e);
    }
};

export const syncCustomTagsWithCloud = async () => {
    try {
        let user = null;
        try {
            const { data } = await supabase.auth.getUser();
            user = data?.user;
        } catch {
            // Mode hors-ligne ou erreur réseau
        }
        if (!user) {
            const { data: { session } } = await supabase.auth.getSession();
            user = session?.user;
        }
        if (!user) return _customTagsCache;

        const cloudTags = Array.isArray(user.user_metadata?.custom_tags) ? user.user_metadata.custom_tags : [];
        const localTags = await loadCustomTags();

        // Fusion sans doublons par ID
        const map = new Map();
        localTags.forEach(t => { if (t && t.id) map.set(t.id, t); });
        cloudTags.forEach(t => { if (t && t.id) map.set(t.id, t); });
        const merged = Array.from(map.values());

        // Mise à jour locale si des nouveautés viennent du cloud
        if (JSON.stringify(merged) !== JSON.stringify(localTags)) {
            await persistCustomTags(merged, false);
        }

        // Mise à jour cloud si le local avait des tags pas encore envoyés
        if (JSON.stringify(merged) !== JSON.stringify(cloudTags)) {
            await supabase.auth.updateUser({
                data: { custom_tags: merged }
            });
        }

        _customTagsCache = merged;
        return merged;
    } catch (e) {
        console.warn('Erreur syncCustomTagsWithCloud:', e);
        return _customTagsCache;
    }
};

/**
 * Charge les tags personnalisés depuis le stockage pour le cache synchrone.
 */
export const loadCustomTagsCache = async () => {
    try {
        const tags = await loadCustomTags();
        _customTagsCache = tags;
        return tags;
    } catch (e) {
        console.warn('Failed to load custom tags cache', e);
        return [];
    }
};

/**
 * Retourne les informations complètes d'un tag (label, emoji, id).
 */
export function getTagInfo(tagId) {
    if (!tagId) return null;
    
    const lowerId = String(tagId).toLowerCase();
    const cleanId = lowerId.replace(/^custom_/, '');

    // 1. Chercher dans les tags système
    const found = AVAILABLE_TAGS.find(t => 
        t.id.toLowerCase() === lowerId || 
        t.label.toLowerCase() === lowerId ||
        t.id.toLowerCase() === cleanId
    );
    if (found) return found;
    
    // 2. Chercher dans le cache des tags personnalisés (par ID, label ou ID sans préfixe custom_)
    const customFound = _customTagsCache.find(t => {
        if (!t) return false;
        const tId = (t.id || '').toLowerCase();
        const tLabel = (t.label || '').toLowerCase();
        const tClean = tId.replace(/^custom_/, '');
        return tId === lowerId || tLabel === lowerId || tClean === cleanId || tClean === lowerId;
    });
    if (customFound) return customFound;

    // 3. Fallback pour les tags non encore mis en cache
    const label = cleanId.replace(/_/g, ' ');
    return {
        id: tagId,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        emoji: '🏷️'
    };
}
