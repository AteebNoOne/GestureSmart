import React, { useState } from 'react';
import { StatusBar } from "react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { AuthStackParamList, MainDrawerParamList, RootStackParamList } from '../types';
import { ThemeProvider } from '../context/ThemeContex';
import { ThemeType } from '../constants/theme';

// import GestureService from '../screens/GestureServiceScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HelpSupportScreen } from '../screens/HelpSupportScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { TermsConditionsScreen } from '../screens/TermsConditionsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { HomeScreen } from '../screens/HomeScreen';
// import EyeTrackingService from '../screens/EyeTrackingScreen';
import VoiceService from '../screens/VoiceServiceScreen';
import EyeTracking from '../screens/EyeTracking';
import GestureServiceNative from '../screens/GestureServiceScreenNative';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Drawer = createDrawerNavigator<MainDrawerParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    {/* <AuthStack.Screen name="Login" component={FingerTrackingScreen} /> */}

    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Signup" component={SignupScreen} />
    <AuthStack.Screen name="Detection" component={GestureServiceNative} />
  </AuthStack.Navigator>
);

// Drawer navigator component
const DrawerNavigator = () => (
  <Drawer.Navigator
    initialRouteName="HomeDrawer"
    screenOptions={{
      headerShown: false,
      drawerStyle: {
        width: '80%',
      },
    }}
    drawerContent={(props: DrawerContentComponentProps) => <MenuScreen {...props} />}
  >
    <Drawer.Screen
      name="HomeDrawer"
      component={HomeScreen}
      options={{ title: 'Home' }}
    />

    <Drawer.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'ProfileScreen' }}
    />
    <Drawer.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ title: 'SettingsScreen' }}
    />
    <Drawer.Screen
      name="Support"
      component={HelpSupportScreen}
      options={{ title: 'HelpSupportScreen' }}
    />
    <Drawer.Screen
      name="About"
      component={AboutScreen}
      options={{ title: 'AboutScreen' }}
    />
    <Drawer.Screen
      name="Terms"
      component={TermsConditionsScreen}
      options={{ title: 'TermsConditionsScreen' }}
    />

    <Drawer.Screen
      name="Privacy"
      component={PrivacyPolicyScreen}
      options={{ title: 'PrivacyPolicyScreen' }}
    />
    {/* <Drawer.Screen
      name="EyeTracking"
      component={EyeTrackingService}
      options={{ title: 'EyeTrackingScreen' }}
    /> */}
    <Drawer.Screen
      name="EyeTracking"
      component={EyeTracking}
      options={{ title: 'EyeTrackingScreen' }}
    />
    <Drawer.Screen
      name="VoiceServiceScreen"
      component={() => <VoiceService apiKey='77955c73bf114d379a9047c6525e0d58' />}
      options={{ title: 'VoiceServiceScreen' }}
    />



  </Drawer.Navigator>
);


export default function Navigation() {
  const [theme, setTheme] = useState<ThemeType>('light');
  const statusBarHeight = StatusBar.currentHeight || 0;

  return (
    <SafeAreaProvider style={{ marginTop: statusBarHeight }}>
      <ExpoStatusBar backgroundColor='transparent' />
      <ThemeProvider initialTheme={theme}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Auth"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Auth" component={AuthNavigator} />
            <Stack.Screen name="MainApp" component={DrawerNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}