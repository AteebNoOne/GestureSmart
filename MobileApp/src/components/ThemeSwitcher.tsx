import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContex';
import { useTheme } from '../hooks/useTheme';

const BUTTON_SIZE = 40;

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useThemeContext();
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  // Updated themes with more intuitive icons
  const themes = [
    { id: 'light', icon: 'brightness-5' },      // Sun icon
    { id: 'dark', icon: 'brightness-2' },       // Moon icon
    { id: 'blue', icon: 'water' },             // Water/wave icon
    { id: 'purple', icon: 'flower' },          // Flower icon for purple
  ] as const;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    themeButton: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 4,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    activeButton: {
      backgroundColor: colors.primary,
    },
  });

  const handlePress = (themeId: typeof themes[number]['id']) => {
    if (theme === themeId && !isExpanded) {
      setIsExpanded(true);
    } else {
      setTheme(themeId);
      setIsExpanded(false);
    }
  };

  // Find the current theme object
  const currentTheme = themes.find(t => t.id === theme);

  return (
    <View style={styles.container}>
      {isExpanded ? (
        // Show all options when expanded
        themes.map((themeOption) => (
          <TouchableOpacity
            key={themeOption.id}
            style={[
              styles.themeButton,
              themeOption.id === theme && styles.activeButton,
            ]}
            onPress={() => handlePress(themeOption.id)}
          >
            <MaterialCommunityIcons
              name={themeOption.icon}
              size={24}
              color={themeOption.id === theme ? '#FFFFFF' : colors.text}
            />
          </TouchableOpacity>
        ))
      ) : (
        // Show only selected theme when collapsed
        <TouchableOpacity
          style={[styles.themeButton, styles.activeButton]}
          onPress={() => handlePress(theme)}
        >
          <MaterialCommunityIcons
            name={currentTheme?.icon || themes[0].icon}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};