import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";

export const getWaiter = createAsyncThunk("pos/waiter", async (pin) => {
  const response = await axios.get(
    `/waiters/${pin}`,
    {},
  );
  return response.data;
});

export const getWaitersList = createAsyncThunk(
  "pos/waiters",
  async (profileId) => {
    const response = await axios.get(
      `/waiters/${profileId}/list`,
      {},
    );
    return response.data;
  },
);

const WaitersSlice = createSlice({
  name: "waiters",
  initialState: {
    loginedWaiter: {},
    waitersLists: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getWaiter.fulfilled, (state, action) => {
        state.loginedWaiter = action.payload;
      })
      .addCase(getWaitersList.fulfilled, (state, action) => {
        state.waitersLists = action.payload;
      });
  },
});

export default WaitersSlice.reducer;

