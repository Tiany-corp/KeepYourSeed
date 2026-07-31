import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TouchableWithoutFeedback, Animated } from 'react-native';
import { X, Check } from 'lucide-react-native';

export default function DailyMemoryFilterModal({ visible, onClose, availableTags, currentPref, onSave }) {
    const [selectedTag, setSelectedTag] = useState(currentPref);
    const [showModal, setShowModal] = useState(visible);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (visible) {
            setSelectedTag(currentPref);
            setShowModal(true);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            handleCloseAnimation();
        }
    }, [visible, currentPref]);

    const handleCloseAnimation = (callback) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => {
            setShowModal(false);
            if (callback) callback();
        });
    };

    const handleRequestClose = () => {
        handleCloseAnimation(onClose);
    };

    const handleSave = () => {
        handleCloseAnimation(() => {
            onSave(selectedTag);
            onClose();
        });
    };

    if (!showModal) return null;

    return (
        <Modal
            visible={showModal}
            animationType="none"
            transparent={true}
            statusBarTranslucent={true}
            onRequestClose={handleRequestClose}
        >
            <TouchableWithoutFeedback onPress={handleRequestClose}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    <TouchableWithoutFeedback>
                        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Filtre de pensée souvenir</Text>
                                <TouchableOpacity onPress={handleRequestClose} style={styles.closeBtn}>
                                    <X size={24} color="#78716C" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.description}>
                                Choisissez le type de pensée que vous souhaitez redécouvrir chaque jour.
                            </Text>

                            <ScrollView style={styles.list}>
                                <TouchableOpacity
                                    style={[styles.tagItem, !selectedTag && styles.tagItemSelected]}
                                    onPress={() => setSelectedTag(null)}
                                >
                                    <Text style={[styles.tagText, !selectedTag && styles.tagTextSelected]}>
                                        🌍 Tous les types (Aléatoire)
                                    </Text>
                                    {!selectedTag && <Check size={20} color="#D97706" />}
                                </TouchableOpacity>

                                {availableTags.map((tag) => {
                                    if (tag.id === '_messages_') return null;
                                    const isSelected = selectedTag === tag.id;
                                    return (
                                        <TouchableOpacity
                                            key={tag.id}
                                            style={[styles.tagItem, isSelected && styles.tagItemSelected]}
                                            onPress={() => setSelectedTag(tag.id)}
                                        >
                                            <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                                                {tag.emoji} {tag.label}
                                            </Text>
                                            {isSelected && <Check size={20} color="#D97706" />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>Valider</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FAF7F2',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#292524',
    },
    closeBtn: {
        padding: 4,
    },
    description: {
        fontSize: 14,
        color: '#78716C',
        marginBottom: 20,
        lineHeight: 20,
    },
    list: {
        marginBottom: 24,
    },
    tagItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#F5F0E8',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    tagItemSelected: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
    },
    tagText: {
        fontSize: 16,
        color: '#44403C',
        fontWeight: '500',
    },
    tagTextSelected: {
        color: '#D97706',
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: '#D97706',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
