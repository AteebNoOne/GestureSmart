export type RootStackParamList = {
  Auth: undefined;
  MainApp: undefined;
};

export type AuthStackParamList = {
  Voice: undefined;
  Login: undefined;
  Signup: undefined;
  Detection: undefined;
};

export type MainDrawerParamList = {
  HomeDrawer: undefined;
  Detection: undefined;
  Reports: undefined;
  Profile: undefined;
  Support: undefined;
  Terms: undefined;
  Privacy: undefined;
  Settings: undefined;
  About: undefined;
  EyeTracking: undefined;
  VoiceServiceScreen: undefined;
};

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}