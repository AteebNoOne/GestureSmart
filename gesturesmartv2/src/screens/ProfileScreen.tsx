import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography } from '../constants/theme';
import { NavigationProp } from '@react-navigation/native';
import { Input } from '../components/Input';
import {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import { User } from '../types/User';
import { formatDate } from '../utils/formatDate';
import DateTimePicker from '@react-native-community/datetimepicker';
import userApi from '../api/user';

interface ProfileScreenProps {
  navigation: NavigationProp<any>;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { theme, colors } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [userData, setUserData] = useState<User>({
    firstName: 'User',
    lastName: 'Lastname',
    email: 'usere@gesturesmart.com',
    dateOfBirth: new Date('1990-01-01'),
    age: 33,
    phone: '+1 234 567 8900',
    location: 'New York, USA',
    createdAt: new Date('2023-01-01'),
    profileImage: ''
  });

  const getData = async () => {
    const response = await userApi.getProfile()
    setUserData({
      ...userData,
      firstName: response.user.firstName,
      lastName: response.user.lastName,
      email: response.user.email,
      dateOfBirth: new Date(response.user.dateOfBirth),
      age: response.user.age,
      phone: response.user.phone,
      location: response.user.location,
      profileImage: response.user.profileImage,
    });
  }


  useEffect(() => {
    getData();
  }, []);

  const handleSave = async () => {
    // Here you would typically make an API call to update the user data
    setIsEditing(false);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setUserData(prev => ({
        ...prev,
        dateOfBirth: selectedDate,
        age: new Date().getFullYear() - selectedDate.getFullYear()
      }));
    }
  };

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
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: responsiveWidth(3),
    },
    title: {
      fontSize: responsiveFontSize(2.5),
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isEditing ? colors.primary : 'transparent',
      paddingHorizontal: responsiveWidth(4),
      paddingVertical: responsiveHeight(1),
      borderRadius: responsiveWidth(5),
      borderWidth: isEditing ? 0 : 1,
      borderColor: colors.primary,
    },
    editButtonText: {
      color: isEditing ? '#FFFFFF' : colors.primary,
      marginLeft: responsiveWidth(2),
      fontFamily: typography.fontFamily.medium,
      fontSize: responsiveFontSize(1.6),
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: responsiveHeight(4),
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: responsiveHeight(2),
    },
    avatar: {
      width: responsiveWidth(30),
      height: responsiveWidth(30),
      borderRadius: responsiveWidth(15),
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: responsiveFontSize(4),
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: responsiveWidth(8),
      height: responsiveWidth(8),
      borderRadius: responsiveWidth(4),
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: responsiveWidth(4),
      padding: responsiveWidth(5),
      marginBottom: responsiveHeight(2),
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: responsiveFontSize(2),
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
      marginBottom: responsiveHeight(2),
    },
    inputContainer: {
      marginBottom: responsiveHeight(2),
    },
    readOnlyContainer: {
      marginBottom: responsiveHeight(1.5),
    },
    label: {
      fontSize: responsiveFontSize(1.6),
      fontFamily: typography.fontFamily.medium,
      color: colors.textSecondary,
      marginBottom: responsiveHeight(0.5),
    },
    value: {
      fontSize: responsiveFontSize(1.8),
      fontFamily: typography.fontFamily.regular,
      color: colors.text,
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      padding: responsiveWidth(4),
      borderRadius: responsiveWidth(2),
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
      {/* Background decorations */}
      <View style={[styles.decorationCircle, styles.themeDecorationTop]} />
      <View style={[styles.decorationCircle, styles.themeDecorationBottom]} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={styles.title}>Profile</Text>
          </View>

          {/* <TouchableOpacity
            style={styles.editButton}
            onPress={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            <MaterialCommunityIcons
              name={isEditing ? "content-save" : "pencil"}
              size={20}
              color={isEditing ? '#FFFFFF' : colors.primary}
            />
            <Text style={styles.editButtonText}>
              {isEditing ? 'Save' : 'Edit'}
            </Text>
          </TouchableOpacity> */}
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userData.firstName.charAt(0)}
              </Text>
            </View>
            {isEditing && (
              <TouchableOpacity style={styles.editAvatarButton}>
                <MaterialCommunityIcons
                  name="camera"
                  size={16}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {isEditing ? (
            <>
              <Input
                type="text"
                label="First Name"
                value={userData.firstName}
                onChangeText={(text: string) => setUserData(prev => ({ ...prev, firstName: text }))}
                variant="filled"
              />
              <Input
                type="text"
                label="Last Name"
                value={userData.lastName}
                onChangeText={(text: string) => setUserData(prev => ({ ...prev, lastName: text }))}
                variant="filled"
              />
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.value}>
                  {formatDate(userData.dateOfBirth)}
                </Text>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>
                  {userData.firstName} {userData.lastName}
                </Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Date of Birth</Text>
                <Text style={styles.value}>
                  {formatDate(userData.dateOfBirth)}
                </Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Age</Text>
                <Text style={styles.value}>{userData.age} years</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          {isEditing ? (
            <>
              <Input
                type="email"
                label="Email"
                value={userData.email}
                onChangeText={(text: string) => setUserData(prev => ({ ...prev, email: text }))}
                variant="filled"
              />
              <Input
                type="tel"
                label="Phone"
                value={userData.phone}
                onChangeText={(text: string) => setUserData(prev => ({ ...prev, phone: text }))}
                variant="filled"
              />
              <Input
                type="text"
                label="Location"
                value={userData.location}
                onChangeText={(text: string) => setUserData(prev => ({ ...prev, location: text }))}
                variant="filled"
              />
            </>
          ) : (
            <>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{userData.email}</Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{userData.phone}</Text>
              </View>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.label}>Location</Text>
                <Text style={styles.value}>{userData.location}</Text>
              </View>
            </>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={userData.dateOfBirth}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};