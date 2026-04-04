import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const ADMIN_API = "https://api.unipos.tech/api";
const ADMIN_API_FALLBACK = "http://46.224.8.157:35627/api";

const apiGet = (path, config) =>
    axios.get(`${ADMIN_API}${path}`, config).catch(() =>
        axios.get(`${ADMIN_API_FALLBACK}${path}`, config)
    );

const apiPost = (path, data, config) =>
    axios.post(`${ADMIN_API}${path}`, data, config).catch(() =>
        axios.post(`${ADMIN_API_FALLBACK}${path}`, data, config)
    );

const apiPut = (path, data, config) =>
    axios.put(`${ADMIN_API}${path}`, data, config).catch(() =>
        axios.put(`${ADMIN_API_FALLBACK}${path}`, data, config)
    );

// Fetch customers from admin API
export const fetchCustomersFromAdmin = createAsyncThunk(
    "customers/fetchFromAdmin",
    async (params = {}, thunkAPI) => {
        try {
            const state = thunkAPI.getState();
            const profileId = state.LoginSlice?.loginedProfileData?.data?.profile?.id;

            const response = await apiGet("/customers", {
                params: {
                    profile_id: profileId,
                    page: params.page || 1,
                    limit: params.limit || 100,
                    search: params.search || "",
                },
                timeout: 5000,
            });
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.error || error.message || "Xəta baş verdi"
            );
        }
    }
);

// Fetch customer groups from admin API
export const fetchCustomerGroupsFromAdmin = createAsyncThunk(
    "customers/fetchGroupsFromAdmin",
    async (_, thunkAPI) => {
        try {
            const state = thunkAPI.getState();
            const profileId = state.LoginSlice?.loginedProfileData?.data?.profile?.id;

            const response = await apiGet("/customer-groups", {
                params: { profile_id: profileId, limit: 100 },
                timeout: 5000,
            });
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.error || error.message || "Xəta baş verdi"
            );
        }
    }
);

// Create customer via admin API
export const createCustomerViaAdmin = createAsyncThunk(
    "customers/createViaAdmin",
    async (customerData, thunkAPI) => {
        try {
            const state = thunkAPI.getState();
            const profileId = state.LoginSlice?.loginedProfileData?.data?.profile?.id;

            const response = await apiPost("/customers", {
                ...customerData,
                profile_id: profileId,
            }, { timeout: 5000 });

            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.error || error.message || "Xəta baş verdi"
            );
        }
    }
);

// Update customer via admin API
export const updateCustomerViaAdmin = createAsyncThunk(
    "customers/updateViaAdmin",
    async ({ id, customerData }, thunkAPI) => {
        try {
            const state = thunkAPI.getState();
            const profileId = state.LoginSlice?.loginedProfileData?.data?.profile?.id;

            const response = await apiPut(`/customers/${id}`, {
                ...customerData,
                profile_id: profileId,
            }, { timeout: 5000 });

            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.error || error.message || "Xəta baş verdi"
            );
        }
    }
);

const CustomersSlice = createSlice({
    name: "customers",
    initialState: {
        customers: [],
        customerGroups: [],
        isOnline: false,
        loading: false,
        groupsLoading: false,
        createLoading: false,
        error: null,
        totalPages: 1,
        currentPage: 1,
    },
    reducers: {
        setOnlineStatus: (state, action) => {
            state.isOnline = action.payload;
        },
        clearCustomersError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // Fetch customers
        builder
            .addCase(fetchCustomersFromAdmin.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCustomersFromAdmin.fulfilled, (state, action) => {
                state.loading = false;
                state.customers = action.payload.items || [];
                state.totalPages = action.payload.totalPages || 1;
                state.currentPage = action.payload.currentPage || 1;
                state.isOnline = true;
            })
            .addCase(fetchCustomersFromAdmin.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.isOnline = false;
            });

        // Fetch groups
        builder
            .addCase(fetchCustomerGroupsFromAdmin.pending, (state) => {
                state.groupsLoading = true;
            })
            .addCase(fetchCustomerGroupsFromAdmin.fulfilled, (state, action) => {
                state.groupsLoading = false;
                state.customerGroups = action.payload.items || [];
                state.isOnline = true;
            })
            .addCase(fetchCustomerGroupsFromAdmin.rejected, (state, action) => {
                state.groupsLoading = false;
            });

        // Create customer
        builder
            .addCase(createCustomerViaAdmin.pending, (state) => {
                state.createLoading = true;
                state.error = null;
            })
            .addCase(createCustomerViaAdmin.fulfilled, (state, action) => {
                state.createLoading = false;
                // Backend returns created customer directly (not wrapped in .data)
                const newCustomer = action.payload;
                if (newCustomer && newCustomer.id) {
                    state.customers = [newCustomer, ...state.customers];
                }
            })
            .addCase(createCustomerViaAdmin.rejected, (state, action) => {
                state.createLoading = false;
                state.error = action.payload;
            });

        // Update customer
        builder
            .addCase(updateCustomerViaAdmin.pending, (state) => {
                state.createLoading = true;
                state.error = null;
            })
            .addCase(updateCustomerViaAdmin.fulfilled, (state, action) => {
                state.createLoading = false;
                const updated = action.payload;
                if (updated && updated.id) {
                    const idx = state.customers.findIndex(c => c.id === updated.id);
                    if (idx !== -1) {
                        state.customers[idx] = updated;
                    }
                }
            })
            .addCase(updateCustomerViaAdmin.rejected, (state, action) => {
                state.createLoading = false;
                state.error = action.payload;
            });
    },
});

export const { setOnlineStatus, clearCustomersError } = CustomersSlice.actions;
export default CustomersSlice.reducer;
