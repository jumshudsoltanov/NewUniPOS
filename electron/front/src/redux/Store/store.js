import { configureStore } from "@reduxjs/toolkit";
import OrderSlice from "../Slices/OrdersSlice";
import LoginSlice from "../Slices/LoginSlice";
import SaleSlice from "../Slices/SaleSlice";
import WaitersSlice from "../Slices/WaitersSlice";
import TablesSlice from "../Slices/TablesSlice";
import BooksSlice from "../Slices/BooksSlice";
import MenuSlice from "../Slices/MenuSlice";
import PaymentMethodsSlice from "../Slices/PaymentMethodsSlice";

import SalesTypesSlice from "../Slices/SalesTypesSlice";

export default configureStore({
  reducer: {
    OrderSlice: OrderSlice,
    LoginSlice: LoginSlice,
    SaleSlice: SaleSlice,
    WaitersSlice: WaitersSlice,
    TablesSlice: TablesSlice,
    BooksSlice: BooksSlice,
    MenuSlice: MenuSlice,
    PaymentMethodsSlice: PaymentMethodsSlice,
    SalesTypesSlice: SalesTypesSlice,
  },
});
