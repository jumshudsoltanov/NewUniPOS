import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiConfig from "../../utils/apiConfig";

export const fetchRooms = createAsyncThunk(
  "hotel/fetchRooms",
  async (profileId, thunkAPI) => {
    try {
      const res = await apiConfig.get(`/rooms/${profileId}/summary`);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const fetchRoomGroups = createAsyncThunk(
  "hotel/fetchRoomGroups",
  async (profileId, thunkAPI) => {
    try {
      const res = await apiConfig.get(`/room-groups/${profileId}`);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const fetchBookings = createAsyncThunk(
  "hotel/fetchBookings",
  async (profileId, thunkAPI) => {
    try {
      const res = await apiConfig.get(`/bookings/${profileId}`);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const createReservation = createAsyncThunk(
  "hotel/createReservation",
  async (payload, thunkAPI) => {
    try {
      const res = await apiConfig.post("/bookings", payload);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const fetchFolios = createAsyncThunk(
  "hotel/fetchFolios",
  async (profileId, thunkAPI) => {
    try {
      const res = await apiConfig.get(`/folios/${profileId}`);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const updateRoomStatus = createAsyncThunk(
  "hotel/updateRoomStatus",
  async ({ roomId, status }, thunkAPI) => {
    try {
      const res = await apiConfig.patch(`/rooms/${roomId}/status`, { status });
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const updateBookingStatus = createAsyncThunk(
  "hotel/updateBookingStatus",
  async ({ bookingId, status }, thunkAPI) => {
    try {
      const res = await apiConfig.patch(`/bookings/${bookingId}/status`, { status });
      return { data: res.data, bookingId, status };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const deleteBooking = createAsyncThunk(
  "hotel/deleteBooking",
  async (bookingId, thunkAPI) => {
    try {
      const res = await apiConfig.delete(`/bookings/${bookingId}`);
      return { data: res.data, bookingId };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const updateFolioBalance = createAsyncThunk(
  "hotel/updateFolioBalance",
  async ({ roomId, profileId, balance }, thunkAPI) => {
    try {
      const res = await apiConfig.patch(`/folios/${roomId}/balance`, { profile_id: profileId, balance });
      return { data: res.data, roomId, balance };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const sendBookingWhatsapp = createAsyncThunk(
  "hotel/sendBookingWhatsapp",
  async ({ bookingId, profileId }, thunkAPI) => {
    try {
      const res = await apiConfig.post(`/bookings/${bookingId}/send-whatsapp`, { profile_id: profileId });
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

const HotelSlice = createSlice({
  name: "hotel",
  initialState: {
    rooms: [],
    roomGroups: [],
    bookings: [],
    isLoadingRooms: false,
    isLoadingRoomGroups: false,
    isCreatingReservation: false,
    isSendingWhatsapp: false,
    selectedFloor: null,
    selectedRoomType: null,
    selectedRoomGroupId: null,
    searchText: "",
  },
  reducers: {
    setSelectedFloor(state, action) {
      state.selectedFloor = action.payload;
    },
    setSelectedRoomType(state, action) {
      state.selectedRoomType = action.payload;
    },
    setSelectedRoomGroupId(state, action) {
      state.selectedRoomGroupId = action.payload;
    },
    setSearchText(state, action) {
      state.searchText = action.payload;
    },
    clearFilters(state) {
      state.selectedFloor = null;
      state.selectedRoomType = null;
      state.selectedRoomGroupId = null;
      state.searchText = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRooms.pending, (state) => {
        state.isLoadingRooms = true;
      })
      .addCase(fetchRooms.fulfilled, (state, action) => {
        state.isLoadingRooms = false;
        state.rooms = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
      })
      .addCase(fetchRooms.rejected, (state) => {
        state.isLoadingRooms = false;
        state.rooms = [];
      })
      .addCase(fetchRoomGroups.pending, (state) => {
        state.isLoadingRoomGroups = true;
      })
      .addCase(fetchRoomGroups.fulfilled, (state, action) => {
        state.isLoadingRoomGroups = false;
        const data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
        state.roomGroups = data;
      })
      .addCase(fetchRoomGroups.rejected, (state) => {
        state.isLoadingRoomGroups = false;
        state.roomGroups = [];
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.bookings = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
      })
      .addCase(createReservation.pending, (state) => {
        state.isCreatingReservation = true;
      })
      .addCase(createReservation.fulfilled, (state, action) => {
        state.isCreatingReservation = false;
        const booking = action.payload?.data || action.payload;
        const roomId = booking?.room_id;
        if (roomId) {
          const room = state.rooms.find((r) => r.id === roomId);
          if (room) {
            // Use status from backend response or infer from payload
            const newStatus = booking?.status || (action.meta?.arg?.status === "occupied" ? "occupied" : "reserved");
            room.status = newStatus;
            room.guest_name = booking?.guest_name || room.guest_name;
            if (booking?.folio_balance !== undefined) room.folio_balance = booking.folio_balance;
          }
        }
      })
      .addCase(createReservation.rejected, (state) => {
        state.isCreatingReservation = false;
      })
      .addCase(updateRoomStatus.fulfilled, (state, action) => {
        // Update local room status after API success
        const { id, status } = action.payload?.data || {};
        if (id && status) {
          const room = state.rooms.find((r) => r.id === id);
          if (room) room.status = status;
        }
      })
      .addCase(deleteBooking.fulfilled, (state, action) => {
        state.bookings = state.bookings.filter((b) => b.id !== action.payload.bookingId);
      })
      .addCase(updateFolioBalance.fulfilled, (state, action) => {
        const { roomId, balance } = action.payload;
        const room = state.rooms.find((r) => r.id === roomId);
        if (room) room.folio_balance = balance;
      })
      .addCase(sendBookingWhatsapp.pending, (state) => {
        state.isSendingWhatsapp = true;
      })
      .addCase(sendBookingWhatsapp.fulfilled, (state) => {
        state.isSendingWhatsapp = false;
      })
      .addCase(sendBookingWhatsapp.rejected, (state) => {
        state.isSendingWhatsapp = false;
      });
  },
});

export const { setSelectedFloor, setSelectedRoomType, setSelectedRoomGroupId, setSearchText, clearFilters } = HotelSlice.actions;
export default HotelSlice.reducer;
