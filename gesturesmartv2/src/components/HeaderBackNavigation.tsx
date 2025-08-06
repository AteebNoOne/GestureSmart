// HeaderNavigation.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import { useNavigation } from '@react-navigation/native';

interface HeaderNavigationProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  titleStyle?: object;
  containerStyle?: object;
}

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  title,
  showBackButton = true,
  onBackPress,
  rightComponent,
  titleStyle,
  containerStyle,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const styles = StyleSheet.create({
    safeArea: {
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: Platform.OS === "ios" ? responsiveHeight(2) : responsiveHeight(4),
      marginBottom: responsiveHeight(3),
    },
    backButton: {
      padding: responsiveWidth(2),
      marginRight: responsiveWidth(2),
    },
    headerContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerText: {
      fontSize: responsiveFontSize(3.2),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    rightComponentContainer: {
      marginLeft: 'auto',
    },
  });

  return (
    <View style={styles.safeArea}>
      <View style={[styles.header, containerStyle]}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        )}

        <View style={styles.headerContent}>
          <Text
            style={[styles.headerText, titleStyle]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>

          {rightComponent && (
            <View style={styles.rightComponentContainer}>
              {rightComponent}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};