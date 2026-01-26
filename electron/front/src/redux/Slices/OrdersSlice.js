import { createSlice } from "@reduxjs/toolkit";

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

    clearNewOrders: (state, action) => {
      let isNewOrders = action.payload.filter((item) => item.newOrder !== 0);
      console.log(isNewOrders);
    },
  },
});

export const { addProducts, sendOrders, clearNewOrders } = OrderSlice.actions;
export default OrderSlice.reducer;
