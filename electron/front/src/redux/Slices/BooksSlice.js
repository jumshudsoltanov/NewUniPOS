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
    builder.addMatcher(
      (action) => action.type === 'orders/gift/fulfilled',
      (state, action) => {
        if (state.books && state.books.data) {
          const updatedOrder = action.payload;
          const index = state.books.data.findIndex(o => o.uuid === updatedOrder.uuid);
          if (index !== -1) {
            state.books.data[index] = updatedOrder;
          }
        }
      }
    );
  },
});

export default BooksSlice.reducer;
