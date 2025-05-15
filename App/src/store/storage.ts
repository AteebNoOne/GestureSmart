export const storage = {
    get: (key: string): string | null => {
        const value = localStorage.getItem(key);
        return value;
    },
    set: (key: string, value: string): void => {
        localStorage.setItem(key, value);
    },
    getString: (key: string): string | null => {
        return storage.get(key);
    },
    delete: (key: string): void => {                
        localStorage.removeItem(key);
    }
}