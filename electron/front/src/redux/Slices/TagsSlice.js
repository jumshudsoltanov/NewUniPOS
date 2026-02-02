import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const getTagsList = createAsyncThunk("pos/tags", async (profileId) => {
  const response = await axios.get(
    `http://localhost:55667/api/tags/${profileId}/list`,
    {},
  );
  return response.data;
});

const TagsSlice = createSlice({
  name: "tags",
  initialState: {
    tagsList: [],
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getTagsList.fulfilled, (state, action) => {
      state.tagsList = action.payload;
    });
  },
});

export default TagsSlice.reducer;
