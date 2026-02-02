import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const getActiveOrders = createAsyncThunk(
  "pos/active-orders",
  async ({ profileId }, thunkAPI) => {
    try {
      const response = await axios.get(
        `http://localhost:55667/api/orders/${profileId}/all-checks`,
      );

      return response.data;
    } catch (error) {
      thunkAPI.rejectWithValue(error?.response.data);
    }
  },
);

const BooksSlice = createSlice({
  name: "books",
  initialState: {
    books: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getActiveOrders.fulfilled, (state, action) => {
      state.books = action.payload;
    });
    // Listen for giftItem and discount (and sendOrdersItems if applicable)
    builder.addMatcher(
      (action) =>
        action.type === "orders/gift/fulfilled" ||
        action.type === "orders/itemDiscount/fulfilled" ||
        action.type === "pos/orders/fulfilled" ||
        action.type === "orders/lock-check/fulfilled",
      (state, action) => {
        const updatedOrder = action.payload; // Payload is the full Order object
        if (!updatedOrder || !updatedOrder.uuid) return;

        // Determine where the list is
        let ordersList = null;
        if (Array.isArray(state.books)) {
          ordersList = state.books;
        } else if (state.books && Array.isArray(state.books.data)) {
          ordersList = state.books.data;
        }

        if (ordersList) {
          const index = ordersList.findIndex(
            (o) => o.uuid === updatedOrder.uuid,
          );
          if (index !== -1) {
            ordersList[index] = updatedOrder;
          } else {
            // If it's a new order not in list (rare for 'update'), push it?
            // Usually we only update existing.
            // But for 'sendOrdersItems', maybe it's just created?
            ordersList.push(updatedOrder);
          }
        }
      },
    );
  },
});

export default BooksSlice.reducer;
