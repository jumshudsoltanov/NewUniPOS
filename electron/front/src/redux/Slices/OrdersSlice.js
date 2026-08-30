import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";
import { getTableGroups } from "./TablesSlice";
import { getActiveOrders } from "./BooksSlice";
import {
  menuWithCategories,
  updateProductModifierGroups,
} from "./MenuSlice";

export const sendOrdersItems = createAsyncThunk(
  "pos/orders",
  async (payload, thunkAPI) => {
    try {
      const {
        orderId,
        profileId,
        productList,
        waiterId,
        waiterName: passedWaiterName,
      } = payload;
      const response = await axios.post(`/orders-items/${orderId}/items`, {
        productList,
        profileId,
        waiterId: waiterId || 0,
      });

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const grouped = {};
      productList?.forEach((item) => {
        const name = item.name || "Məhsul";
        const qty = Number(item.quantity || item.count || 1);
        grouped[name] = (grouped[name] || 0) + qty;
      });
      const itemNames = Object.entries(grouped)
        .map(([name, qty]) => `${qty} x ${name}`)
        .join(", ");

      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Sifariş göndərildi",
          waiterName,
          details: itemNames
            ? `Göndərildi: ${itemNames}`
            : "Mətbəxə göndərildi",
        }),
      );

      return response.data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data || "Server error");
    }
  },
);

