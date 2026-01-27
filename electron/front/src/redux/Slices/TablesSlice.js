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
    tables: {},
  },
  reducers: {
    currentTableList: (state, action) => {
      const { hallId } = action.payload;
      if (state.tableGroups?.data) {
        state.tables = state.tableGroups.data.filter(
          (table) => table.id == hallId,
        );
      } else {
        state.tables = [];
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getTableGroups.fulfilled, (state, action) => {
      state.tableGroups = action.payload;
    });
  },
});

export const { currentTableList } = TablesSlice.actions;
export default TablesSlice.reducer;
