import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const getActiveOrders = createAsyncThunk(
  "pos/active-orders",
  async ({ profileId, id, sale_type, waiter_id, hall_id, table_id, courier_id }, thunkAPI) => {
    try {
      let url = `http://localhost:55667/api/orders/${profileId}/all-checks`;
      const params = new URLSearchParams();
      if (id) params.append("id", id);
      if (sale_type) params.append("sale_type", sale_type);
      if (waiter_id) params.append("waiter_id", waiter_id);
      if (hall_id) params.append("hall_id", hall_id);
      if (table_id) params.append("table_id", table_id);
      if (courier_id) params.append("courier_id", courier_id);

      const response = await axios.get(url, { params });

      return response.data;
    } catch (error) {
      thunkAPI.rejectWithValue(error?.response.data);
    }
  },
);

export const getArchivedOrders = createAsyncThunk(
  "pos/archived-orders",
  async ({ profileId, type, date, id, sale_type, waiter_id, hall_id, table_id, courier_id }, thunkAPI) => {
    try {
      let url = `http://localhost:55667/api/orders/${profileId}/archived-checks?type=${type}`;
      if (date) url += `&date=${date}`;
      if (id) url += `&id=${id}`;
      if (sale_type) url += `&sale_type=${sale_type}`;
      if (waiter_id) url += `&waiter_id=${waiter_id}`;
      if (hall_id) url += `&hall_id=${hall_id}`;
      if (table_id) url += `&table_id=${table_id}`;
      if (courier_id) url += `&courier_id=${courier_id}`;
      const response = await axios.get(url);

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
    archivedBooks: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    // getActiveOrders
    builder.addCase(getActiveOrders.pending, (state) => {
      state.status = 'loading';
    });
    builder.addCase(getActiveOrders.fulfilled, (state, action) => {
      state.status = 'succeeded';
      state.books = action.payload;
    });
    builder.addCase(getActiveOrders.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    });

    // getArchivedOrders
    builder.addCase(getArchivedOrders.pending, (state) => {
      state.status = 'loading';
    });
    builder.addCase(getArchivedOrders.fulfilled, (state, action) => {
      state.status = 'succeeded';
      state.archivedBooks = action.payload.data || [];
    });
    builder.addCase(getArchivedOrders.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    });

    // Remove from archive when reopened
    builder.addCase("orders/reopen/fulfilled", (state, action) => {
      const reopenedOrderId = action.meta.arg.orderId;
      state.archivedBooks = state.archivedBooks.filter(o => o.uuid !== reopenedOrderId);
    });

    // Handle deleteCheck OR closeOrder fulfilled to remove from books
    builder.addMatcher(
      (action) =>
        action.type === "orders/deleteCheck/fulfilled" ||
        action.type === "orders/close/fulfilled",
      (state, action) => {
        const orderId = action.meta.arg?.orderId;
        if (!orderId) return;

        let ordersList = null;
        if (Array.isArray(state.books)) {
          state.books = state.books.filter(o => o.uuid !== orderId && o.id !== orderId && String(o.uuid) !== String(orderId));
        } else if (state.books && Array.isArray(state.books.data)) {
          state.books.data = state.books.data.filter(o => o.uuid !== orderId && o.id !== orderId && String(o.uuid) !== String(orderId));
        }
      }
    );
    // Listen for giftItem and discount (and sendOrdersItems if applicable)
    builder.addMatcher(
      (action) =>
        action.type === "orders/gift/fulfilled" ||
        action.type === "orders/itemDiscount/fulfilled" ||
        action.type === "pos/orders/fulfilled" ||
        action.type === "orders/lockCheck/fulfilled" ||
        action.type === "orders/lock-check/fulfilled" ||
        action.type === "orders/delete-item/fulfilled",
      (state, action) => {
        const updatedOrder = action.payload?.data || action.payload; // Payload is the full Order object
        if (!updatedOrder || (!updatedOrder.uuid && !updatedOrder.id)) return;

        // Determine where the list is
        let ordersList = null;
        if (Array.isArray(state.books)) {
          ordersList = state.books;
        } else if (state.books && Array.isArray(state.books.data)) {
          ordersList = state.books.data;
        }

        if (ordersList) {
          const targetId = updatedOrder.uuid || updatedOrder.id;
          const index = ordersList.findIndex(
            (o) => o.uuid === targetId || o.id === targetId || String(o.uuid) === String(targetId)
          );
          if (index !== -1) {
            ordersList[index] = { ...ordersList[index], ...updatedOrder };
          }
        }
      },
    );
  },
});

export default BooksSlice.reducer;
