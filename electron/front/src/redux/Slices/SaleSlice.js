import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";

export const getNextOrderId = createAsyncThunk(
  "pos/next-order-id",
  async (profileId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/orders/${profileId}/next-id`);
      return response.data;
    } catch (error) {
      console.error("NextOrderId Error", error);
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

export const saleNewOrders = createAsyncThunk(
  "pos/sales",
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/sale",
        data,
      );
      return response.data;
    } catch (error) {
      console.error("SaleError", error);
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

export const saleNewOtherOrders = createAsyncThunk(
  "pos/otherorderS",
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/other-sale",
        data,
      );
      return response.data;
    } catch (error) {
      console.error("Other Sale Error", error);
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

const SaleSlice = createSlice({
  name: "SaleSlice",
  initialState: {
    newSale: {},
    newOtherSale: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(saleNewOrders.fulfilled, (state, action) => {
        state.newSale = action.payload;
      })
      .addCase(saleNewOtherOrders.fulfilled, (state, action) => {
        state.newOtherSale = action.payload;
      });
  },
});

export default SaleSlice.reducer;


