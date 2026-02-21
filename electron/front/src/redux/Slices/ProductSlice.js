import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";
import { menuWithCategories, menuWithGeneralCategories } from "./MenuSlice";

const API_URL = "/products";
const LOCAL_SYNC_URL = "/sync";

export const addProduct = createAsyncThunk(
    "products/add",
    async (productData, { dispatch, rejectWithValue }) => {
        try {
            const response = await axios.post(API_URL, productData);

            if (productData.profile_id) {
                dispatch(menuWithCategories(productData.profile_id));
                dispatch(menuWithGeneralCategories(productData.profile_id));
            }

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
            const response = await axios.put(`${API_URL}/${id}`, productData);

            if (productData.profile_id) {
                dispatch(menuWithCategories(productData.profile_id));
                dispatch(menuWithGeneralCategories(productData.profile_id));
            }

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
            await axios.delete(`${API_URL}/${id}`, {
                data: { profile_id }
            });

            if (profile_id) {
                dispatch(menuWithCategories(profile_id));
                dispatch(menuWithGeneralCategories(profile_id));
            }

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


