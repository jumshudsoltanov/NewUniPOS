import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";

export const getSalesTypes = createAsyncThunk(
    "salesTypes/getSalesTypes",
    async (profileId, thunkAPI) => {
        try {
            const response = await axios.get(
                `/sale-types/${profileId}`,
            );
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response?.data);
        }
    },
);

const SalesTypesSlice = createSlice({
    name: "salesTypes",
    initialState: {
        salesTypes: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(getSalesTypes.pending, (state) => {
                state.loading = true;
            })
            .addCase(getSalesTypes.fulfilled, (state, action) => {
                state.loading = false;
                state.salesTypes = action.payload.data;
            })
            .addCase(getSalesTypes.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export default SalesTypesSlice.reducer;


