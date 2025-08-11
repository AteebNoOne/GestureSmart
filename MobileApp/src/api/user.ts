import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '.';
import { LoginData, SignupData, User } from '../types/User';

// Base URL should already be defined in your app
const API_URL = API_BASE_URL



export interface AuthResponse {
    success: boolean;
    message?: string;
    token: string;
    user: User;
}

export interface UserResponse {
    success: boolean;
    user: User;
}

export interface ApiResponse {
    success: boolean;
    message: string;
}

export interface EmailAvailabilityResponse {
    success: boolean;
    available: boolean;
}

// Helper function to get auth token
const getAuthToken = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem('authToken');
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
};

// API functions
export const userApi = {
    /**
     * Register a new user
     */
    signup: async (userData: SignupData): Promise<AuthResponse> => {
        try {
            const response = await axios.post<AuthResponse>(`${API_URL}/auth/signup`, userData);
            // Store token for future authenticated requests
            if (response.data.token) {
                await AsyncStorage.setItem('authToken', response.data.token);
            }
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw error.response.data;
            }
            throw error;
        }
    },

    /**
     * Login with email and password
     */
    login: async (credentials: LoginData): Promise<AuthResponse> => {
        try {
            const response = await axios.post<AuthResponse>(`${API_URL}/auth/login`, credentials);
            // Store token for future authenticated requests
            if (response.data.token) {
                await AsyncStorage.setItem('authToken', response.data.token);
            }
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw error.response.data;
            }
            throw error;
        }
    },

    /**
     * Get the current user's profile
     */
    getProfile: async (): Promise<UserResponse> => {
        try {
            const token = await getAuthToken();
            const response = await axios.get<UserResponse>(`${API_URL}/user`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw error.response.data;
            }
            throw error;
        }
    },

    /**
     * Update user profile
     * @param userData - Partial user data to update
     * @param profileImage - Optional profile image file
     */
    updateProfile: async (
        userData: Partial<Omit<SignupData, 'email' | 'password'>>,
        profileImage?: File | Blob
    ): Promise<UserResponse> => {
        try {
            const token = await getAuthToken();
            const formData = new FormData();

            // Add user data to form
            Object.entries(userData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    let appendValue: string | Blob | Date;
                    if (value instanceof Date) {
                        appendValue = value.toISOString();
                    } else {
                        appendValue = String(value);
                    }
                    formData.append(key, appendValue);
                }
            });

            // Add profile image if provided
            if (profileImage) {
                formData.append('profileImage', profileImage);
            }

            const response = await axios.put<UserResponse>(`${API_URL}/user`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw error.response.data;
            }
            throw error;
        }
    },

    /**
     * Delete user account
     */
    deleteAccount: async (): Promise<ApiResponse> => {
        try {
            const token = await getAuthToken();
            const response = await axios.delete<ApiResponse>(`${API_URL}/user`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Clear stored auth token after account deletion
            await AsyncStorage.removeItem('authToken');

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw error.response.data;
            }
            throw error;
        }
    },

    /**
     * Check if an email is available (not already registered)
     */
    checkEmailAvailability: async (email: string): Promise<EmailAvailabilityResponse> => {
        try {
            const response = await axios.post<EmailAvailabilityResponse>(
                `${API_URL}/emailAvailiblity`,
                { email }
            );
            console.log("here", response.data)
            return response.data;
        } catch (error) {

            if (axios.isAxiosError(error) && error.response) {
                throw error.response.data;
            }
            throw error;
        }
    },

    /**
     * Logout user (client-side only)
     */
    logout: async (): Promise<void> => {
        try {
            await AsyncStorage.removeItem('authToken');
        } catch (error) {
            console.error('Error during logout:', error);
            throw error;
        }
    }
};

export default userApi;