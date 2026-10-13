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
        // PERFORMANS: bu action-lar hər 5–10 saniyədə taymerlə gəlir. Dəyər dəyişməyibsə
        // state-ə TOXUNMURUQ — əks halda Immer yeni obyekt yaradır və bu slice-a abunə olan
        // bütün ekranlar (Pin, Header, Check...) boş yerə yenidən render olunur.
        updateSyncStatus: (state, action) => {
            const pendingCount = action.payload.pendingCount || 0;
            const syncedCount = action.payload.syncedCount || 0;
            const grew = state.lastUpdated && syncedCount > state.totalSyncedCount && state.totalSyncedCount > 0;
            if (!grew && state.pendingCount === pendingCount && state.totalSyncedCount === syncedCount && state.lastSyncedDelta === 0) {
                return;
            }

            // Calculate delta only if we already had a count (avoid showing initial database total as a new sync)
            if (grew) {
                state.lastSyncedDelta = syncedCount - state.totalSyncedCount;
                state.showSyncedBadge = true;
            } else {
                state.lastSyncedDelta = 0;
            }

            state.pendingCount = pendingCount;
            state.totalSyncedCount = syncedCount;
            state.lastUpdated = Date.now();
        },
        resetSyncedBadge: (state) => {
            if (!state.showSyncedBadge && state.lastSyncedDelta === 0) return;
            state.showSyncedBadge = false;
            state.lastSyncedDelta = 0;
        },
        updateConnectivity: (state, action) => {
            const { isOnline, hasInternet } = action.payload;
            if (state.isOnline === isOnline && state.hasInternet === hasInternet) return;
            state.isOnline = isOnline;
            state.hasInternet = hasInternet;
        },
        updateSocketStatus: (state, action) => {
            if (state.isSocketConnected === action.payload) return;
            state.isSocketConnected = action.payload;
        },
    },
});

export const { updateSyncStatus, resetSyncedBadge, updateConnectivity, updateSocketStatus } = syncSlice.actions;
export default syncSlice.reducer;
