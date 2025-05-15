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
import { spacing, typography } from '../constants/theme';
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
    container: {
      height: Platform.OS === 'ios' ? 44 : 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity:  0.1,
          shadowRadius: 2,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    backButton: {
      position: 'absolute',
      left: spacing.md,
      padding: spacing.sm,
      borderRadius: spacing.sm,
      zIndex: 1,
    },
    backButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40, // Space for back button
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      textAlign: 'center',
    },
    rightComponentContainer: {
      position: 'absolute',
      right: spacing.md,
      zIndex: 1,
    },
  });

  return (
    <View style={styles.safeArea}>
      <View style={[styles.container, containerStyle]}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <View style={styles.backButtonContent}>
              <Ionicons
                name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                size={24}
                color={colors.text}
              />
            </View>
          </TouchableOpacity>
        )}
        
        <View style={styles.titleContainer}>
          <Text 
            style={[styles.title, titleStyle]} 
            numberOfLines={1} 
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>

        {rightComponent && (
          <View style={styles.rightComponentContainer}>
            {rightComponent}
          </View>
        )}
      </View>
    </View>
  );
};
