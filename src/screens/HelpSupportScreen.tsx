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

interface HelpSupportScreenProps {
  navigation: NavigationProp<any>;
}

export const HelpSupportScreen: React.FC<HelpSupportScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();

  const helpTopics = [
    {
      title: 'Getting Started',
      icon: 'rocket',
      description: 'Learn the basics of gesture and voice interactions',
      color: theme === 'light' ? '#FF6B6B' :
        theme === 'dark' ? '#ffc300' :
        theme === 'blue' ? '#4ECDC4' : '#FF9FB2'
    },
    {
      title: 'Gesture Controls',
      icon: 'gesture-tap',
      description: 'Master hand gesture detection features',
      color: theme === 'light' ? '#4ECDC4' :
        theme === 'dark' ? '#4ECDC4' :
        theme === 'blue' ? '#7BDFFF' : '#9381FF'
    },
    {
      title: 'Voice Commands',
      icon: 'microphone',
      description: 'Learn available voice control options',
      color: theme === 'light' ? '#FFD166' :
        theme === 'dark' ? '#FFD166' :
        theme === 'blue' ? '#FFD166' : '#F8C8DC'
    },
    {
      title: 'Eye Tracking',
      icon: 'eye-outline',
      description: 'Guide to eye movement detection',
      color: theme === 'light' ? '#06D6A0' :
        theme === 'dark' ? '#06D6A0' :
        theme === 'blue' ? '#06D6A0' : '#B8E0D2'
    },
    {
      title: 'Troubleshooting',
      icon: 'help-circle',
      description: 'Solutions to common issues',
      color: theme === 'light' ? '#118AB2' :
        theme === 'dark' ? '#118AB2' :
        theme === 'blue' ? '#118AB2' : '#95B8D1'
    },
    {
      title: 'Contact Support',
      icon: 'headset',
      description: 'Get help from our support team',
      color: theme === 'light' ? '#073B4C' :
        theme === 'dark' ? '#073B4C' :
        theme === 'blue' ? '#073B4C' : '#8B95C9'
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
    topicsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingBottom: responsiveHeight(8),
    },
    topicCard: {
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
    iconContainer: {
      width: responsiveWidth(12),
      height: responsiveWidth(12),
      borderRadius: responsiveWidth(6),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: responsiveHeight(1.5),
    },
    topicTitle: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(0.5),
    },
    topicDescription: {
      fontSize: responsiveFontSize(1.4),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      lineHeight: responsiveHeight(2.2),
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
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.title}>Help & Support</Text>
            <Text style={styles.subTitle}>How can we assist you today?</Text>
          </View>
        </View>

        <View style={styles.topicsGrid}>
          {helpTopics.map((topic, index) => (
            <TouchableOpacity
              key={index}
              style={styles.topicCard}
              onPress={() => {
                console.log(`Selected topic: ${topic.title}`);
                navigation.navigate('HelpTopic', { topic });
              }}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: topic.color + '20' }
                ]}
              >
                <MaterialCommunityIcons
                  name={topic.icon}
                  size={Math.round(responsiveFontSize(3))}
                  color={topic.color}
                />
              </View>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              <Text style={styles.topicDescription}>{topic.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};