// store.ts (or whatever your store configuration file is named)
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './reducers'; // Default export, no curly braces

export const store = configureStore({
  reducer: {
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: [
          'user/signup/pending',
          'user/signup/fulfilled',
          'user/login/pending',
          'user/login/fulfilled',
          'user/update/pending',
          'user/update/fulfilled',
        ],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['payload.profileImage'],
        // Ignore these paths in the state
        ignoredPaths: ['user.profileImage'],
      },
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;