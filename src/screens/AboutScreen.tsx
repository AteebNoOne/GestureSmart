import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
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

interface AboutScreenProps {
  navigation: NavigationProp<any>;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();

  const features = [
    {
      title: 'Smart Gestures',
      icon: 'gesture-tap',
      description: 'Advanced hand tracking for intuitive device control',
      color: theme === 'light' ? '#4ECDC4' : 
        theme === 'dark' ? '#4ECDC4' : 
        theme === 'blue' ? '#7BDFFF' : '#9381FF'
    },
    {
      title: 'Voice Integration',
      icon: 'microphone',
      description: 'Seamless voice command capabilities',
      color: theme === 'light' ? '#FFD166' : 
        theme === 'dark' ? '#FFD166' : 
        theme === 'blue' ? '#FFD166' : '#F8C8DC'
    },
    {
      title: 'Multi-Device',
      icon: 'devices',
      description: 'Control multiple devices with single gestures',
      color: theme === 'light' ? '#FF6B6B' : 
        theme === 'dark' ? '#ffc300' : 
        theme === 'blue' ? '#4ECDC4' : '#FF9FB2'
    },
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
      alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
      paddingHorizontal: responsiveWidth(2),
    },
    backButton: {
      padding: responsiveWidth(2),
      marginRight: responsiveWidth(2),
    },
    headerContent: {
      flex: 1,
      paddingLeft: responsiveWidth(1),
    },
    title: {
      fontSize: responsiveFontSize(3.2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginBottom: responsiveHeight(0.5),
    },
    appContainer: {
      alignItems: 'center',
      marginVertical: responsiveHeight(4),
    },
    appIconContainer: {
      width: responsiveWidth(25),
      height: responsiveWidth(25),
      borderRadius: responsiveWidth(12.5),
      backgroundColor: theme === 'light' ? '#4ECDC420' : '#4ECDC440',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: responsiveHeight(2),
    },
    appName: {
      fontSize: responsiveFontSize(2.8),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginBottom: responsiveHeight(1),
    },
    version: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      marginBottom: responsiveHeight(2),
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(5),
      marginBottom: responsiveHeight(2.5),
    },
    sectionTitle: {
      fontSize: responsiveFontSize(2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginBottom: responsiveHeight(1),
    },
    sectionText: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      lineHeight: responsiveHeight(2.5),
    },
    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: responsiveHeight(2),
    },
    featureCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(4),
      marginBottom: responsiveHeight(2),
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: responsiveWidth(12),
      height: responsiveWidth(12),
      borderRadius: responsiveWidth(6),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: responsiveWidth(4),
    },
    featureContent: {
      flex: 1,
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
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.decorationCircle, styles.themeDecorationTop]} />
      <View style={[styles.decorationCircle, styles.themeDecorationBottom]} />
      <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons 
              name="arrow-left" 
              size={28} 
              color={colors.text} 
            />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>About</Text>
          </View>
        </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>


        <View style={styles.appContainer}>
          <View style={styles.appIconContainer}>
            <MaterialCommunityIcons 
              name="gesture" 
              size={Math.round(responsiveFontSize(5))}
              color={theme === 'light' ? '#4ECDC4' : '#4ECDC4'}
            />
          </View>
          <Text style={styles.appName}>Gesture Smart</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About the App</Text>
          <Text style={styles.sectionText}>
            Gesture Smart is an innovative application that transforms how you interact with your devices. Using advanced AI and computer vision technology, we enable intuitive control through natural hand gestures and voice commands.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: feature.color + '20' }
                ]}
              >
                <MaterialCommunityIcons
                  name={feature.icon}
                  size={Math.round(responsiveFontSize(3))}
                  color={feature.color}
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <Text style={styles.sectionText}>
            Your privacy is our priority. All gesture and voice processing happens locally on your device, ensuring your interactions remain private and secure. No sensitive data is stored or transmitted without your explicit consent.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};