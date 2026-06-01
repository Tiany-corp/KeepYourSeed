import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Text, Animated, Dimensions, Pressable } from 'react-native';
import { Edit2, Trash2, Pin, X, Share2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OptionsMenu = ({ isVisible, onClose, position, onEdit, onDelete, onPin, onShare }) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (isVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [isVisible]);

    if (!isVisible || !position) return null;

    // Positionnement à gauche du bouton
    const menuWidth = 180;
    const menuHeight = 160;
    
    // On place le menu à gauche (pageX) moins sa largeur, avec une petite marge
    let left = position.pageX - menuWidth - 10;
    // On centre verticalement par rapport au bouton
    let top = position.pageY + (position.height / 2) - (menuHeight / 2);

    // Sécurité : si ça sort de l'écran à gauche, on le remet à droite
    if (left < 10) left = position.pageX + position.width + 10;
    // Sécurité : si ça sort en haut ou en bas
    if (top < 10) top = 10;
    if (top + menuHeight > SCREEN_HEIGHT - 50) top = SCREEN_HEIGHT - menuHeight - 50;

    return (
        <Modal transparent visible={isVisible} animationType="none" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Animated.View 
                    style={[
                        styles.menuContainer, 
                        { top, left, opacity: fadeAnim, transform: [{ scale: fadeAnim }] }
                    ]}
                >
                    <TouchableOpacity style={styles.menuItem} onPress={() => { onEdit(); onClose(); }}>
                        <Edit2 size={18} color="#78350F" />
                        <Text style={styles.menuText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { 
                        onShare(); 
                        setTimeout(onClose, 150); 
                    }}>
                        <Share2 size={18} color="#78350F" />
                        <Text style={styles.menuText}>Partager</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { onPin(); onClose(); }}>
                        <Pin size={18} color="#78350F" />
                        <Text style={styles.menuText}>Épingler</Text>
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity style={[styles.menuItem, styles.deleteItem]} onPress={() => { onDelete(); onClose(); }}>
                        <Trash2 size={18} color="#B91C1C" />
                        <Text style={[styles.menuText, styles.deleteText]}>Supprimer</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.05)', // Très léger pour garder le focus
    },
    menuContainer: {
        position: 'absolute',
        width: 180,
        backgroundColor: '#FAF7F2',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 12,
        borderRadius: 8,
    },
    menuText: {
        fontSize: 15,
        color: '#78350F',
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 4,
        marginHorizontal: 8,
    },
    deleteItem: {
        // Optionnel : fond très léger rouge au survol
    },
    deleteText: {
        color: '#B91C1C',
    },
});

export default OptionsMenu;
