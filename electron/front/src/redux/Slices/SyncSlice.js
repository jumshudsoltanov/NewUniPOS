import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    pendingCount: 0,
    totalSyncedCount: 0,
    lastSyncedDelta: 0,
    showSyncedBadge: false,
    isOnline: navigator.onLine,
    hasInternet: true,
    lastUpdated: null,
    isSocketConnected: false,
};

const syncSlice = createSlice({
    name: "sync",
    initialState,
    reducers: {
        updateSyncStatus: (state, action) => {
            const { pendingCount, syncedCount } = action.payload;

            // Calculate delta only if we already had a count (avoid showing initial database total as a new sync)
            if (state.lastUpdated && syncedCount > state.totalSyncedCount && state.totalSyncedCount > 0) {
                state.lastSyncedDelta = syncedCount - state.totalSyncedCount;
                state.showSyncedBadge = true;
            } else {
                state.lastSyncedDelta = 0;
            }

            state.pendingCount = pendingCount || 0;
            state.totalSyncedCount = syncedCount || 0;
            state.lastUpdated = Date.now();
        },
        resetSyncedBadge: (state) => {
            state.showSyncedBadge = false;
            state.lastSyncedDelta = 0;
        },
        updateConnectivity: (state, action) => {
            state.isOnline = action.payload.isOnline;
            state.hasInternet = action.payload.hasInternet;
        },
        updateSocketStatus: (state, action) => {
            state.isSocketConnected = action.payload;
        },
    },
});

export const { updateSyncStatus, resetSyncedBadge, updateConnectivity, updateSocketStatus } = syncSlice.actions;
export default syncSlice.reducer;
