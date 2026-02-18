import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const getTableGroups = createAsyncThunk(
  "tables/getTableGroups",
  async (profileId, thunkAPI) => {
    try {
      const response = await axios.get(
        `http://localhost:55667/api/tables/${profileId}`,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

const TablesSlice = createSlice({
  name: "tables",
  initialState: {
    tableGroups: {},
    currentHallId: null,
    isTableEditMode: false,
    hallOrder: JSON.parse(localStorage.getItem("pos_hall_order") || "[]"),
    tableOrder: JSON.parse(localStorage.getItem("pos_table_orders") || "{}"),
    tableLayouts: JSON.parse(localStorage.getItem("pos_table_layouts") || "{}"),
    tempHallOrder: [],
    tempTableOrder: {},
    tempTableLayouts: {},
  },
  reducers: {
    currentTableList: (state, action) => {
      state.currentHallId = action.payload.hallId;
    },
    startEditMode: (state) => {
      state.isTableEditMode = true;
      state.tempHallOrder = [...state.hallOrder];
      state.tempTableOrder = { ...state.tableOrder };
      state.tempTableLayouts = { ...state.tableLayouts };
    },
    cancelEditMode: (state) => {
      state.isTableEditMode = false;
      state.tempHallOrder = [];
      state.tempTableOrder = {};
    },
    saveEditMode: (state) => {
      state.isTableEditMode = false;
      state.hallOrder = [...state.tempHallOrder];
      state.tableOrder = { ...state.tempTableOrder };
      state.tableLayouts = { ...state.tempTableLayouts };
      localStorage.setItem("pos_hall_order", JSON.stringify(state.hallOrder));
      localStorage.setItem("pos_table_orders", JSON.stringify(state.tableOrder));
      localStorage.setItem("pos_table_layouts", JSON.stringify(state.tableLayouts));
      state.tempHallOrder = [];
      state.tempTableOrder = {};
      state.tempTableLayouts = {};
    },
    setTempHallOrder: (state, action) => {
      state.tempHallOrder = action.payload;
    },
    setTempTableOrder: (state, action) => {
      const { hallId, order } = action.payload;
      state.tempTableOrder[hallId] = order;
    },
    setTempTableLayout: (state, action) => {
      const { hallId, layout } = action.payload;
      // Merge with existing layout for that hall
      state.tempTableLayouts[hallId] = {
        ...(state.tempTableLayouts[hallId] || {}),
        ...layout
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getTableGroups.fulfilled, (state, action) => {
      state.tableGroups = action.payload;
      // Set default hall if not set
      if (!state.currentHallId && action.payload?.data?.length > 0) {
        state.currentHallId = action.payload.data[0].id;
      }
    });

    builder.addMatcher(
      (action) =>
        action.type === "orders/lock-check/fulfilled" ||
        action.type === "orders/gift/fulfilled" ||
        action.type === "orders/itemDiscount/fulfilled" ||
        action.type === "orders/delete-item/fulfilled" ||
        action.type === "orders/updateItemPrice/fulfilled",
      (state, action) => {
        const updatedOrder = action.payload?.data || action.payload;
        if (!updatedOrder || !updatedOrder.uuid) return;

        if (state.tableGroups?.data) {
          state.tableGroups.data.forEach((hall) => {
            hall.tables.forEach((table) => {
              if (table.orders) {
                const index = table.orders.findIndex(
                  (o) => o.uuid === updatedOrder.uuid,
                );
                if (index !== -1) {
                  table.orders[index] = {
                    ...table.orders[index],
                    ...updatedOrder,
                  };
                }
              }
            });
          });
        }
      },
    );
  },
});

export const {
  currentTableList,
  startEditMode,
  cancelEditMode,
  saveEditMode,
  setTempHallOrder,
  setTempTableOrder,
  setTempTableLayout
} = TablesSlice.actions;
export default TablesSlice.reducer;
