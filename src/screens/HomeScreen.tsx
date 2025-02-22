import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { NavigationProp } from '@react-navigation/native';
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import { BottomNavigation } from '../components/BottomNavigation';

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}

interface Feature {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description: string;
  color: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();
  const [animatedValue] = useState(new Animated.Value(0));
  const [activeRoute, setActiveRoute] = useState('home');

  const handleRouteChange = (route: string) => {
    setActiveRoute(route);
    switch (route) {
      case 'settings':
        navigation.navigate('Settings');
        break;
      case 'profile':
        navigation.navigate('Profile');
        break;
      case 'menu':
        navigation.openDrawer();
        break;
    }
  };

  // Animate features
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const getFeatures = (): Feature[] => [
    {
      icon: 'gesture-tap',
      label: 'Gesture Detection',
      description: 'Detect and interpret hand gestures in real-time',
      color: theme === 'light' ? '#FF6B6B' :
        theme === 'dark' ? '#ffc300' :
          theme === 'blue' ? '#4ECDC4' :
            '#FF9FB2'
    },
    {
      icon: 'microphone',
      label: 'Voice Commands',
      description: 'Control the app using voice instructions',
      color: theme === 'light' ? '#4ECDC4' :
        theme === 'dark' ? '#4ECDC4' :
          theme === 'blue' ? '#7BDFFF' :
            '#9381FF'
    },
    {
      icon: 'eye-outline',
      label: 'Eye Tracking',
      description: 'Navigate using eye movement detection',
      color: theme === 'light' ? '#FFD166' :
        theme === 'dark' ? '#FFD166' :
          theme === 'blue' ? '#FFD166' :
            '#F8C8DC'
    }
  ];

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: responsiveWidth(5),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
    },
    headerContent: {
      flex: 1,
    },
    welcomeText: {
      fontSize: responsiveFontSize(3.2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginBottom: responsiveHeight(0.5),
    },
    subText: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
    },
    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: responsiveHeight(2),
    },
    featureCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(4),
      marginBottom: responsiveHeight(2),
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    featureIconContainer: {
      width: responsiveWidth(12),
      height: responsiveWidth(12),
      borderRadius: responsiveWidth(6),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: responsiveHeight(1.5),
    },
    featureTitle: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(0.5),
    },
    featureDescription: {
      fontSize: responsiveFontSize(1.4),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      lineHeight: responsiveHeight(2.2),
    },
    quickActionContainer: {
      marginTop: responsiveHeight(3),
    },
    quickActionTitle: {
      fontSize: responsiveFontSize(2),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(2),
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: responsiveHeight(4),
      padding: responsiveHeight(2),
      marginBottom: responsiveHeight(1.5),
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.medium,
      marginLeft: responsiveWidth(2),
    },
    decorationCircle: {
      position: 'absolute',
      borderRadius: responsiveWidth(100),
      width: responsiveWidth(150),
      height: responsiveWidth(150),
      zIndex: -1,
    },
    themeDecorationTop: {
      top: -responsiveHeight(15),
      left: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.03)' :
        theme === 'dark' ? 'rgba(255, 195, 0, 0.05)' :
          theme === 'blue' ? 'rgba(5, 9, 130, 0.08)' :
            'rgba(56, 4, 64, 0.08)',
    },
    themeDecorationBottom: {
      bottom: -responsiveHeight(15),
      right: -responsiveWidth(25),
      backgroundColor: theme === 'light' ? 'rgba(3, 4, 94, 0.02)' :
        theme === 'dark' ? 'rgba(255, 219, 77, 0.03)' :
          theme === 'blue' ? 'rgba(123, 223, 255, 0.04)' :
            'rgba(196, 179, 204, 0.04)',
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.decorationCircle, styles.themeDecorationTop]} />
      <View style={[styles.decorationCircle, styles.themeDecorationBottom]} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.subText}>Choose your preferred interaction method</Text>
          </View>
        </View>

        <View style={styles.featuresGrid}>
          {getFeatures().map((feature, index) => {
            const translateY = animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, index % 2 === 0 ? -5 : 5]
            });

            return (
              <Animated.View
                key={feature.label}
                style={[
                  styles.featureCard,
                  { transform: [{ translateY }] }
                ]}
              >
                <View
                  style={[
                    styles.featureIconContainer,
                    { backgroundColor: feature.color + '20' }
                  ]}
                >
                  <MaterialCommunityIcons
                    name={feature.icon}
                    size={Math.round(responsiveFontSize(3))}
                    color={feature.color}
                  />
                </View>
                <Text style={styles.featureTitle}>{feature.label}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.quickActionContainer}>
          <Text style={styles.quickActionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Detection')}
          >
            <MaterialCommunityIcons
              name="gesture-tap"
              size={Math.round(responsiveFontSize(2.2))}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Start Detection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <MaterialCommunityIcons
              name="cog"
              size={Math.round(responsiveFontSize(2.2))}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BottomNavigation
        activeRoute={activeRoute}
        onRouteChange={handleRouteChange}
      />
    </SafeAreaView>
  );
};