import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const saleNewOrders = createAsyncThunk("pos/sales", async (data) => {
  try {
    const response = await axios.post("http://localhost:55667/api/sale", data);
    return response.data;
  } catch (error) {
    console.error("SaleError", error);
  }
});

export const saleNewOtherOrders = createAsyncThunk(
  "pos/otherorderS",
  async (data) => {
    try {
      const response = await axios.post(
        "http://localhost:55667/api/other-sale",
        data,
      );
      return response.data;
    } catch (error) {
      console.error("Other Sale Error", error);
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
    builder.addCase(saleNewOrders.fulfilled, (state, action) => {
      state.newSale = action.payload;
    }).addCase(saleNewOtherOrders.fulfilled, (state, action) => {
      state.newOtherSale = action.payload
    });
  },
});

export default SaleSlice.reducer;
