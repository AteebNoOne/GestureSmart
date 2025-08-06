export interface User {
    _id: string;
    profileImage?: string;
    firstName: string;
    lastName: string;
    email: string;
    gender: 'male' | 'female';
    dateOfBirth: string;
    age: number;
    phone: string;
    location: string;
}

export interface UserState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
}

export interface SignupData {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    gender: 'male' | 'female';
    dateOfBirth: string;
    phone: string;
    location: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface UpdateUserData {
    profileImage?: File;
    firstName?: string;
    lastName?: string;
    gender?: 'male' | 'female';
    dateOfBirth?: string;
    phone?: string;
    location?: string;
}

export interface EmailAvailabilityData {
    email: string;
}