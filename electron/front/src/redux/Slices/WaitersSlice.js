import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";
import { normalizeCardId } from "../../utils/cardId";

export const getWaiter = createAsyncThunk("pos/waiter", async (pin) => {
  const response = await axios.get(
    `/waiters/${pin}`,
    {},
  );
  return response.data;
});

/** PIN və ya NFC card_id — profile_id ilə (köhnə getWaiter yalnız pin, profilsiz) */
export const resolveWaiter = createAsyncThunk(
  "pos/waiter-resolve",
  async ({ profileId, pin, cardId }, thunkAPI) => {
    try {
      if (profileId == null || profileId === "") {
        return thunkAPI.rejectWithValue({ message: "profile_id required" });
      }
      const params = new URLSearchParams({ profile_id: String(profileId) });
      const c = cardId != null ? normalizeCardId(cardId) : "";
      if (c !== "") {
        params.set("card_id", c);
      } else if (pin != null && String(pin).trim() !== "") {
        params.set("pin", String(pin).trim());
      } else {
        return thunkAPI.rejectWithValue({ message: "pin or cardId required" });
      }
      // PİN yoxlaması 30 saniyəlik ümumi timeout ilə gözləyəndə ekran "ilişmiş" görünürdü
      // (xüsusən Slave → Master yolunda). 6 saniyədə cavab yoxdursa dərhal xəta göstər.
      const response = await axios.get(`/waiters/resolve?${params.toString()}`, { timeout: 6000 });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  },
);

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
      .addCase(resolveWaiter.fulfilled, (state, action) => {
        state.loginedWaiter = action.payload;
      })
      .addCase(getWaitersList.fulfilled, (state, action) => {
        state.waitersLists = action.payload;
      });
  },
});

export default WaitersSlice.reducer;

