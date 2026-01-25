import { configureStore } from "@reduxjs/toolkit";
import OrderSlice from "../Slices/OrdersSlice";

export default configureStore({
  reducer: {
    OrderSlice: OrderSlice,
  },
});
