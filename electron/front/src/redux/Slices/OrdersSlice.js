import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";
import { getTableGroups } from "./TablesSlice";
import { getActiveOrders } from "./BooksSlice";

export const sendOrdersItems = createAsyncThunk(
  "pos/orders",
  async (payload, thunkAPI) => {
    try {
      const { orderId, profileId, productList, waiterId, waiterName: passedWaiterName } = payload;
      const response = await axios.post(
        `/orders-items/${orderId}/items`,
        { productList, profileId, waiterId: waiterId || 0 },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      const itemNames = productList?.map(item => `${item.quantity || item.count || 1} x ${item.name}`).join(', ');

      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Sifariş göndərildi",
        waiterName,
        details: itemNames ? `Göndərildi: ${itemNames}` : "Mətbəxə göndərildi"
      }));

      return response.data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data || "Server error");
    }
  },
);


export const updateDiscountOnOrders = createAsyncThunk(
  "pos/discount",
  async ({ orderId, discountValue, discountType, oldDiscountValue, oldDiscountType, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/discount`,
        { discountValue, discountType },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      const oldValue = oldDiscountValue ? `${oldDiscountValue} ${oldDiscountType === 'percent' ? '%' : '₼'}` : '0';
      const newValue = `${discountValue} ${discountType === 'percent' ? '%' : '₼'}`;
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Endirim dəyişildi",
        waiterName,
        details: `${oldValue}-dən ${newValue}-ə dəyişdi`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

export const updateServiceFeeOnOrders = createAsyncThunk(
  "pos/serviceFee",
  async ({ orderId, serviceValue, feeType, oldServiceValue, oldFeeType, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/service-fee`,
        { serviceValue, feeType },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      const oldValue = oldServiceValue ? `${oldServiceValue} ${oldFeeType === 'percent' ? '%' : '₼'}` : '0';
      const newValue = `${serviceValue} ${feeType === 'percent' ? '%' : '₼'}`;
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Servis haqqı dəyişildi",
        waiterName,
        details: `${oldValue}-dən ${newValue}-ə dəyişdi`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

export const reopenOrder = createAsyncThunk(
  "orders/reopen",
  async ({ orderId, reasonId, reasonName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders/${orderId}/reopen`,
        { reasonId }
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Çek yenidən açıldı",
        waiterName,
        details: `Bağlı çek yenidən açıldı. Səbəb: ${reasonName || 'Göstərilməyib'}`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateTableOrders = createAsyncThunk(
  "orders/updateTable",
  async ({ orderId, newTableId, currentHallId, oldTableName, newTableName, oldHallName, newHallName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-table`,
        { newTableId, currentHallId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Masa dəyişildi",
        waiterName,
        details: `Masa dəyişdirildi: [${oldHallName || '?'}] ${oldTableName || '?'} ➔ [${newHallName || '?'}] ${newTableName || '?'}`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const deleteOrderItem = createAsyncThunk(
  "orders/delete-item",
  async ({ orderId, itemId, reasonId, qty, productName, reasonName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/delete-item`,
        { itemId, reasonId, qty },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      const qtyText = qty ? `${qty} ədəd` : "Bütün";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Məhsul silindi",
        waiterName,
        details: `${qtyText} ${productName || 'Məhsul'} - ${reasonName || 'Səbəb yoxdur'}`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const mergeChecks = createAsyncThunk(
  "orders/merge-check",
  async ({ currentOrderId, newOrderId, currentCheckId, newCheckId, currentTotal, newTotal, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${currentOrderId}/merge-orders`,
        { newOrderId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId: currentOrderId,
        action: "Çeklər birləşdirildi",
        waiterName,
        details: `Çek #${currentCheckId} (${currentTotal || 0}₼) + Çek #${newCheckId} (${newTotal || 0}₼) = ${(Number(currentTotal || 0) + Number(newTotal || 0)).toFixed(2)}₼`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const changeSaleType = createAsyncThunk(
  "orders/change-saletype",
  async ({ orderId, saleType, tableId, hallId, oldTypeName, newTypeName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/change-saletype`,
        { saleType, tableId, hallId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Satış növü dəyişildi",
        waiterName,
        details: `Növ dəyişdirildi: ${oldTypeName || '?'} ➔ ${newTypeName || '?'}`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const changeWaiter = createAsyncThunk(
  "orders/waiters",
  async ({ orderId, waiterId, oldWaiterName, newWaiterName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-waiter`,
        { waiterId },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Ofisiant dəyişildi",
        waiterName,
        details: `Məsul şəxs: ${oldWaiterName || '?'} ➔ ${newWaiterName || '?'}`
      }));

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
  async ({ data, profileId, profile, hallData, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${profileId}/split-order`,
        { data, profile, hallData },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";

      const sourceOrderId = data?.orderId || profileId;
      const items = data?.items || [];
      const itemNames = items.map(i => `${i.qty} ədəd (ID:${i.id})`).join(', ');
      const destTable = data?.table?.name || data?.table?.number || '';
      const destHall = data?.table?.hall_name || '';
      const salesType = data?.salesType === 'dine_in' ? 'Yerində' : data?.salesType === 'takeaway' ? 'Takeaway' : data?.salesType === 'delivery' ? 'Çatdırılma' : data?.salesType;

      let details = `Köçürüldü: ${itemNames}`;
      if (destTable) {
        details += ` → [${destHall}] ${destTable}`;
      } else {
        details += ` → ${salesType}`;
      }

      // Log to source order
      thunkAPI.dispatch(saveLog({
        orderId: sourceOrderId,
        action: "Məhsul köçürüldü",
        waiterName,
        details
      }));

      // Log to destination order
      if (response.data?.data?.newOrder?.uuid) {
        thunkAPI.dispatch(saveLog({
          orderId: response.data.data.newOrder.uuid,
          action: "Məhsul qəbul edildi",
          waiterName,
          details: `Köçürmədən gəldi: ${itemNames}`
        }));
      }

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const assignCustomerToOrder = createAsyncThunk(
  "orders/assign-customer",
  async ({ orderId, customerId, customerName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/assign-customer`,
        { customer_id: customerId },
      );

      // Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: customerId ? "Müştəri təyin edildi" : "Müştəri silindi",
        waiterName,
        details: customerName || '-'
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const giftItem = createAsyncThunk(
  "orders/gift",
  async ({ orderId, itemId, qty, isGift, productName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/gift-item`,
        { itemId, qty, isGift },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: isGift ? "Hədiyyə verildi" : "Hədiyyə ləğv edildi",
        waiterName,
        details: `${productName || 'Məhsul'} - ${qty} ədəd`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateItemDiscount = createAsyncThunk(
  "orders/itemDiscount",
  async ({ orderId, itemId, productId, discountValue, discountType, productName, waiterName: passedWaiterName }, thunkAPI) => {
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
          discount_percentage: discountType === 'percent' ? parseFloat(discountValue) : 0,
          discount_amount: discountType === 'amount' ? parseFloat(discountValue) : 0,
        },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      const discountText = discountType === 'percent' ? `${discountValue}%` : `${discountValue}₼`;
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Məhsula endirim",
        waiterName,
        details: `${productName || 'Məhsul'} - ${discountText}`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const deleteCheck = createAsyncThunk(
  "orders/deleteCheck",
  async ({ orderId, reason, reasonText, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/delete-check`,
        { reason },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Çek silindi",
        waiterName,
        details: `Səbəb: ${reasonText || reason}`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateItemPrice = createAsyncThunk(
  "orders/updateItemPrice",
  async ({ orderId, itemId, newPrice, oldPrice, productName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-price`,
        { itemId, newPrice },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Qiymət dəyişdirildi",
        waiterName,
        details: `${productName || 'Məhsul'}: ${oldPrice}₼-dən ${newPrice}₼-ə dəyişdi`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateItemCount = createAsyncThunk(
  "orders/updateItemCount",
  async ({ orderId, itemId, newCount, oldCount, productName, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/update-count`,
        { itemId, newCount },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Miqdar dəyişdirildi",
        waiterName,
        details: `${productName || 'Məhsul'}: ${oldCount}-dən ${newCount}-ə dəyişdi`
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const closeOrder = createAsyncThunk(
  "orders/close",
  async ({ orderId, payments, status, profileId, waiterId, note, is_tax, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/close`,
        { payments, status, profileId, waiterId, note, is_tax },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";

      const isUnpaid = payments.some(p => p.without_payment_method_id);
      const paymentDetails = payments.map(p => {
        const methodPrefix = p.name || (p.without_payment_method_id ? "Ödənişsiz" : (p.type || 'Ödəniş'));
        return `${methodPrefix}: ${p.amount} ₼`;
      }).join(', ');

      thunkAPI.dispatch(saveLog({
        orderId,
        action: isUnpaid ? "Ödənişsiz bağlandı" : "Ödəniş edildi",
        waiterName,
        details: paymentDetails || (note ? `Bağlandı: ${note}` : "Sifariş bağlandı")
      }));

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
      const response = await axios.get(
        `/orders-items/${orderId}/logs`
      );
      // Map snake_case to camelCase for consistent filtering
      return response.data.map(log => ({
        ...log,
        orderId: log.order_id,
        waiterName: log.waiter_name
      }));
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
);

export const saveLog = createAsyncThunk(
  "orders/saveLog",
  async ({ orderId, action, waiterName, details }, thunkAPI) => {
    try {
      const response = await axios.post(
        `/orders-items/${orderId}/logs`,
        { action, waiterName, details }
      );
      // Map snake_case to camelCase
      return {
        ...response.data,
        orderId: response.data.order_id,
        waiterName: response.data.waiter_name
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
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
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: status ? "Qəbz kilidləndi" : "Qəbz açıldı",
        waiterName,
        details: status ? "Çek üzərində əməliyyatlar dayandırıldı" : "Çek yenidən aktiv edildi"
      }));

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
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Şərh yazıldı",
        waiterName,
        details: comments ? `Şərh: ${comments}` : "Şərh silindi"
      }));

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
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Qəbz təmizləndi",
        waiterName,
        details: "Bütün sifarişlər silindi"
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const updateDepositOnOrders = createAsyncThunk(
  "orders/updateDeposit",
  async ({ orderId, depositValue, depositType, oldDepositValue, waiterName: passedWaiterName }, thunkAPI) => {
    try {
      const response = await axios.patch(
        `/orders-items/${orderId}/deposit`,
        { depositValue, depositType },
      );

      // Persistent Log
      const state = thunkAPI.getState();
      const waiterName = passedWaiterName || state.WaitersSlice?.loginedWaiter?.data?.name || state.WaitersSlice?.loginedWaiter?.name || state.LoginSlice?.loginedProfileData?.data?.profile?.name || "Naməlum";
      const oldValue = oldDepositValue ? `${oldDepositValue} ₼` : '0 ₼';
      const newValue = `${depositValue} ₼`;
      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Depozit dəyişildi",
        waiterName,
        details: `${oldValue}-dən ${newValue}-ə dəyişdi`
      }));

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
        `/orders-items/${orderId}/increment-print-count`
      );

      thunkAPI.dispatch(saveLog({
        orderId,
        action: "Ön çap çıxarıldı",
        waiterName,
        details: "Müştəri çeki çap edildi"
      }));

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  }
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
    addProducts: (state, action) => {
      const incomingProduct = action.payload;

      state.products.push({
        ...incomingProduct,
        quantity: 1,
        newOrder: 1,
        price: parseFloat(incomingProduct.price)
      });
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
    },

    updateCount: (state, action) => {
      const { productId, count, price, name } = action.payload;
      const existingProductIndex = state.products.findIndex(
        (product) => {
          const p1 = Number(product.price || 0).toFixed(2);
          const p2 = Number(price || 0).toFixed(2);
          return product.id === productId && (!price || p1 === p2);
        }
      );

      if (existingProductIndex !== -1) {
        if (count <= 0) {
          state.products.splice(existingProductIndex, 1);
        } else {
          state.products[existingProductIndex].quantity = count;
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
        time: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }),
        ...action.payload
      };
      state.orderLogs.push(newLog);
    }
  },
  extraReducers: (builder) => {
    builder
      // Log Sending Orders
      .addCase(sendOrdersItems.fulfilled, (state, action) => {
        state.loading = false;
        state.products = [];
        state.sentProducts = [];
      })
      .addCase(getTableGroups.fulfilled, (state, action) => {
        state.sentProducts = [];
        state.pendingDeletions = [];
      })
      .addCase(getActiveOrders.fulfilled, (state, action) => {
        state.sentProducts = [];
        state.pendingDeletions = [];
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
          state.pendingDeletions = state.pendingDeletions.filter(item => Number(item.itemId) !== Number(itemId));
        }
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
        if (state.currentOrder && state.currentOrder.uuid === action.meta.arg.orderId) {
          state.currentOrder.print_count = action.payload.print_count;
        }
      });
  },
});

export const {
  addProducts,
  removeProduct,
  sendOrders,
  clearOrders,
  updateCount,
  addPendingDeletion,
  clearPendingDeletions,
  addLog,
  menuData
} = OrderSlice.actions;

export default OrderSlice.reducer;


