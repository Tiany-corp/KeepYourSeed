import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

export default function CustomDatePicker({ selectedDate, onSelectDate, minDate }) {
    // Navigation se fait par mois
    const [viewDate, setViewDate] = useState(() => {
        if (selectedDate) return new Date(selectedDate);
        if (minDate) return new Date(minDate);
        return new Date();
    });

    // Si on change la date via un bouton externe (ex: +1 an), on veut que le calendrier y aille
    useEffect(() => {
        if (selectedDate) {
            setViewDate(new Date(selectedDate));
        }
    }, [selectedDate]);

    const goToPreviousMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const monthNames = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const dayNames = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

    const isDateDisabled = (year, month, day) => {
        if (!minDate) return false;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return dateStr < minDate;
    };

    const isDateSelected = (year, month, day) => {
        if (!selectedDate) return false;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return dateStr === selectedDate;
    };

    const isToday = (year, month, day) => {
        const today = new Date();
        return year === today.getFullYear() &&
            month === today.getMonth() &&
            day === today.getDate();
    };

    const handleSelectDay = (year, month, day) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onSelectDate(dateStr);
    };

    const renderGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); // 0(Sun) - 6(Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Ajuster pour que Lundi soit le 1er jour (0 = Lundi, 6 = Dimanche)
        const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1;

        const days = [];
        // Cellules vides pour le début du mois
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        // Jours du mois
        for (let i = 1; i <= daysInMonth; i++) {
            const disabled = isDateDisabled(year, month, i);
            const selected = isDateSelected(year, month, i);
            const today = !selected && isToday(year, month, i); // Seulement si pas déjà sélectionné

            days.push(
                <View key={`day-container-${i}`} style={styles.dayCell}>
                    <TouchableOpacity
                        style={[
                            styles.dayCircle,
                            today && styles.dayCircleToday,
                            selected && styles.dayCircleSelected,
                            disabled && styles.dayCircleDisabled
                        ]}
                        onPress={() => !disabled && handleSelectDay(year, month, i)}
                        disabled={disabled}
                    >
                        <Text style={[
                            styles.dayText,
                            today && styles.dayTextToday,
                            selected && styles.dayTextSelected,
                            disabled && styles.dayTextDisabled
                        ]}>
                            {i}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return <View style={styles.daysGrid}>{days}</View>;
    };

    // Si on navigue trop loin dans le passé, on peut désactiver le bouton précédent
    const isPrevMonthDisabled = () => {
        if (!minDate) return false;
        const minD = new Date(minDate);
        return viewDate.getFullYear() === minD.getFullYear() && viewDate.getMonth() <= minD.getMonth();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={goToPreviousMonth}
                    style={styles.navButton}
                    disabled={isPrevMonthDisabled()}
                >
                    <ChevronLeft size={20} color={isPrevMonthDisabled() ? '#D4A574' : '#78350F'} />
                </TouchableOpacity>

                <Text style={styles.monthText}>
                    {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                </Text>

                <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
                    <ChevronRight size={20} color="#78350F" />
                </TouchableOpacity>
            </View>

            <View style={styles.weekDaysRow}>
                {dayNames.map(d => (
                    <Text key={d} style={styles.weekDayText}>{d}</Text>
                ))}
            </View>

            {renderGrid()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#D4A574',
        marginTop: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    navButton: {
        padding: 4,
    },
    monthText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#292524',
    },
    weekDaysRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: '#A8A29E',
        fontWeight: '500',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    dayCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayCircleToday: {
        backgroundColor: '#F5F0E8',
        borderWidth: 1,
        borderColor: '#D4A574',
    },
    dayCircleSelected: {
        backgroundColor: '#78350F',
    },
    dayCircleDisabled: {
        opacity: 1,
    },
    dayText: {
        fontSize: 14,
        color: '#292524',
        fontWeight: '500',
    },
    dayTextToday: {
        color: '#78350F',
        fontWeight: '700',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    dayTextDisabled: {
        color: '#D4A574',
        opacity: 0.5,
    },
});
