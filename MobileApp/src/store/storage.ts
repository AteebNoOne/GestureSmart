import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
    get: async (key: string): Promise<string | null> => {
        try {
            const value = await AsyncStorage.getItem(key);
            return value;
        } catch (e) {
            console.error('Get error:', e);
            return null;
        }
    },
    set: async (key: string, value: string): Promise<void> => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (e) {
            console.error('Set error:', e);
        }
    },
    getString: async (key: string): Promise<string | null> => {
        return await storage.get(key);
    },
    delete: async (key: string): Promise<void> => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Delete error:', e);
        }
    }
};
