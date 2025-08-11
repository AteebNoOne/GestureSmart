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

interface TermsConditionsScreenProps {
  navigation: NavigationProp<any>;
}

export const TermsConditionsScreen: React.FC<TermsConditionsScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();

  const termsSections: Array<{
    title: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    description: string;
    color: string;
  }> = [
      {
        title: 'App Usage & Features',
        icon: 'gesture-tap',
        description: 'Our app uses gesture and voice recognition technology to provide hands-free control. Users must be at least 13 years old to use the app and agree to use these features responsibly.',
        color: theme === 'light' ? '#4ECDC4' :
          theme === 'dark' ? '#4ECDC4' :
            theme === 'blue' ? '#7BDFFF' : '#9381FF'
      },
      {
        title: 'User Responsibilities',
        icon: 'account-check',
        description: 'You agree to use the app\'s gesture and voice features appropriately and not interfere with device security features. Users are responsible for maintaining the security of their device and app access.',
        color: theme === 'light' ? '#FFD166' :
          theme === 'dark' ? '#FFD166' :
            theme === 'blue' ? '#FFD166' : '#F8C8DC'
      },
      {
        title: 'Service Limitations',
        icon: 'information',
        description: 'While we strive for accuracy, gesture and voice recognition may not be 100% accurate. The app is provided "as is" without warranties of any kind, either express or implied.',
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
    termsText: {
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
          <Text style={styles.title}>Terms & Conditions</Text>
          <Text style={styles.subTitle}>Please read carefully</Text>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.termsText}>
            Welcome to Gesture Smart. By using our app, you agree to these terms and conditions which govern your use of our gesture and voice control features.
          </Text>
        </View>

        {termsSections.map((section, index) => (
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
          <Text style={styles.sectionTitle}>Intellectual Property</Text>
          <Text style={styles.sectionText}>
            All content, features, and functionality of the app, including but not limited to gesture recognition algorithms and voice processing systems, are the exclusive property of Gesture Smart and are protected by international copyright and intellectual property laws.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Termination</Text>
          <Text style={styles.sectionText}>
            We reserve the right to terminate or suspend access to our services immediately, without prior notice, for any violation of these Terms. All provisions of the Terms which by their nature should survive termination shall survive.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes to Terms</Text>
          <Text style={styles.sectionText}>
            We may revise these terms at any time by updating this page. By continuing to use the app after such changes, you agree to be bound by the updated terms.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};