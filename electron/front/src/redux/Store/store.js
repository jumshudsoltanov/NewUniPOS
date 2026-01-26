import { configureStore } from "@reduxjs/toolkit";
import OrderSlice from "../Slices/OrdersSlice";
import LoginSlice from "../Slices/LoginSlice";
export default configureStore({
  reducer: {
    OrderSlice: OrderSlice,
    LoginSlice: LoginSlice,
  },
});
