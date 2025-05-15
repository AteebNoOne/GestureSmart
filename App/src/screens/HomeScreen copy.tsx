import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../constants/theme';
import { BottomNavigation } from '../components/BottomNavigation';
import { DrawerNavigationProp } from '@react-navigation/drawer';

interface HomeScreenProps {
  navigation: DrawerNavigationProp<any>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [activeRoute, setActiveRoute] = useState('home');
  const { colors } = useTheme();

  const handleRouteChange = (route: string) => {
    setActiveRoute(route);
    switch (route) {
      case 'reports':
        navigation.navigate('Reports');
        break;
      case 'menu':
        navigation.openDrawer();
        break;
    }
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.xl,
      paddingBottom: spacing.md,
    },
    menuButton: {
      padding: spacing.sm,
      marginRight: spacing.md,
    },
    headerContent: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: spacing.xl,
      paddingTop: 0,
    },
    welcomeText: {
      fontSize: typography.fontSize.xxl,
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: typography.fontSize.md,
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: spacing.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: typography.fontSize.lg,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      padding: spacing.md,
      borderRadius: spacing.sm,
      marginBottom: spacing.md,
    },
    quickActionText: {
      marginLeft: spacing.sm,
      fontSize: typography.fontSize.md,
      fontFamily: typography.fontFamily.medium,
      color: colors.primary,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
   
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>Welcome, Admin!</Text>
            <Text style={styles.subtitle}>
              Access your medical imaging tools and reports
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => navigation.navigate('Detection')}
            >
              <MaterialCommunityIcons
                name="brain"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.quickActionText}>
                New Hemorrhage Detection
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => handleRouteChange('reports')}
            >
              <MaterialCommunityIcons
                name="file-document"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.quickActionText}>
                View Recent Reports
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>System Status</Text>
            <Text style={styles.subtitle}>
              AI Model: Active
            </Text>
          </View>
        </ScrollView>

        <BottomNavigation
          activeRoute={activeRoute}
          onRouteChange={handleRouteChange}
        />
      </View>
    </SafeAreaView>
  );
};