import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, Animated } from 'react-native';
import { X, Check } from 'lucide-react-native';

const ITEM_HEIGHT = 44;

const WheelPicker = ({ data, value, onValueChange }) => {
    const flatListRef = useRef(null);
    const [selectedIndex, setSelectedIndex] = useState(data.indexOf(value));
    
    // Ajout de padding (2 éléments vides au début et à la fin) pour centrer
    const paddedData = ['', '', ...data, '', ''];

    useEffect(() => {
        const index = data.indexOf(value);
        if (index !== -1 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: false });
            }, 100);
        }
    }, [value, data]);

    const handleMomentumScrollEnd = (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        let index = Math.round(offsetY / ITEM_HEIGHT);
        if (index < 0) index = 0;
        if (index >= data.length) index = data.length - 1;
        
        setSelectedIndex(index);
        onValueChange(data[index]);
    };

    return (
        <View style={styles.wheelContainer}>
            <View style={styles.selectionHighlight} />
            <FlatList
                ref={flatListRef}
                data={paddedData}
                keyExtractor={(item, idx) => `${item}-${idx}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumScrollEnd}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                renderItem={({ item, index }) => {
                    const actualIndex = index - 2;
                    const isSelected = actualIndex === selectedIndex;
                    return (
                        <View style={styles.wheelItem}>
                            <Text style={[styles.wheelText, isSelected && styles.wheelTextSelected]}>
                                {item}
                            </Text>
                        </View>
                    );
                }}
            />
        </View>
    );
};

export default function TimeWheelPickerModal({ visible, onClose, initialTime, onSave }) {
    const [selectedHour, setSelectedHour] = useState('20');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const [isSuccess, setIsSuccess] = useState(false);
    const [showModal, setShowModal] = useState(visible);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(400)).current;

    // Préparation des données "00" à "23" et "00" à "59"
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    useEffect(() => {
        if (visible && initialTime) {
            const [h, m] = initialTime.split(':');
            setSelectedHour(h || '20');
            setSelectedMinute(m || '00');
        }

        if (visible) {
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
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 400,
                    duration: 250,
                    useNativeDriver: true,
                })
            ]).start(() => {
                setShowModal(false);
            });
        }
    }, [visible, initialTime]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 400,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => {
            setShowModal(false);
            onClose();
        });
    };

    const handleSave = () => {
        setIsSuccess(true);
        setTimeout(() => {
            onSave(`${selectedHour}:${selectedMinute}`);
            setIsSuccess(false);
            handleClose();
        }, 1200);
    };

    return (
        <Modal visible={showModal} transparent animationType="none" statusBarTranslucent={true}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                    <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
                </Animated.View>
                
                <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
                    {isSuccess ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successCircle}>
                                <Check size={48} color="#FFFFFF" />
                            </View>
                            <Text style={styles.successTitle}>C'est validé !</Text>
                            <Text style={styles.successText}>Rappel programmé à {selectedHour}:{selectedMinute}</Text>
                        </View>
                    ) : (
                        <>
                            {/* Header */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
                                    <X size={24} color="#78716C" />
                                </TouchableOpacity>
                                <Text style={styles.title}>Heure du rappel</Text>
                                <TouchableOpacity onPress={handleSave} style={styles.iconButton}>
                                    <Check size={24} color="#15803d" />
                                </TouchableOpacity>
                            </View>

                            {/* Roulettes */}
                            <View style={styles.pickersWrapper}>
                                <WheelPicker data={hours} value={selectedHour} onValueChange={setSelectedHour} />
                                <Text style={styles.separator}>:</Text>
                                <WheelPicker data={minutes} value={selectedMinute} onValueChange={setSelectedMinute} />
                            </View>
                            
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Valider</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backdropTouch: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 30,
        paddingTop: 16,
        paddingHorizontal: 20,
    },
    successContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        height: ITEM_HEIGHT * 5 + 130, // Conserver la même hauteur environ
    },
    successCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#15803d',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15803d',
        marginBottom: 8,
    },
    successText: {
        fontSize: 16,
        color: '#78716C',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#44403C',
    },
    pickersWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: ITEM_HEIGHT * 5, // Affiche 5 éléments
        backgroundColor: '#F5F5F4',
        borderRadius: 16,
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    wheelContainer: {
        height: ITEM_HEIGHT * 5,
        width: 80,
    },
    selectionHighlight: {
        position: 'absolute',
        top: ITEM_HEIGHT * 2,
        height: ITEM_HEIGHT,
        width: '100%',
        backgroundColor: '#E7E5E4',
        borderRadius: 12,
    },
    wheelItem: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    wheelText: {
        fontSize: 20,
        color: '#A8A29E',
        fontWeight: '500',
    },
    wheelTextSelected: {
        fontSize: 24,
        color: '#78350F',
        fontWeight: 'bold',
    },
    separator: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#78350F',
        marginHorizontal: 16,
    },
    saveButton: {
        backgroundColor: '#78350F',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
