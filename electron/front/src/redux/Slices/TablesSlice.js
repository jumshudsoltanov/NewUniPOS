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
  },
  reducers: {
    currentTableList: (state, action) => {
      state.currentHallId = action.payload.hallId;
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
        action.type === "orders/itemDiscount/fulfilled",
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

export const { currentTableList } = TablesSlice.actions;
export default TablesSlice.reducer;
