import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from 'react-native-responsive-dimensions';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface BottomNavigationProps {
  activeRoute: string;
  onRouteChange: (route: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeRoute,
  onRouteChange,
}) => {
  const { colors, theme } = useTheme();

  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          menu: '#4ECDC4',
          profile: '#FF6B6B',
          settings: '#FFD166',
        };
      case 'dark':
        return {
          menu: '#ffc300',
          profile: '#4ECDC4',
          settings: '#7BDFFF',
        };
      case 'purple':
        return {
          menu: '#9381FF',
          profile: '#FF9FB2',
          settings: '#B8B8FF',
        };
      case 'blue':
        return {
          menu: '#4ECDC4',
          profile: '#7BDFFF',
          settings: '#45B7D1',
        };
      default:
        return {
          menu: '#4ECDC4',
          profile: '#FF6B6B',
          settings: '#FFD166',
        };
    }
  };

  const themeColors = getThemeColors();

  const tabs = [
    { 
      key: 'profile', 
      label: 'Profile', 
      icon: 'account',
      color: themeColors.profile 
    },
    { 
      key: 'menu', 
      label: 'Menu', 
      icon: 'apps',
      color: themeColors.menu 
    },
    { 
      key: 'settings', 
      label: 'Settings', 
      icon: 'cog',
      color: themeColors.settings 
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      paddingVertical: responsiveHeight(1),
      paddingHorizontal: responsiveWidth(4),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: responsiveHeight(1),
    },
    menuTab: {
      backgroundColor: colors.background,
      borderRadius: responsiveWidth(8),
      padding: responsiveWidth(2),
      marginTop: -responsiveHeight(4),
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      width: responsiveWidth(12),
      height: responsiveWidth(12),
      borderRadius: responsiveWidth(6),
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuIconContainer: {
      width: responsiveWidth(15),
      height: responsiveWidth(15),
      borderRadius: responsiveWidth(7.5),
    },
    label: {
      fontSize: responsiveFontSize(1.4),
      fontFamily: typography.fontFamily.medium,
      color: colors.textSecondary,
      marginTop: responsiveHeight(0.5),
    },
    activeLabel: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
    },
  });

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            tab.key === 'menu' && styles.menuTab,
          ]}
          onPress={() => onRouteChange(tab.key)}
        >
          <View
            style={[
              styles.iconContainer,
              tab.key === 'menu' && styles.menuIconContainer,
              { backgroundColor: `${tab.color}20` },
            ]}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={tab.key === 'menu' 
                ? Math.round(responsiveFontSize(3.5)) 
                : Math.round(responsiveFontSize(2.8))
              }
              color={activeRoute === tab.key ? tab.color : colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.label,
              activeRoute === tab.key && styles.activeLabel,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};