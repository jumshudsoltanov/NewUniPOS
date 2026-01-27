import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const getWaiter = createAsyncThunk("pos/waiter", async (pin) => {
  const response = await axios.get(
    `http://localhost:55667/api/waiters/${pin}`,
    {},
  );
  return response.data;
});

const WaitersSlice = createSlice({
  name: "waiters",
  initialState: {
    loginedWaiter: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getWaiter.fulfilled, (state, action) => {
      state.loginedWaiter = action.payload;
    });
  },
});

export default WaitersSlice.reducer;
