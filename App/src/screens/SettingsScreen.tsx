import React from "react";
import { SafeAreaView, View, TouchableOpacity, StyleSheet, Text, Platform } from "react-native";
import { spacing, ThemeType, typography } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContex';
import { NavigationProp } from "@react-navigation/native";

const BUTTON_SIZE = 40;
 interface PrivacyPolicyScreenProps {
   navigation: NavigationProp<any>;
 }
 
export const SettingsScreen:React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const { theme, setTheme } = useThemeContext();

  const themes = [
    { id: 'light' as ThemeType, icon: 'white-balance-sunny' as const },
    { id: 'dark' as ThemeType, icon: 'weather-night' as const },
    { id: 'blue' as ThemeType, icon: 'tune' as const },
    { id: 'purple' as ThemeType, icon: 'palette' as const },
  ];

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      padding: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginLeft: spacing.md,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: spacing.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.fontSize.md,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
      marginBottom: spacing.md,
    },
    themeContainer: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: 'transparent',
    },
    themeButton: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 2,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons 
              name="arrow-left" 
              size={24} 
              color={colors.text} 
            />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeContainer}>
            {themes.map((themeOption) => (
              <TouchableOpacity
                key={themeOption.id}
                style={[
                  styles.themeButton,
                  themeOption.id === theme && styles.activeButton,
                ]}
                onPress={() => setTheme(themeOption.id)}
              >
                <MaterialCommunityIcons
                  name={themeOption.icon}
                  size={24}
                  color={themeOption.id === theme ? '#FFFFFF' : colors.text}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};