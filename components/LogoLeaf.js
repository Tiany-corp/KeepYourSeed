import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * LogoLeaf — Version feuille du logo KeepYourSeed
 * Basé sur icon.svg (feuille avec nervure et graine)
 * 
 * Props:
 *   size     — taille du composant (default 100)
 *   color    — couleur de la feuille (default vert olive #4D7C0F)
 *   variant  — 'solid' (rempli) ou 'outline' (contour uniquement)
 *   style    — style additionnel sur le conteneur
 */
export default function LogoLeaf({ size = 100, color = '#4D7C0F', variant = 'solid', style }) {
    const isOutline = variant === 'outline';

    return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
            <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">

                {/* Forme principale de la feuille */}
                <Path
                    d="M166 450 C100 350 115 220 200 145 C260 92 340 68 395 62 C385 130 380 240 345 325 C305 422 225 455 188 448Z"
                    fill={isOutline ? 'transparent' : color}
                    stroke={isOutline ? color : 'none'}
                    strokeWidth={isOutline ? 14 : 0}
                    strokeLinejoin="round"
                />

                {/* Nervure centrale */}
                <Path
                    d="M178 448 Q245 280 340 135 Q220 295 158 446Z"
                    fill={isOutline ? 'none' : '#FAF7F2'}
                    stroke={isOutline ? color : 'none'}
                    strokeWidth={isOutline ? 8 : 0}
                    strokeLinecap="round"
                />
                {/* En mode outline, on dessine la nervure comme un simple trait */}
                {isOutline && (
                    <Path
                        d="M175 445 Q245 275 340 130"
                        fill="none"
                        stroke={color}
                        strokeWidth={8}
                        strokeLinecap="round"
                    />
                )}

                {/* Graine */}
                <Path
                    d="M285 315 C305 310 320 325 315 340 C310 355 290 365 275 355 C260 345 265 320 285 315Z"
                    fill={isOutline ? 'transparent' : '#D4A574'}
                    stroke={isOutline ? '#D4A574' : 'none'}
                    strokeWidth={isOutline ? 8 : 0}
                />

            </Svg>
        </View>
    );
}
