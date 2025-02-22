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

interface PrivacyPolicyScreenProps {
  navigation: NavigationProp<any>;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();

  const privacySections = [
    {
      title: 'Data Collection & Processing',
      icon: 'database',
      description: 'We collect minimal data necessary for gesture and voice recognition. All processing happens locally on your device to ensure maximum privacy.',
      color: theme === 'light' ? '#4ECDC4' :
        theme === 'dark' ? '#4ECDC4' :
          theme === 'blue' ? '#7BDFFF' : '#9381FF'
    },
    {
      title: 'Device Permissions',
      icon: 'shield-check',
      description: 'We require sometimes camera, microphone and accesibliity access for gesture and voice features. These permissions are used obviously when app is active and even when app is in background or killed mode.',
      color: theme === 'light' ? '#FFD166' :
        theme === 'dark' ? '#FFD166' :
          theme === 'blue' ? '#FFD166' : '#F8C8DC'
    },
    {
      title: 'Data Storage',
      icon: 'folder-lock',
      description: 'Your preferences and settings are stored locally. No gesture or voice data is permanently stored or transmitted to external servers.',
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
    subTitle: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(5),
      marginBottom: responsiveHeight(2.5),
    },
    sectionCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(4),
      marginBottom: responsiveHeight(2),
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconContainer: {
      width: responsiveWidth(12),
      height: responsiveWidth(12),
      borderRadius: responsiveWidth(6),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: responsiveWidth(4),
    },
    sectionContent: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(0.5),
    },
    sectionText: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      lineHeight: responsiveHeight(2.5),
    },
    policyText: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      lineHeight: responsiveHeight(2.5),
      marginBottom: responsiveHeight(2),
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
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.subTitle}>How we protect your data</Text>
        </View>
      </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>


        <View style={styles.section}>
          <Text style={styles.policyText}>
            At Gesture Smart, we prioritize your privacy and security. This policy outlines how we handle your data and protect your privacy while using our gesture and voice control features.
          </Text>
        </View>

        {privacySections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: section.color + '20' }
              ]}
            >
              <MaterialCommunityIcons
                name={section.icon}
                size={Math.round(responsiveFontSize(3))}
                color={section.color}
              />
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionText}>{section.description}</Text>
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Rights</Text>
          <Text style={styles.sectionText}>
            You have the right to:
            {'\n\n'}• Access your stored preferences and settings
            {'\n'}• Delete all locally stored data
            {'\n'}• Disable any features you're not comfortable with
            {'\n'}• Request information about how your data is used
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Updates to Policy</Text>
          <Text style={styles.sectionText}>
            We may update this privacy policy to reflect changes in our practices or for legal compliance. We'll notify you of any significant changes through the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionText}>
            If you have questions about our privacy practices or would like to exercise your data rights, please contact our support team through the Help & Support section.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};