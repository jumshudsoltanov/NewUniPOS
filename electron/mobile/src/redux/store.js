import { configureStore } from '@reduxjs/toolkit';
import LoginSlice from './Slices/LoginSlice';

export const store = configureStore({
    reducer: {
        LoginSlice: LoginSlice,
    },
});
