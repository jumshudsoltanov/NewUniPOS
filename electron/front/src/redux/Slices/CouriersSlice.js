import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import apiConfig from "../../utils/apiConfig";

const API_URLS = [
    "http://46.224.8.157:35627/api",
    "https://api.unipos.tech/api",
];

export const fetchCouriersFromAdmin = createAsyncThunk(
    "couriers/fetchFromAdmin",
    async (params = {}, thunkAPI) => {
        const state = thunkAPI.getState();
        const profileId = state.LoginSlice?.loginedProfileData?.data?.profile?.id;

        let lastError = null;
        for (const baseUrl of API_URLS) {
            try {
                const response = await axios.get(`${baseUrl}/couriers`, {
                    params: {
                        profile_id: profileId,
                        page: params.page || 1,
                        limit: params.limit || 100,
                        search: params.search || "",
                    },
                    timeout: 5000,
                });

                const payload = response.data;
                let couriers = [];

                if (Array.isArray(payload?.data)) {
                    couriers = payload.data;
                } else if (payload?.data?.data && Array.isArray(payload.data.data)) {
                    couriers = payload.data.data;
                } else if (Array.isArray(payload?.items)) {
                    couriers = payload.items;
                } else if (Array.isArray(payload)) {
                    couriers = payload;
                }

                return { couriers };
            } catch (error) {
                lastError = error;
            }
        }

        return thunkAPI.rejectWithValue(
            lastError?.response?.data?.error || lastError?.message || "Xəta baş verdi"
        );
    }
);

export const assignCourierToOrder = createAsyncThunk(
    "orders/assign-courier",
    async ({ orderId, courierId, courierName: _courierName, deliveryFee, waiterName: _passedWaiterName }, thunkAPI) => {
        try {
            const response = await apiConfig.patch(
                `/orders-items/${orderId}/assign-courier`,
                { courier_id: courierId, delivery_fee: deliveryFee },
            );
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response?.data);
        }
    },
);

const CouriersSlice = createSlice({
    name: "couriers",
    initialState: {
        couriers: [],
        status: "idle",
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCouriersFromAdmin.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchCouriersFromAdmin.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.couriers = action.payload?.couriers || [];
            })
            .addCase(fetchCouriersFromAdmin.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            });
    },
});

export default CouriersSlice.reducer;
