import { configureStore } from "@reduxjs/toolkit";
import OrderSlice from "../Slices/OrdersSlice";
import LoginSlice from "../Slices/LoginSlice";
import SaleSlice from "../Slices/SaleSlice";

export default configureStore({
  reducer: {
    OrderSlice: OrderSlice,
    LoginSlice: LoginSlice,
    SaleSlice: SaleSlice,
  },
});
