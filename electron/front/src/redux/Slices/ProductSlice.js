import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { menuWithCategories, menuWithGeneralCategories } from "./MenuSlice";

const API_URL = "https://api.unipos.tech/api/products";
const LOCAL_SYNC_URL = "http://localhost:55667/api/sync";

export const addProduct = createAsyncThunk(
    "products/add",
    async (productData, { dispatch, rejectWithValue }) => {
        try {
            // 1. Create on Cloud (Fastest possible wait)
            const response = await axios.post(API_URL, productData);

            // 2. Sync and Refresh in Background (Non-blocking)
            axios.post(LOCAL_SYNC_URL).then(() => {
                if (productData.profile_id) {
                    dispatch(menuWithCategories(productData.profile_id));
                    dispatch(menuWithGeneralCategories(productData.profile_id));
                }
            }).catch(err => console.error("Background sync error:", err));

            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateProduct = createAsyncThunk(
    "products/update",
    async ({ id, productData }, { dispatch, rejectWithValue }) => {
        try {
            // 1. Update on Cloud
            const response = await axios.put(`${API_URL}/${id}`, productData);

            // 2. Sync and Refresh in Background
            axios.post(LOCAL_SYNC_URL).then(() => {
                if (productData.profile_id) {
                    dispatch(menuWithCategories(productData.profile_id));
                    dispatch(menuWithGeneralCategories(productData.profile_id));
                }
            }).catch(err => console.error("Background sync error:", err));

            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const deleteProduct = createAsyncThunk(
    "products/delete",
    async ({ id, profile_id }, { dispatch, rejectWithValue }) => {
        try {
            // 1. Delete on Cloud
            await axios.delete(`${API_URL}/${id}`);

            // 2. Sync and Refresh in Background
            axios.post(LOCAL_SYNC_URL).then(() => {
                if (profile_id) {
                    dispatch(menuWithCategories(profile_id));
                    dispatch(menuWithGeneralCategories(profile_id));
                }
            }).catch(err => console.error("Background sync error:", err));

            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const ProductSlice = createSlice({
    name: "products",
    initialState: {
        status: "idle",
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(addProduct.pending, (state) => { state.status = "loading"; })
            .addCase(addProduct.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(addProduct.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })
            .addCase(updateProduct.pending, (state) => { state.status = "loading"; })
            .addCase(updateProduct.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(updateProduct.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })
            .addCase(deleteProduct.pending, (state) => { state.status = "loading"; })
            .addCase(deleteProduct.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(deleteProduct.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            });
    },
});

export default ProductSlice.reducer;
