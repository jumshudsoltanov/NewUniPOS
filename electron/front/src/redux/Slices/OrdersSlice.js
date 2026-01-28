import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const sendOrdersItems = createAsyncThunk(
  "pos/orders",
  async (payload, thunkAPI) => {
    try {
      const { orderId, profileId, productList, waiterId } = payload;
      const response = await axios.post(
        `http://localhost:55667/api/orders-items/${orderId}/items`,
        { productList: productList, profileId: profileId, waiterId: waiterId },
      );
      console.log(response.data);
      return response.data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data || "Server error");
    }
  },
);

export const OrderSlice = createSlice({
  name: "orders",
  initialState: {
    products: [],
  },

  reducers: {
    addProducts: (state, action) => {
      const existingProduct = state.products.find(
        (product) => product.name === action.payload.name,
      );

      let oldQuantity = 0;
      let newQuantity = 1;

      if (existingProduct) {
        oldQuantity = existingProduct.quantity;
        existingProduct.quantity += 1;
        existingProduct.newOrder = (existingProduct.newOrder || 0) + 1;
        newQuantity = existingProduct.quantity;
      } else {
        state.products.push({ ...action.payload, quantity: 1, newOrder: 1 });
        oldQuantity = 0;
        newQuantity = 1;
      }

      console.log(`Eski Miktar: ${oldQuantity} - Yeni Miktar: ${newQuantity}`);
    },

    sendOrders: (state, action) => {
      state.products = action.payload.map((item) => ({
        ...item,
        newOrder: 0,
      }));
    },

    clearOrders: (state, action) => {
      state.products = [];
    },
  },
  // extraReducers: (builders) => {
  //   builders.addCase(sendOrdersItems.fulfilled, (state, action) => {
  //     state.products = action.payload;
  //   });
  // },
});

export const { addProducts, sendOrders, clearOrders } = OrderSlice.actions;
export default OrderSlice.reducer;
