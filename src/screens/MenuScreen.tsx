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
  Alert,
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
import { User } from '../types/User';
import { defaultUser } from '../constants/defaultUser';

export interface MenuScreenProps {
  navigation: NavigationProp<any>;
}

interface MenuItem {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  type?: 'danger' | 'normal';
  badge?: string;
  color: string;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();
  const [userData, setUserData] = useState<User>(defaultUser);
  const [animatedValue] = useState(new Animated.Value(0));

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

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: () => navigation.navigate('Auth'),
          style: "destructive"
        }
      ]
    );
  };

  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          profile: '#4ECDC4',
          settings: '#FF6B6B',
          help: '#FFD166',
          about: '#45B7D1',
          privacy: '#4ECDC4',
          logout: '#FF4B4B'
        };
      case 'dark':
        return {
          profile: '#ffc300',
          settings: '#4ECDC4',
          help: '#FFD166',
          about: '#7BDFFF',
          privacy: '#45B7D1',
          logout: '#FF4B4B'
        };
      case 'purple':
        return {
          profile: '#9381FF',
          settings: '#FF9FB2',
          help: '#F8C8DC',
          about: '#B8B8FF',
          privacy: '#9381FF',
          logout: '#FF4B4B'
        };
      case 'blue':
        return {
          profile: '#4ECDC4',
          settings: '#7BDFFF',
          help: '#45B7D1',
          about: '#4ECDC4',
          privacy: '#7BDFFF',
          logout: '#FF4B4B'
        };
      default:
        return {
          profile: '#4ECDC4',
          settings: '#FF6B6B',
          help: '#FFD166',
          about: '#45B7D1',
          privacy: '#4ECDC4',
          logout: '#FF4B4B'
        };
    }
  };

  const themeColors = getThemeColors();

  const menuItems: MenuItem[] = [
    {
      icon: 'account',
      label: 'Profile',
      description: 'Manage your personal information',
      onPress: () => navigation.navigate('Profile'),
      badge: 'New',
      color: themeColors.profile
    },
    {
      icon: 'cog',
      label: 'Settings',
      description: 'Customize app preferences',
      onPress: () => navigation.navigate('Settings'),
      color: themeColors.settings
    },
    {
      icon: 'help-circle',
      label: 'Help & Support',
      description: 'Get assistance and support',
      onPress: () => navigation.navigate('Support'),
      color: themeColors.help
    },
    {
      icon: 'information',
      label: 'About',
      description: 'Learn more about the app',
      onPress: () => navigation.navigate('About'),
      color: themeColors.about
    },
    {
      icon: 'shield-check',
      label: 'Privacy & Terms',
      description: 'Review our policies',
      onPress: () => navigation.navigate('Privacy'),
      color: themeColors.privacy
    },
    {
      icon: 'logout',
      label: 'Logout',
      description: 'Sign out of your account',
      onPress: handleLogout,
      type: 'danger',
      color: themeColors.logout
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
      paddingTop: Platform.OS === 'ios' ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
    },
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(2),
      marginBottom: responsiveHeight(3),
      borderColor: colors.border,
      borderWidth: 1,
    },
    avatar: {
      width: responsiveWidth(15),
      height: responsiveWidth(15),
      borderRadius: responsiveWidth(7.5),
      backgroundColor: themeColors.profile + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: responsiveFontSize(2.5),
      color: themeColors.profile,
      fontFamily: typography.fontFamily.bold,
    },
    profileInfo: {
      marginLeft: responsiveWidth(4),
      flex: 1,
    },
    name: {
      fontSize: responsiveFontSize(2.2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    email: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      marginTop: responsiveHeight(0.5),
    },
    menuGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    menuItem: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(4),
      marginBottom: responsiveHeight(2),
      borderColor: colors.border,
      borderWidth: 1,
    },
    menuItemDanger: {
      backgroundColor: themeColors.logout + '15',
    },
    iconContainer: {
      width: responsiveWidth(12),
      height: responsiveWidth(12),
      borderRadius: responsiveWidth(6),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: responsiveHeight(1.5),
    },
    menuLabel: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.medium,
      color: colors.text,
      marginBottom: responsiveHeight(0.5),
    },
    menuDescription: {
      fontSize: responsiveFontSize(1.4),
      fontFamily: typography.fontFamily.regular,
      color: colors.textSecondary,
      lineHeight: responsiveHeight(2.2),
    },
    badge: {
      position: 'absolute',
      top: responsiveHeight(1),
      right: responsiveWidth(2),
      backgroundColor: themeColors.profile,
      paddingHorizontal: responsiveWidth(2),
      paddingVertical: responsiveHeight(0.3),
      borderRadius: responsiveWidth(4),
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: responsiveFontSize(1.2),
      fontFamily: typography.fontFamily.medium,
    },
    version: {
      textAlign: 'center',
      padding: responsiveHeight(2),
      color: colors.textSecondary,
      fontSize: responsiveFontSize(1.4),
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userData?.firstName?.charAt(0) || "U"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>
                {userData?.firstName || "User"} {userData?.lastName || "Lastname"}
              </Text>
              <Text style={styles.email}>
                {userData?.email || "user@gesturesmart.com"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => {
            const translateY = animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, index % 2 === 0 ? -5 : 5]
            });

            return (
              <Animated.View
                key={item.label}
                style={[
                  styles.menuItem,
                  item.type === 'danger' && styles.menuItemDanger,
                  { transform: [{ translateY }] }
                ]}
              >
                <TouchableOpacity onPress={item.onPress}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: item.color + '20' }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={Math.round(responsiveFontSize(3))}
                      color={item.color}
                    />
                  </View>
                  <Text style={[
                    styles.menuLabel,
                    item.type === 'danger' && { color: item.color }
                  ]}>
                    {item.label}
                  </Text>
                  <Text style={styles.menuDescription}>
                    {item.description}
                  </Text>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <Text style={styles.version}>Version 1.0.0</Text>
    </SafeAreaView>
  );
};