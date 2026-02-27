import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../utils/apiConfig";

export const authPos = createAsyncThunk(
    "pos/login",
    async (loginData, thunkAPI) => {
        try {
            const response = await api.post(
                "/login",
                loginData,
            );

            return response.data;
        } catch (err) {
            return thunkAPI.rejectWithValue({
                data: err.response ? err.response.data : null,
                status: err.response ? err.response.status : null,
                message: err.message,
            });
        }
    },
);

const LoginSlice = createSlice({
    name: "login",
    initialState: {
        loginedProfileData: {},
    },

    reducers: {
        setLoginData: (state, action) => {
            state.loginedProfileData = action.payload;
        },
    },

    extraReducers: (builder) => {
        builder.addCase(authPos.fulfilled, (state, action) => {
            state.loginedProfileData = action.payload;
        });
    },
});

export const { setLoginData } = LoginSlice.actions;
export default LoginSlice.reducer;
