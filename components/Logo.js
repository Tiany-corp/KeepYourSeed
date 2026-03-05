import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export default function Logo({ size = 100, color = '#4D7C0F', variant = 'solid', style }) {
    // A minimalist, flat seed design inspired by a single drop/seed shape
    // The color defaults to the 'Vert olive' (#4D7C0F) from INTENTION.md

    const isOutline = variant === 'outline';

    return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
                {/* Main seed body */}
                <Path
                    d="M50 10C50 10 20 45 20 70C20 86.5685 33.4315 100 50 100C66.5685 100 80 86.5685 80 70C80 45 50 10 50 10Z"
                    fill={isOutline ? 'transparent' : color}
                    stroke={isOutline ? color : 'none'}
                    strokeWidth={isOutline ? "8" : "0"}
                    strokeLinejoin="round"
                />
                {/* Simple minimal inner sprout/line for depth flatly */}
                <Path
                    d="M50 35C45 50 45 70 50 85"
                    stroke={isOutline ? color : "#FAF7F2"}
                    strokeWidth={isOutline ? "8" : "4"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Little decorative dot indicating life/germination */}
                <Circle cx={isOutline ? "65" : "60"} cy={isOutline ? "75" : "75"} r={isOutline ? "6" : "4"} fill={isOutline ? color : "#D4A574"} />
            </Svg>


        </View>
    );
}
