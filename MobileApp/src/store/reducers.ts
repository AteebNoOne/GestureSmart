import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { storage } from './storage';
import { EmailAvailabilityData, LoginData, SignupData, UpdateUserData, User, UserState } from '../types/User';
import userApi from '../api/user';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER: 'user_data',
};

// Storage helper functions
const saveToken = async (token: string) => {
  await storage.set(STORAGE_KEYS.TOKEN, token);
};

const saveUser = async (user: User) => {
  await storage.set(STORAGE_KEYS.USER, JSON.stringify(user));
};

const clearAuthData = async () => {
  await storage.delete(STORAGE_KEYS.TOKEN);
  await storage.delete(STORAGE_KEYS.USER);
};

// Initial state
const initialState: UserState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  isInitialized: false,
};

// Initialize app - load stored auth data
export const initializeAuth = createAsyncThunk(
  'user/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const token = await storage.getString(STORAGE_KEYS.TOKEN);
      const userString = await storage.getString(STORAGE_KEYS.USER);

      let user = null;
      if (userString) {
        try {
          user = JSON.parse(userString);
        } catch {
          // Invalid user data, clear it
          await storage.delete(STORAGE_KEYS.USER);
        }
      }

      return {
        token,
        user,
        isAuthenticated: !!token,
      };
    } catch (error) {
      return rejectWithValue('Failed to initialize auth');
    }
  }
);

// Async thunks using userApi
export const signupUser = createAsyncThunk(
  'user/signup',
  async (userData: SignupData, { rejectWithValue }) => {
    try {
      const response = await userApi.signup(userData);

      // Store token and user data
      await saveToken(response.token);
      await saveUser(response.user);

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Signup failed');
    }
  }
);

export const loginUser = createAsyncThunk(
  'user/login',
  async (credentials: LoginData, { rejectWithValue }) => {
    try {
      const response = await userApi.login(credentials);

      // Store token and user data
      await saveToken(response.token);
      await saveUser(response.user);

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const getUserProfile = createAsyncThunk(
  'user/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await userApi.getProfile();

      // Update stored user data
      await saveUser(response.user);

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch profile');
    }
  }
);

export const updateUser = createAsyncThunk(
  'user/update',
  async (updateData: UpdateUserData, { rejectWithValue }) => {
    try {
      // Extract profile image if present
      const { profileImage, ...userData } = updateData;

      const response = await userApi.updateProfile(userData, profileImage as File | Blob);

      // Update stored user data
      await saveUser(response.user);

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update profile');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'user/delete',
  async (_, { rejectWithValue }) => {
    try {
      await userApi.deleteAccount();

      // Clear stored data
      await clearAuthData();

      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete account');
    }
  }
);

export const checkEmailAvailability = createAsyncThunk(
  'user/checkEmailAvailability',
  async (emailData: EmailAvailabilityData, { rejectWithValue }) => {
    try {
      const response = await userApi.checkEmailAvailability(emailData.email);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to check email availability');
    }
  }
);

// New logout thunk using userApi
export const logoutUser = createAsyncThunk(
  'user/logout',
  async (_, { rejectWithValue }) => {
    try {
      await userApi.logout();
      await clearAuthData();
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

// Slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      // Clear storage asynchronously (fire and forget)
      clearAuthData().catch(console.error);
    },
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      // Save to storage asynchronously (fire and forget)
      saveUser(action.payload).catch(console.error);
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      // Save to storage asynchronously (fire and forget)
      saveToken(action.payload).catch(console.error);
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Auth
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.isInitialized = true;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.isInitialized = true;
      })

      // Signup
      .addCase(signupUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Get Profile
      .addCase(getUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(getUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Update User
      .addCase(updateUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Logout User (async thunk)
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Check Email Availability
      .addCase(checkEmailAvailability.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkEmailAvailability.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(checkEmailAvailability.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { logout, clearError, setUser, setToken } = userSlice.actions;
export default userSlice.reducer;