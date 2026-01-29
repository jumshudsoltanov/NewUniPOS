import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getTableGroups } from "./TablesSlice";

export const sendOrdersItems = createAsyncThunk(
  "pos/orders",
  async (payload, thunkAPI) => {
    try {
      const { orderId, profileId, productList, waiterId } = payload;
      const response = await axios.post(
        `http://localhost:55667/api/orders-items/${orderId}/items`,
        { productList: productList, profileId: profileId, waiterId: waiterId },
      );
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
    sentProducts: [],
    menu: [],
  },

  reducers: {
    addProducts: (state, action) => {
      const existingProduct = state.products.find(
        (product) => product.id === action.payload.id,
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
    },

    sendOrders: (state, action) => {
      state.products = action.payload.map((item) => ({
        ...item,
        newOrder: 0,
      }));
    },

    clearOrders: (state, action) => {
      state.products = [];
      state.sentProducts = [];
    },

    updateCount: (state, action) => {
      const { productId, count, price, name } = action.payload;

      const product = state.products.find((item) => item.id === productId);

      if (product) {
        if (count !== undefined) product.quantity = count;
        if (price !== undefined) product.price = price;
      } else {
        if (count !== undefined) {
          state.products.push({
            id: productId,
            name: name || "Məhsul",
            price: price || 0,
            quantity: count,
            newOrder: 1,
            isNew: true,
          });
        }
      }
    },

    menuData: (state, action) => {
      state.menu = action.payload;
    },
  },
  extraReducers: (builders) => {
    builders
      .addCase(sendOrdersItems.fulfilled, (state, action) => {
        state.sentProducts = state.products;
        state.products = [];
      })
      .addCase(getTableGroups.fulfilled, (state, action) => {
        state.sentProducts = [];
      });
  },
});

export const { addProducts, sendOrders, clearOrders, menuData, updateCount } =
  OrderSlice.actions;
export default OrderSlice.reducer;
