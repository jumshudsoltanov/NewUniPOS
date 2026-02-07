import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const getPaymentMethods = createAsyncThunk(
    "paymentMethods/getPaymentMethods",
    async (profileId, thunkAPI) => {
        try {
            const response = await axios.get(
                `http://localhost:55667/api/payment-methods/${profileId}/list`,
            );
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response.data);
        }
    },
);

const PaymentMethodsSlice = createSlice({
    name: "paymentMethods",
    initialState: {
        paymentMethods: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(getPaymentMethods.pending, (state) => {
                state.loading = true;
            })
            .addCase(getPaymentMethods.fulfilled, (state, action) => {
                state.loading = false;
                state.paymentMethods = action.payload.data;
            })
            .addCase(getPaymentMethods.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export default PaymentMethodsSlice.reducer;
