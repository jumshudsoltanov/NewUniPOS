import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const authPos = createAsyncThunk(
  "pos/login",
  async (loginData, thunkAPI) => {
    try {
      const response = await axios.post(
        "http://localhost:55667/api/login",
        loginData,
      );

      return response.data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response.data);
    }
  },
);

const LoginSlice = createSlice({
  name: "login",
  initialState: {
    loginedProfileData: {},
  },

  reducers: {},

  extraReducers: (builder) => {
    builder.addCase(authPos.fulfilled, (state, action) => {
      state.loginedProfileData = action.payload;
    });
  },
});

export default LoginSlice.reducer;
