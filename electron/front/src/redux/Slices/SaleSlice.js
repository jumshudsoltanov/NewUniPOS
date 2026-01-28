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
const SaleSlice = createSlice({
  name: "SaleSlice",
  initialState: {
    newSale: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(saleNewOrders.fulfilled, (state, action) => {
      state.newSale = action.payload;
    });
  },
});

export default SaleSlice.reducer;