export const updateDiscountOnOrders = createAsyncThunk(
  "pos/discount",
  async (
    {
      orderId,
      discountValue,
      discountType,
      oldDiscountValue,
      oldDiscountType,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(`/orders-items/${orderId}/discount`, {
        discountValue,
        discountType,
      });

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const oldValue = oldDiscountValue
        ? `${oldDiscountValue} ${oldDiscountType === "percent" ? "%" : "₼"}`
        : "0";
      const newValue = `${discountValue} ${discountType === "percent" ? "%" : "₼"}`;
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Endirim dəyişildi",
          waiterName,
          details: `${oldValue}-dən ${newValue}-ə dəyişdi`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

export const updateServiceFeeOnOrders = createAsyncThunk(
  "pos/serviceFee",
  async (
    {
      orderId,
      serviceValue,
      feeType,
      oldServiceValue,
      oldFeeType,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/service-fee`,
        { serviceValue, feeType },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const oldValue = oldServiceValue
        ? `${oldServiceValue} ${oldFeeType === "percent" ? "%" : "₼"}`
        : "0";
      const newValue = `${serviceValue} ${feeType === "percent" ? "%" : "₼"}`;
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Servis haqqı dəyişildi",
          waiterName,
          details: `${oldValue}-dən ${newValue}-ə dəyişdi`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

export const reopenOrder = createAsyncThunk(
  "orders/reopen",
  async (
    { orderId, reasonId, reasonName, waiterName: passedWaiterName },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(`/orders/${orderId}/reopen`, {
        reasonId,
      });

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Çek yenidən açıldı",
          waiterName,
          details: `Bağlı çek yenidən açıldı. Səbəb: ${reasonName || "Göstərilməyib"}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateTableOrders = createAsyncThunk(
  "orders/updateTable",
  async (
    {
      orderId,
      newTableId,
      currentHallId,
      oldTableName,
      newTableName,
      oldHallName,
      newHallName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-table`,
        { newTableId, currentHallId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Masa dəyişildi",
          waiterName,
          details: `Masa dəyişdirildi: [${oldHallName || "?"}] ${oldTableName || "?"} ➔ [${newHallName || "?"}] ${newTableName || "?"}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const deleteOrderItem = createAsyncThunk(
  "orders/delete-item",
  async (
    {
      orderId,
      itemId,
      reasonId,
      qty,
      productName,
      reasonName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/delete-item`,
        { itemId, reasonId, qty },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const qtyText = qty ? `${qty} ədəd` : "Bütün";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Məhsul silindi",
          waiterName,
          details: `${qtyText} ${productName || "Məhsul"} - ${reasonName || "Səbəb yoxdur"}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const batchDeleteOrderItems = createAsyncThunk(
  "orders/batch-delete-items",
  async ({ orderId, items, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/batch-delete-items`,
        { items },
      );
      // items already contains waste/wasteComment fields — backend handles them
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const grouped = {};
      items.forEach((d) => {
        const name = d.name || "Məhsul";
        const qty = Number(d.qty || d.originalQty || 1);
        grouped[name] = (grouped[name] || 0) + qty;
      });
      const detailsText =
        Object.entries(grouped).length > 0
          ? Object.entries(grouped)
              .map(([name, qty]) => `${qty} x ${name}`)
              .join(", ")
          : `${items.length} məhsul silindi`;
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Məhsullar silindi",
          waiterName,
          details: detailsText,
        }),
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const mergeChecks = createAsyncThunk(
  "orders/merge-check",
  async (
    {
      currentOrderId,
      newOrderId,
      currentCheckId,
      newCheckId,
      currentTotal,
      newTotal,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${currentOrderId}/merge-orders`,
        { newOrderId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId: currentOrderId,
          action: "Çeklər birləşdirildi",
          waiterName,
          details: `Çek #${currentCheckId} (${currentTotal || 0}₼) + Çek #${newCheckId} (${newTotal || 0}₼) = ${(Number(currentTotal || 0) + Number(newTotal || 0)).toFixed(2)}₼`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const changeSaleType = createAsyncThunk(
  "orders/change-saletype",
  async (
    {
      orderId,
      saleType,
      tableId,
      hallId,
      oldTypeName,
      newTypeName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/change-saletype`,
        { saleType, tableId, hallId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Satış növü dəyişildi",
          waiterName,
          details: `Növ dəyişdirildi: ${oldTypeName || "?"} ➔ ${newTypeName || "?"}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const changeWaiter = createAsyncThunk(
  "orders/waiters",
  async (
    {
      orderId,
      waiterId,
      oldWaiterName,
      newWaiterName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-waiter`,
        { waiterId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Ofisiant dəyişildi",
          waiterName,
          details: `Məsul şəxs: ${oldWaiterName || "?"} ➔ ${newWaiterName || "?"}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateGuestCountOrder = createAsyncThunk(
  "orders/update-guest-count",
  async ({ orderId, guestCount }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-guest-count`,
        { guestCount },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const splitOrder = createAsyncThunk(
  "orders/split",
  async (
    { data, profileId, profile, hallData, waiterName: passedWaiterName },
    thunkAPI,
  ) => {
    try {
      const response = await axios.post(
        `/orders-items/${profileId}/split-order`,
        { data, profile, hallData },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";

      const sourceOrderId = data?.orderId || profileId;
      const items = data?.items || [];
      const itemNames = items
        .map((i) => `${i.qty} ədəd (${i.name || "ID:" + i.id})`)
        .join(", ");
      const destTable = data?.table?.name || data?.table?.number || "";
      const destHall = data?.table?.hall_name || "";
      const salesType =
        data?.salesType === "dine_in"
          ? "Yerində"
          : data?.salesType === "takeaway"
            ? "Gəl götür"
            : data?.salesType === "delivery"
              ? "Çatdırılma"
              : data?.salesType;

      let details = `Köçürüldü: ${itemNames}`;
      if (destTable) {
        details += ` → [${destHall}] ${destTable}`;
      } else {
        details += ` → ${salesType}`;
      }

      // Log to source order
      thunkAPI.dispatch(
        saveLog({
          orderId: sourceOrderId,
          action: "Məhsul köçürüldü",
          waiterName,
          details,
        }),
      );

      // Log to destination order
      if (response.data?.data?.newOrder?.uuid) {
        thunkAPI.dispatch(
          saveLog({
            orderId: response.data.data.newOrder.uuid,
            action: "Məhsul qəbul edildi",
            waiterName,
            details: `Köçürmədən gəldi: ${itemNames}`,
          }),
        );
      }

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const assignCustomerToOrder = createAsyncThunk(
  "orders/assign-customer",
  async (
    { orderId, customerId, customerName, waiterName: passedWaiterName },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/assign-customer`,
        { customer_id: customerId },
      );

      // Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: customerId ? "Müştəri təyin edildi" : "Müştəri silindi",
          waiterName,
          details: customerName || "-",
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const giftItem = createAsyncThunk(
  "orders/gift",
  async (
    {
      orderId,
      itemId,
      allIds,
      qty,
      isGift,
      productName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.post(`/orders-items/${orderId}/gift-item`, {
        itemId,
        allIds,
        qty,
        isGift,
      });

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: isGift ? "Hədiyyə verildi" : "Hədiyyə ləğv edildi",
          waiterName,
          details: `${productName || "Məhsul"} - ${qty} ədəd`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateItemDiscount = createAsyncThunk(
  "orders/itemDiscount",
  async (
    {
      orderId,
      itemId,
      productId,
      discountValue,
      discountType,
      productName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      if (!orderId || !itemId) {
        throw new Error("Sifariş və ya məhsul ID-si tapılmadı");
      }

      const response = await axios.post(
        `/orders-items/${orderId}/discount-item`,
        {
          itemId,
          item_id: itemId,
          productId,
          product_id: productId || itemId,
          discountValue: parseFloat(discountValue) || 0,
          discountType,
          discount_value: parseFloat(discountValue) || 0,
          discount_type: discountType,
          discount_percentage:
            discountType === "percent" ? parseFloat(discountValue) : 0,
          discount_amount:
            discountType === "amount" ? parseFloat(discountValue) : 0,
        },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const discountText =
        discountType === "percent" ? `${discountValue}%` : `${discountValue}₼`;
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Məhsula endirim",
          waiterName,
          details: `${productName || "Məhsul"} - ${discountText}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const deleteCheck = createAsyncThunk(
  "orders/deleteCheck",
  async (
    {
      orderId,
      reason,
      reasonText,
      waiterName: passedWaiterName,
      forceDestroy = false,
      waste = false,
      wasteComment = "",
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/delete-check`,
        { reason, forceDestroy, waste, wasteComment },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Çek silindi",
          waiterName,
          details: `Səbəb: ${reasonText || reason}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateItemPrice = createAsyncThunk(
  "orders/updateItemPrice",
  async (
    {
      orderId,
      itemId,
      newPrice,
      oldPrice,
      productName,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-price`,
        { itemId, newPrice },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Qiymət dəyişdirildi",
          waiterName,
          details: `${productName || "Məhsul"}: ${oldPrice}₼-dən ${newPrice}₼-ə dəyişdi`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateItemCount = createAsyncThunk(
  "orders/updateItemCount",
  async (
    {
      orderId,
      itemId,
      newCount,
      oldCount,
      productName,
      waiterName: passedWaiterName,
      modifiers,
      comment,
      skipQuantityLog = false,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-count`,
        {
          itemId,
          newCount,
          ...(modifiers !== undefined ? { modifiers } : {}),
          ...(comment !== undefined ? { comment } : {}),
        },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      if (!skipQuantityLog && Number(oldCount) !== Number(newCount)) {
        thunkAPI.dispatch(
          saveLog({
            orderId,
            action: "Miqdar dəyişdirildi",
            waiterName,
            details: `${productName || "Məhsul"}: ${oldCount}-dən ${newCount}-ə dəyişdi`,
          }),
        );
      }

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const closeOrder = createAsyncThunk(
  "orders/close",
  async (
    {
      orderId,
      payments,
      status,
      profileId,
      waiterId,
      note,
      is_tax,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.post(`/orders-items/${orderId}/close`, {
        payments,
        status,
        profileId,
        waiterId,
        note,
        is_tax,
      });

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";

      const isUnpaid = payments.some((p) => p.without_payment_method_id);
      const paymentDetails = payments
        .map((p) => {
          const methodPrefix =
            p.name ||
            (p.without_payment_method_id ? "Ödənişsiz" : p.type || "Ödəniş");
          return `${methodPrefix}: ${p.amount} ₼`;
        })
        .join(", ");

      let detailsParts = [];
      if (paymentDetails) detailsParts.push(paymentDetails);
      if (note && String(note).trim())
        detailsParts.push(`Qeyd: ${String(note).trim()}`);

      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: isUnpaid ? "Ödənişsiz bağlandı" : "Ödəniş edildi",
          waiterName,
          details: detailsParts.join(" | ") || "Sifariş bağlandı",
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Server error");
    }
  },
);

export const fetchLogs = createAsyncThunk(
  "orders/fetchLogs",
  async (orderId, thunkAPI) => {
    try {
      const response = await axios.get(`/orders-items/${orderId}/logs`);
      // Map snake_case to camelCase for consistent filtering
      return response.data.map((log) => ({
        ...log,
        orderId: log.order_id,
        waiterName: log.waiter_name,
      }));
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const saveLog = createAsyncThunk(
  "orders/saveLog",
  async (
    { orderId, action, waiterName, details, profileId: profileIdArg },
    thunkAPI,
  ) => {
    try {
      const state = thunkAPI.getState();
      // Login API: { data: { profile: { id, is_whatsapp_notify, ... } } } — profileId = profile.id
      let profileId =
        profileIdArg ??
        state.LoginSlice?.loginedProfileData?.data?.profile?.id ??
        state.LoginSlice?.loginedProfileData?.profile?.id;

      if (profileId == null && typeof window !== "undefined") {
        try {
          const ar = JSON.parse(
            window.localStorage.getItem("authResult") || "{}",
          );
          profileId = ar?.data?.profile?.id ?? ar?.profile?.id ?? profileId;
        } catch {
          /* ignore */
        }
      }

      const profileSnap =
        state.LoginSlice?.loginedProfileData?.data?.profile ??
        state.LoginSlice?.loginedProfileData?.profile;

      const terminalSnap =
        state.LoginSlice?.loginedProfileData?.data?.terminal ??
        state.LoginSlice?.loginedProfileData?.terminal;

      let terminalIdForLog = terminalSnap?.terminal_id ?? terminalSnap?.id;
      if (terminalIdForLog == null && typeof window !== "undefined") {
        try {
          const ar = JSON.parse(
            window.localStorage.getItem("authResult") || "{}",
          );
          const t = ar?.data?.terminal ?? ar?.terminal;
          terminalIdForLog = t?.terminal_id ?? t?.id ?? terminalIdForLog;
        } catch {
          /* ignore */
        }
      }

      const response = await axios.post(`/orders-items/${orderId}/logs`, {
        action,
        waiterName,
        details,
        // Profil API-də `id` adlanır; backend hər ikisini qəbul edir
        id: profileId ?? undefined,
        profileId: profileId ?? undefined,
        is_whatsapp_notify: profileSnap?.is_whatsapp_notify,
        whatsapp_chat_number: profileSnap?.whatsapp_chat_number,
        restaurant_name: profileSnap?.restaurant_name,
        terminal_id: terminalIdForLog,
      });
      if (typeof console !== "undefined" && console.info) {
        console.info(
          "[POS][Jurnal] serverə yazıldı:",
          action,
          "| orderId:",
          String(orderId).slice(0, 13),
        );
      }
      // Map snake_case to camelCase
      return {
        ...response.data,
        orderId: response.data.order_id,
        waiterName: response.data.waiter_name,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateLockChecK = createAsyncThunk(
  "orders/lockCheck",
  async ({ orderId, status, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/lock-check`,
        { status },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      try {
        await thunkAPI
          .dispatch(
            saveLog({
              orderId,
              action: status ? "Qəbz kilidləndi" : "Qəbz açıldı",
              waiterName,
              details: status
                ? "Çek üzərində əməliyyatlar dayandırıldı"
                : "Çek yenidən aktiv edildi",
            }),
          )
          .unwrap();
      } catch (logErr) {
        console.error(
          "[OrderLog] Kilid sonrası jurnal xətası:",
          logErr?.message || logErr,
        );
      }

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateTags = createAsyncThunk(
  "orders/updateTags",
  async ({ orderId, tags }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/check-tags`,
        { tags },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateComments = createAsyncThunk(
  "orders/updateComments",
  async ({ orderId, comments, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/check-comments`,
        { comments },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Şərh yazıldı",
          waiterName,
          details: comments ? `Şərh: ${comments}` : "Şərh silindi",
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const deleteOrderItems = createAsyncThunk(
  "orders/deleteItems",
  async ({ orderId, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/delete-items`,
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Qəbz təmizləndi",
          waiterName,
          details: "Bütün sifarişlər silindi",
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateDepositOnOrders = createAsyncThunk(
  "orders/updateDeposit",
  async (
    {
      orderId,
      depositValue,
      depositType,
      oldDepositValue,
      waiterName: passedWaiterName,
    },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(`/orders-items/${orderId}/deposit`, {
        depositValue,
        depositType,
      });

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const oldValue = oldDepositValue ? `${oldDepositValue} ₼` : "0 ₼";
      const newValue = `${depositValue} ₼`;
      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Depozit dəyişildi",
          waiterName,
          details: `${oldValue}-dən ${newValue}-ə dəyişdi`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const incrementPrintCount = createAsyncThunk(
  "orders/incrementPrintCount",
  async ({ orderId, waiterName }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/increment-print-count`,
      );

      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Ön çap çıxarıldı",
          waiterName,
          details: "Müştəri çeki çap edildi",
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const startTimer = createAsyncThunk(
  "orders/startTimer",
  async ({ orderId, itemId, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/timer-start`,
        { itemId }
      );

      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";

      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Taymer başladıldı",
          waiterName,
          details: `Taymer saymağa başladı${itemId ? ' (Məhsul)' : ''}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const stopTimer = createAsyncThunk(
  "orders/stopTimer",
  async (
    { orderId, itemId, elapsedSeconds, clockStr, waiterName: passedWaiterName },
    thunkAPI,
  ) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/timer-stop`,
        {
          itemId,
          elapsedSeconds,
          clockStr,
        },
      );

      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";

      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Taymer dayandırıldı",
          waiterName,
          details: `Taymer dayandırıldı${itemId ? ' (Məhsul)' : ''}. Vaxt: ${clockStr}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const resetTimer = createAsyncThunk(
  "orders/resetTimer",
  async ({ orderId, itemId, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/timer-reset`,
        { itemId }
      );

      const state = thunkAPI.getState();
      const waiterName =
        passedWaiterName ||
        state.WaitersSlice?.loginedWaiter?.data?.name ||
        state.WaitersSlice?.loginedWaiter?.name ||
        state.LoginSlice?.loginedProfileData?.data?.profile?.name ||
        "Naməlum";

      thunkAPI.dispatch(
        saveLog({
          orderId,
          action: "Taymer sıfırlandı",
          waiterName,
          details: `Taymer sıfırlandı${itemId ? ' (Məhsul)' : ''}`,
        }),
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const OrderSlice = createSlice({
  name: "orders",
  initialState: {
    products: [],
    sentProducts: [],
    menu: [],
    discount: [],
    service: [],
    updateTable: [],
    isLockCheck: {},
    tags: {},
    comments: {},
    deleteItems: {},
    mergeChecs: {},
    changeSaleTypeData: {},
    updateWaiter: {},
    splitOrderData: {},
    pendingDeletions: [],
    orderLogs: [],
  },

  reducers: {
    addPendingDeletion: (state, action) => {
      // payload: { orderId, itemId, reasonId, qty, type: 'full'|'partial', name, originalQty, price }
      state.pendingDeletions.push(action.payload);
    },
    clearPendingDeletions: (state) => {
      state.pendingDeletions = [];
    },
    removeProduct: (state, action) => {
      state.products.splice(action.payload, 1);
    },
    removeAllProductsById: (state, action) => {
      const productId = Number(action.payload);
      state.products = state.products.filter(
        (p) => Number(p.id || p.product_id) !== productId,
      );
      if (state.sentProducts) {
        state.sentProducts = state.sentProducts.filter(
          (p) => Number(p.id || p.product_id) !== productId,
        );
      }
    },
    removeProductByIdAndPrice: (state, action) => {
      const { product_id, price } = action.payload;
      const idx = state.products.findIndex(
        (p) =>
          Number(p.id || p.product_id) === Number(product_id) &&
          Number(p.price) === Number(price),
      );
      if (idx !== -1) state.products.splice(idx, 1);
    },
    replaceProductQuantity: (state, action) => {
      const { productId, newQty, price, firstId, uuid, modifiers, comment } = action.payload;

      // FIRST try to match by uuid if it's a new item (very reliable)
      if (uuid) {
        const idx = state.products.findIndex(p => p.uuid === uuid);
        if (idx !== -1) {
          if (newQty <= 0) {
            state.products.splice(idx, 1);
          } else {
            const p = state.products[idx];
            p.quantity = newQty;
            p.count = newQty;
            p.newOrder = newQty;
            if (price !== undefined) p.price = parseFloat(price);
            if (modifiers !== undefined) p.modifiers = modifiers;
            if (comment !== undefined) p.comment = comment;
          }
          return;
        }
      }

      if (firstId !== undefined && firstId >= 999999999) {
        const idx = firstId - 999999999;
        if (idx < state.products.length) {
          const p = state.products[idx];
          if (newQty <= 0) {
            state.products.splice(idx, 1);
          } else {
            p.quantity = newQty;
            p.count = newQty;
            p.newOrder = newQty;
            if (price !== undefined) p.price = parseFloat(price);
            if (modifiers !== undefined) p.modifiers = modifiers;
            if (comment !== undefined) p.comment = comment;
          }
          return;
        } else {
          const sentIdx = idx - state.products.length;
          if (state.sentProducts && sentIdx < state.sentProducts.length) {
            const sp = state.sentProducts[sentIdx];
            if (newQty <= 0) {
              state.sentProducts.splice(sentIdx, 1);
            } else {
              sp.quantity = newQty;
              sp.count = newQty;
              sp.newOrder = newQty;
              if (price !== undefined) sp.price = parseFloat(price);
              if (modifiers !== undefined) sp.modifiers = modifiers;
              if (comment !== undefined) sp.comment = comment;
            }
            return;
          }
        }
      }

      // Fallback: find by productId
      const pid = Number(productId);
      
      // Try to find and update in-place first (for single entry)
      const existingIdx = state.products.findIndex((p) => Number(p.id || p.product_id) === pid);
      
      if (existingIdx !== -1) {
        if (newQty <= 0) {
          state.products.splice(existingIdx, 1);
        } else {
          const p = state.products[existingIdx];
          p.quantity = newQty;
          p.count = newQty;
          p.newOrder = newQty;
          if (price !== undefined) p.price = parseFloat(price);
          if (modifiers !== undefined) p.modifiers = modifiers;
          if (comment !== undefined) p.comment = comment;
        }
        return;
      }
      
      // Also check sentProducts
      if (state.sentProducts) {
        const sentIdx = state.sentProducts.findIndex((p) => Number(p.id || p.product_id) === pid);
        if (sentIdx !== -1) {
          if (newQty <= 0) {
            state.sentProducts.splice(sentIdx, 1);
          } else {
            const sp = state.sentProducts[sentIdx];
            sp.quantity = newQty;
            sp.count = newQty;
            sp.newOrder = newQty;
            if (price !== undefined) sp.price = parseFloat(price);
            if (modifiers !== undefined) sp.modifiers = modifiers;
            if (comment !== undefined) sp.comment = comment;
          }
          return;
        }
      }
      
      // Product not found at all — push as new if qty > 0
      if (newQty > 0) {
        state.products.push({
          id: pid,
          product_id: pid,
          quantity: newQty,
          count: newQty,
          newOrder: newQty,
          price: price !== undefined ? parseFloat(price) : 0,
          modifiers: modifiers || [],
          comment: comment || '',
        });
      }
    },
    splitProductQuantity: (state, action) => {
      const { firstId, portions } = action.payload;
      if (!portions || portions.length === 0) return;
      if (firstId !== undefined && firstId >= 999999999) {
        const idx = firstId - 999999999;
        if (idx < state.products.length) {
          const originalProduct = state.products[idx];
          // Do NOT split the Redux item physically. 
          // Just store the portions so the POS cart keeps it as one line.
          // handleSendOrders will expand these portions into separate items for the backend.
          originalProduct.commentPortions = portions;
          // Set the main comment to the first portion's comment so it displays something
          if (portions[0] && portions[0].comment) {
            originalProduct.comment = portions[0].comment;
          }
        }
      }
    },
    removeLocalProductByFirstId: (state, action) => {
      const firstId = action.payload;
      if (firstId !== undefined && firstId >= 999999999) {
        const idx = firstId - 999999999;
        if (idx < state.products.length) {
          state.products.splice(idx, 1);
        } else {
          const sentIdx = idx - state.products.length;
          if (state.sentProducts && sentIdx < state.sentProducts.length) {
            state.sentProducts.splice(sentIdx, 1);
          }
        }
      }
    },
    removeLocalProductByUuid: (state, action) => {
      const payload = action.payload;
      if (!payload) return;
      const uuid = typeof payload === 'object' ? payload.uuid : payload;
      const productId = typeof payload === 'object' ? payload.productId : null;
      
      let deleted = false;
      if (uuid) {
        const initialLen = state.products.length;
        state.products = state.products.filter(p => p.uuid !== uuid && p.id !== uuid);
        if (state.products.length < initialLen) deleted = true;
      }
      
      if (!deleted && productId) {
        // Fallback: delete exactly ONE item with this productId
        const idx = state.products.findIndex(p => Number(p.product_id || p.id) === Number(productId));
        if (idx !== -1) state.products.splice(idx, 1);
      }
      
      if (state.sentProducts && uuid) {
        state.sentProducts = state.sentProducts.filter(p => p.uuid !== uuid && p.id !== uuid);
      }
    },
    addProducts: (state, action) => {
      const incomingProduct = action.payload;
      const normalizedQuantity = Number(incomingProduct.quantity);
      const parsedPrice = parseFloat(incomingProduct.price);

      const qty = Number.isFinite(normalizedQuantity) && normalizedQuantity > 0 ? normalizedQuantity : 1;

      // Eyni product_id + price + modifiers olan varsa quantity artır, yeni sətir açma
      // Modifiers müqayisəsi üçün CheckMain.jsx-dəki normalization tətbiq olunur
      const normalizeMods = (mods) => {
        if (!mods) return '[]';
        const arr = Array.isArray(mods) ? mods : [];
        return JSON.stringify(
          [...arr]
            .map(m => ({ id: m.id, count: m.count || m.quantity || 1 }))
            .sort((a, b) => (a.id || 0) - (b.id || 0))
        );
      };

      const isOwnSetPrice = incomingProduct.own_set_price === 1 || incomingProduct.isOwnSetPrice === 1;
      
      let pHourly = Number(incomingProduct.hourly_price || incomingProduct.product?.hourly_price || 0);
      let pIntervals = incomingProduct.timer_intervals || incomingProduct.product?.timer_intervals || [];
      
      if (state.menu && Array.isArray(state.menu)) {
        const catItem = state.menu.find(m => Number(m.id) === Number(incomingProduct.product_id || incomingProduct.id));
        if (catItem) {
          pHourly = pHourly || Number(catItem.hourly_price || 0);
          if (!pIntervals || (Array.isArray(pIntervals) && pIntervals.length === 0) || (typeof pIntervals === 'string' && pIntervals.length <= 2)) {
            pIntervals = catItem.timer_intervals || [];
          }
        }
      }

      // Fallback: check existing products in state (already-added items carry the info)
      if (pHourly === 0 && !(Array.isArray(pIntervals) ? pIntervals.length > 0 : (typeof pIntervals === 'string' && pIntervals.length > 2 && pIntervals !== "[]"))) {
        const existingInState = [...(state.products || []), ...(state.sentProducts || [])].find(
          p => Number(p.product_id || p.id) === Number(incomingProduct.product_id || incomingProduct.id)
        );
        if (existingInState) {
          pHourly = pHourly || Number(existingInState.hourly_price || existingInState.product?.hourly_price || 0);
          if (!pIntervals || (Array.isArray(pIntervals) && pIntervals.length === 0)) {
            pIntervals = existingInState.timer_intervals || existingInState.product?.timer_intervals || [];
          }
        }
      }

      const intervalsValid = Array.isArray(pIntervals) ? pIntervals.length > 0 : (typeof pIntervals === 'string' && pIntervals.length > 2 && pIntervals !== "[]");
      const isTimerProduct = pHourly > 0 || intervalsValid || String(incomingProduct.product_type || '').toLowerCase() === 'timer' || String(incomingProduct.product?.product_type || '').toLowerCase() === 'timer';
      
      // Timer məhsulları HEÇ VAXT qruplaşmaz - hər biri ayrı saatı olan ayrı sətirdir
      if (!isOwnSetPrice && !isTimerProduct) {
        const prodId = incomingProduct.product_id || incomingProduct.id;
        const isGift = incomingProduct.is_gift === 1 || incomingProduct.is_gift === true;
        const priceStr = String(parsedPrice || '');
        const modStr = normalizeMods(incomingProduct.modifiers);

        const existingIdx = state.products.findIndex(p => {
          if (p.own_set_price === 1 || p.isOwnSetPrice === 1) return false;
          const pId = p.product_id || p.id;
          const pGift = p.is_gift === 1 || p.is_gift === true;
          const pPrice = String(parseFloat(p.price) || '');
          const pModStr = normalizeMods(p.modifiers);
          return pId === prodId && pGift === isGift && pPrice === priceStr && pModStr === modStr;
        });

        if (existingIdx !== -1) {
          const existing = state.products[existingIdx];
          const existingQty = Number(existing.quantity || existing.count || 0);
          state.products[existingIdx] = {
            ...existing,
            quantity: existingQty + qty,
            newOrder: (Number(existing.newOrder || 0)) + qty,
          };
          return;
        }
      }

      const finalProduct = {
        ...incomingProduct,
        uuid: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        quantity: qty,
        newOrder: incomingProduct.newOrder !== undefined ? incomingProduct.newOrder : qty,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      };

      if (isTimerProduct) {
        finalProduct.is_timer_status = 0;
        finalProduct.is_timer_clock = "00:00:00";
        finalProduct.timer_last_started_at = null;
      }

      state.products.push(finalProduct);
    },

    sendOrders: (state, action) => {
      state.products = action.payload.map((item) => ({
        ...item,
        newOrder: 0,
      }));
    },

    clearOrders: (state, action) => {
      state.products = [];
      state.sentProducts = [];
      state.pendingDeletions = [];
    },

    updateCount: (state, action) => {
      const { productId, count, price, name } = action.payload;
      const existingProductIndex = state.products.findIndex(
        (product) => product.id === productId,
      );

      if (existingProductIndex !== -1) {
        if (count <= 0) {
          state.products.splice(existingProductIndex, 1);
        } else {
          state.products[existingProductIndex].quantity = count;
          state.products[existingProductIndex].count = count;
          state.products[existingProductIndex].newOrder = count;
          if (price !== undefined) {
            state.products[existingProductIndex].price = parseFloat(price);
          }
        }
      } else if (count > 0) {
        // Product doesn't exist in local products yet (saved item getting extra qty)
        state.products.push({
          id: productId,
          name: name || "Məhsul",
          price: parseFloat(price) || 0,
          quantity: count,
          count: count,
          newOrder: count,
        });
      }
    },

    menuData: (state, action) => {
      state.menu = action.payload;
    },

    addLog: (state, action) => {
      // payload: { orderId, action, waiterName, details }
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString("az-AZ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        ...action.payload,
      };
      state.orderLogs.push(newLog);
    },
  },
  extraReducers: (builder) => {
    builder
      // Göndərmə başlayanda products-u sentProducts-a köçür:
      // Bu race condition-ı aradan qaldırır — getActiveOrders orders_items-i yenilədikdə
      // products hələ doluyursa eyni məhsul 2 dəfə göstərilirdi.
      .addCase(sendOrdersItems.pending, (state) => {
        state.sentProducts = [...state.products];
        state.products = [];
        state.loading = true;
      })
      .addCase(sendOrdersItems.fulfilled, (state, action) => {
        state.loading = false;
        state.products = [];
        state.sentProducts = [];
      })
      .addCase(sendOrdersItems.rejected, (state) => {
        // Göndərmə uğursuz oldu — sentProducts-u geri qaytart ki istifadəçi yenidən cəhd edə bilsin
        state.products = [...state.sentProducts, ...state.products];
        state.sentProducts = [];
        state.loading = false;
      })
      .addCase(getTableGroups.fulfilled, (state, action) => {
        state.sentProducts = [];
        // pendingDeletions saxlanılmalıdır: socket table_updated → getTableGroups işləyəndə
        // istifadəçi modifikatorlu məhsulu “silinəcək” işarələyib hələ Göndərməyibsə,
        // əks halda siyahı təmizlənir və çek API məlumatı ilə geri qayıdır (2 dəfə silmə).
      })
      .addCase(getActiveOrders.fulfilled, (state, action) => {
        state.sentProducts = [];
        // pendingDeletions burada da təmizlənməsin — eyni yarış vəziyyəti.
      })
      .addCase(updateDiscountOnOrders.fulfilled, (state, action) => {
        state.discount = action.payload;
      })
      .addCase(updateServiceFeeOnOrders.fulfilled, (state, action) => {
        state.service = action.payload;
      })
      .addCase(updateTableOrders.fulfilled, (state, action) => {
        state.updateTable = action.payload;
      })
      .addCase(updateLockChecK.fulfilled, (state, action) => {
        state.isLockCheck = action.payload;
      })
      .addCase(updateTags.fulfilled, (state, action) => {
        state.tags = action.payload;
      })
      .addCase(updateComments.fulfilled, (state, action) => {
        state.comments = action.payload;
      })
      .addCase(deleteOrderItem.fulfilled, (state, action) => {
        if (state.pendingDeletions) {
          const { itemId } = action.meta.arg;
          state.pendingDeletions = state.pendingDeletions.filter(
            (item) => Number(item.itemId) !== Number(itemId),
          );
        }
      })
      .addCase(batchDeleteOrderItems.fulfilled, (state, action) => {
        // Do nothing here. We must keep pendingDeletions until getActiveOrders is fetched
        // to prevent UI flicker. Check.jsx explicitly clears it afterwards.
      })
      .addCase(batchDeleteOrderItems.rejected, (state) => {
        // Keep pendingDeletions so user can retry
      })
      .addCase(deleteOrderItems.fulfilled, (state, action) => {
        state.products = [];
      })
      .addCase(mergeChecks.fulfilled, (state, action) => {
        state.mergeChecs = action.payload;
      })
      .addCase(changeSaleType.fulfilled, (state, action) => {
        state.changeSaleTypeData = action.payload;
      })
      .addCase(changeWaiter.fulfilled, (state, action) => {
        state.updateWaiter = action.payload;
      })
      .addCase(splitOrder.fulfilled, (state, action) => {
        state.splitOrderData = action.payload;
      })
      .addCase(giftItem.fulfilled, (state, action) => {
        // Optional: Update state if needed
      })
      .addCase(updateDepositOnOrders.fulfilled, (state, action) => {
        // You can add state field for deposit if needed
      })
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.orderLogs = action.payload;
      })
      .addCase(saveLog.fulfilled, (state, action) => {
        state.orderLogs.unshift(action.payload);
      })
      .addCase(deleteCheck.fulfilled, (state, action) => {
        // No local log push - handled by thunk saveLog
      })
      .addCase(closeOrder.fulfilled, (state, action) => {
        // No local log push - handled by thunk saveLog
      })
      .addCase(incrementPrintCount.fulfilled, (state, action) => {
        if (
          state.currentOrder &&
          state.currentOrder.uuid === action.meta.arg.orderId
        ) {
          state.currentOrder.print_count = action.payload.print_count;
        }
      })
      .addCase(menuWithCategories.fulfilled, (state, action) => {
        const categories = action.payload?.data || [];
        let products = [];
        categories.forEach((cat) => {
          if (cat.products) products = products.concat(cat.products);
        });
        state.menu = products;
      })
      .addCase(updateProductModifierGroups, (state, action) => {
        const { productId, modifier_groups } = action.payload;
        const idx = state.menu.findIndex(
          (p) => Number(p.id) === Number(productId),
        );
        if (idx !== -1) {
          state.menu[idx] = { ...state.menu[idx], modifier_groups };
        }
      })
      .addMatcher(
        (action) => action.type === "products/update/fulfilled",
        (state, action) => {
          const updatedProduct = action.payload?.data || action.payload;
          if (!updatedProduct?.id) return;
          const idx = state.menu.findIndex(
            (p) => Number(p.id) === Number(updatedProduct.id),
          );
          if (idx !== -1) {
            state.menu[idx] = { ...state.menu[idx], ...updatedProduct };
          }
        },
      )
      .addMatcher(
        (action) => action.type === "products/delete/fulfilled",
        (state, action) => {
          const deletedId = action.payload;
          if (!deletedId) return;
          state.menu = state.menu.filter(
            (p) => Number(p.id) !== Number(deletedId),
          );
        },
      )
      .addMatcher(
        (action) => action.type === "products/add/fulfilled",
        (state, action) => {
          const newProduct = action.payload?.data || action.payload;
          if (!newProduct?.id) return;
          if (
            !state.menu.find(
              (p) => Number(p.id) === Number(newProduct.id),
            )
          ) {
            state.menu.push(newProduct);
          }
        },
      );
  },
});

export const {
  addProducts,
  removeProduct,
  removeAllProductsById,
  removeProductByIdAndPrice,
  removeLocalProductByFirstId,
  removeLocalProductByUuid,
  replaceProductQuantity,
  splitProductQuantity,
  sendOrders,
  clearOrders,
  updateCount,
  addPendingDeletion,
  clearPendingDeletions,
  addLog,
  menuData,
} = OrderSlice.actions;

export default OrderSlice.reducer;
