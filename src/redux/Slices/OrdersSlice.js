import { createSlice } from "@reduxjs/toolkit";

export const OrderSlice = createSlice({
  name: "orders",
  initialState: {
    products: [],
  },

  reducers: {
    addProducts: (state, action) => {
      const product = action.payload;
      const existingProduct = state.products.find(
        (p) => p.name === product.name,
      );

      if (existingProduct) {
        existingProduct.quantity = (existingProduct.quantity || 1) + 1;
      } else {
        state.products.push({ ...product, quantity: 1 });
      }
      
      // state.products.push(actions.payload);
      console.log(JSON.parse(JSON.stringify(state.products)));
    },
  },
});

export const { addProducts } = OrderSlice.actions;
export default OrderSlice.reducer;
