import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storage } from './storage';

interface User {
  email: string;
  name: string;
  age?: number;
  dateOfBirth?: string;
  gender?: string;
  location?: string;
  phone?: string;
  profileImage?: string | null;
  preferences: {
    notifications: boolean;
    theme: 'light' | 'dark';
    reportFormat: 'detailed' | 'summary';
  };
}


// Initial states
const userInitialState: User = JSON.parse(storage.getString('user') || '{}') || {
  email: '',
  name: '',
  scans: {},
  preferences: {
    notifications: true,
    theme: 'light',
    reportFormat: 'detailed'
  }
};

// User slice
const userSlice = createSlice({
  name: 'user',
  initialState: userInitialState,
  reducers: {
    setUser: (state:any, action: PayloadAction<Partial<User>>) => {
      const {
        email,
        name,
        age,
        dateOfBirth,
        gender,
        location,
        phone,
        profileImage
      } = action.payload;
    
      state.email = email ?? state.email;
      state.name = name ?? state.name;
      state.age = age;
      state.dateOfBirth = dateOfBirth;
      state.gender = gender;
      state.location = location;
      state.phone = phone;
      state.profileImage = profileImage;
      
      storage.set('user', JSON.stringify(state));
    },    
    logoutUser: (state:any) => {
      state.email = '';
      state.name = '';
      state.scans = {};
      storage.delete('user');
    },
    updatePreferences: (state:any, action: PayloadAction<Partial<User['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
      storage.set('user', JSON.stringify(state));
    }
  }
});

export const {
  setUser,
  logoutUser,
  updatePreferences,
} = userSlice.actions;

export const userReducer = userSlice.reducer;

// Selectors
export const selectUser = (state: { user: User }) => state.user;
export const selectPreferences = (state: { user: User }) => state.user.preferences;