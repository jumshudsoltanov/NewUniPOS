import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const menuWithGeneralCategories = createAsyncThunk(
  "orders/all-menu",
  async (profileId, thunkAPI) => {
    try {
      const response = await axios.get(
        `http://localhost:55667/api/menu/${profileId}/all-menu`,
        {},
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const menuWithCategories = createAsyncThunk(
  "orders/men-categories",
  async (profileId, thunkAPI) => {
    try {
      const response = await axios.get(
        `http://localhost:55667/api/menu/${profileId}/menu-with-categories`,
        {},
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

const MenuSlice = createSlice({
  name: "mwnu",
  initialState: {
    menuDataWithGeneralCategories: {},
    menuDataWithCategories: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(menuWithGeneralCategories.fulfilled, (state, action) => {
        state.menuDataWithGeneralCategories = action.payload;
      })
      .addCase(menuWithCategories.fulfilled, (state, action) => {
        state.menuDataWithCategories = action.payload;
      });
  },
});

export default MenuSlice.reducer;
