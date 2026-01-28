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
  },
});

export const { currentTableList } = TablesSlice.actions;
export default TablesSlice.reducer;
