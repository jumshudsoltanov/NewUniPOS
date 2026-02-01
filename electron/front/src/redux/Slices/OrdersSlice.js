import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getTableGroups } from "./TablesSlice";
import { getActiveOrders } from "./BooksSlice";

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

export const updateDiscountOnOrders = createAsyncThunk(
  "pos/discount",
  async ({ orderId, discountValue, discountType }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/discount`,
        { discountValue, discountType },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

export const updateServiceFeeOnOrders = createAsyncThunk(
  "pos/serviceFee",
  async ({ orderId, serviceValue, feeType }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/service-fee`,
        { serviceValue, feeType },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

export const updateTableOrders = createAsyncThunk(
  "orders/updateTable",
  async ({ orderId, newTableId, currentHallId }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/update-table`,
        { newTableId, currentHallId },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateLockChecK = createAsyncThunk(
  "orders/lock-check",
  async ({ orderId, status }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/lock-check`,
        { status },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateTags = createAsyncThunk(
  "orders/check-tags",
  async ({ orderId, tags }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/check-tags`,
        { tags },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateComments = createAsyncThunk(
  "orders/check-comments",
  async ({ orderId, comments }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/check-comments`,
        { comments },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const deleteOrderItems = createAsyncThunk(
  "orders/delete-items",
  async ({ orderId }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/delete-items`,
        {},
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const mergeChecks = createAsyncThunk(
  "orders/merge-check",
  async ({ currentOrderId, newOrderId }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${currentOrderId}/merge-orders`,
        { newOrderId },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const changeSaleType = createAsyncThunk(
  "orders/change-saletype",
  async ({ orderId, saleType, tableId, hallId }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/change-saletype`,
        { saleType, tableId, hallId },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const changeWaiter = createAsyncThunk(
  "orders/waiters",
  async ({ orderId, waiterId }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `http://localhost:55667/api/orders-items/${orderId}/change-saletype`,
        { waiterId },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const OrderSlice = createSlice({
  name: "orders",
  initialState: {
    products: [],
    sentProducts: [],
    menu: [],
    discount: [],
    service: [],
    updateTable: [],
    isLockCheck: {},
    tags: {},
    comments: {},
    deleteItems: {},
    mergeChecs: {},
    changeSaleTypeData: {},
    updateWaiter: {},
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
      const { productId, count, price, name, orderItemId } = action.payload;

      const product = state.products.find((item) => item.id === productId);

      if (product) {
        if (count !== undefined) product.quantity = count;
        if (price !== undefined) product.price = price;
        if (orderItemId !== undefined) product.orderItemId = orderItemId;
      } else {
        if (count !== undefined) {
          state.products.push({
            id: productId,
            orderItemId: orderItemId, // Store the DB record ID
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
      })
      .addCase(getActiveOrders.fulfilled, (state, action) => {
        state.sentProducts = [];
      })
      .addCase(updateDiscountOnOrders.fulfilled, (state, action) => {
        state.discount = action.payload;
      })
      .addCase(updateServiceFeeOnOrders.fulfilled, (state, action) => {
        state.service = action.payload;
      })
      .addCase(updateTableOrders.fulfilled, (state, action) => {
        state.updateTable = action.payload;
      })
      .addCase(updateLockChecK.fulfilled, (state, action) => {
        state.isLockCheck = action.payload;
      })
      .addCase(updateTags.fulfilled, (state, action) => {
        state.tags = action.payload;
      })
      .addCase(updateComments.fulfilled, (state, action) => {
        state.comments = action.payload;
      })
      .addCase(deleteOrderItems.fulfilled, (state, action) => {
        state.products = [];
      })
      .addCase(mergeChecks.fulfilled, (state, action) => {
        state.mergeChecs = action.payload;
      })
      .addCase(changeSaleType.fulfilled, (state, action) => {
        state.changeSaleTypeData = action.payload;
      })
      .addCase(changeWaiter.fulfilled, (state, action) => {
        state.updateWaiter = action.payload;
      });
  },
});

export const { addProducts, sendOrders, clearOrders, menuData, updateCount } =
  OrderSlice.actions;
export default OrderSlice.reducer;
