import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storage } from './storage';

// Types
interface DetectionResult {
  type: string;
  probability: number;
  severity: 'Low' | 'Moderate' | 'High';
  location: string;
}

interface Scan {
  id: string;
  scanType: 'MRI' | 'CT';
  imageUrl: string;
  uploadedAt: string;
  results?: DetectionResult[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface User {
  email: string;
  name: string;
  scans: { [key: string]: Scan };
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
    setUser: (state, action: PayloadAction<{ email: string; name: string }>) => {
      state.email = action.payload.email;
      state.name = action.payload.name;
      storage.set('user', JSON.stringify(state));
    },
    logoutUser: (state) => {
      state.email = '';
      state.name = '';
      state.scans = {};
      storage.delete('user');
    },
    updatePreferences: (state, action: PayloadAction<Partial<User['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
      storage.set('user', JSON.stringify(state));
    },
    addScan: (state, action: PayloadAction<Scan>) => {
      state.scans[action.payload.id] = action.payload;
      storage.set('user', JSON.stringify(state));
    },
    updateScanResults: (state, action: PayloadAction<{ scanId: string; results: DetectionResult[] }>) => {
      if (state.scans[action.payload.scanId]) {
        state.scans[action.payload.scanId].results = action.payload.results;
        state.scans[action.payload.scanId].status = 'completed';
        storage.set('user', JSON.stringify(state));
      }
    },
    updateScanStatus: (state, action: PayloadAction<{ scanId: string; status: Scan['status'] }>) => {
      if (state.scans[action.payload.scanId]) {
        state.scans[action.payload.scanId].status = action.payload.status;
        storage.set('user', JSON.stringify(state));
      }
    },
    deleteScan: (state, action: PayloadAction<string>) => {
      delete state.scans[action.payload];
      storage.set('user', JSON.stringify(state));
    }
  }
});

export const {
  setUser,
  logoutUser,
  updatePreferences,
  addScan,
  updateScanResults,
  updateScanStatus,
  deleteScan
} = userSlice.actions;

export const userReducer = userSlice.reducer;

// Selectors
export const selectUser = (state: { user: User }) => state.user;
export const selectScans = (state: { user: User }) => state.user.scans;
export const selectScanById = (state: { user: User }, scanId: string) => state.user.scans[scanId];
export const selectPreferences = (state: { user: User }) => state.user.preferences;