import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";

export const getActiveOrders = createAsyncThunk(
  "pos/active-orders",
  async ({ profileId, id, sale_type, waiter_id, hall_id, table_id, courier_id, silentRefresh }, thunkAPI) => {
    try {
      let effectiveWaiterId = waiter_id;
      const loginedWaiter = thunkAPI.getState()?.WaitersSlice?.loginedWaiter;
      if (Number(loginedWaiter?.data?.can_edit_all_checks) === 1 && loginedWaiter?.data?.id) {
        effectiveWaiterId = loginedWaiter.data.id;
      }
      let url = `/orders/${profileId}/all-checks`;
      const params = new URLSearchParams();
      if (id) params.append("id", id);
      if (sale_type) params.append("sale_type", sale_type);
      if (effectiveWaiterId) params.append("waiter_id", effectiveWaiterId);
      if (hall_id) params.append("hall_id", hall_id);
      if (table_id) params.append("table_id", table_id);
      if (courier_id) params.append("courier_id", courier_id);

      const response = await axios.get(url, { params });

      return response.data;
    } catch (error) {
      thunkAPI.rejectWithValue(error?.response.data);
    }
  },
);

export const getArchivedOrders = createAsyncThunk(
  "pos/archived-orders",
  async ({ profileId, type, date, id, sale_type, waiter_id, hall_id, table_id, courier_id }, thunkAPI) => {
    try {
      let effectiveWaiterId = waiter_id;
      const loginedWaiter = thunkAPI.getState()?.WaitersSlice?.loginedWaiter;
      if (Number(loginedWaiter?.data?.can_edit_all_checks) === 1 && loginedWaiter?.data?.id) {
        effectiveWaiterId = loginedWaiter.data.id;
      }
      let url = `/orders/${profileId}/archived-checks?type=${type}`;
      if (date) url += `&date=${date}`;
      if (id) url += `&id=${id}`;
      if (sale_type) url += `&sale_type=${sale_type}`;
      if (effectiveWaiterId) url += `&waiter_id=${effectiveWaiterId}`;
      if (hall_id) url += `&hall_id=${hall_id}`;
      if (table_id) url += `&table_id=${table_id}`;
      if (courier_id) url += `&courier_id=${courier_id}`;
      const response = await axios.get(url);

      return response.data;
    } catch (error) {
      thunkAPI.rejectWithValue(error?.response.data);
    }
  },
);

const BooksSlice = createSlice({
  name: "books",
  initialState: {
    books: {},
    archivedBooks: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    deletedOrderIds: [],
  },
  reducers: {
    removeOrderOptimistic: (state, action) => {
      const orderId = action.payload;
      if (!orderId) return;
      if (!state.deletedOrderIds.includes(String(orderId))) {
        state.deletedOrderIds.push(String(orderId));
      }
      if (Array.isArray(state.books)) {
        state.books = state.books.filter(
          (o) => String(o.uuid) !== String(orderId) && String(o.id) !== String(orderId)
        );
      } else if (state.books && Array.isArray(state.books.data)) {
        state.books.data = state.books.data.filter(
          (o) => String(o.uuid) !== String(orderId) && String(o.id) !== String(orderId)
        );
      }
    },
    clearDeletedOrderId: (state, action) => {
      const orderId = String(action.payload);
      state.deletedOrderIds = state.deletedOrderIds.filter(id => id !== orderId);
    },
    addOrderOptimistic: (state, action) => {
      const newOrder = action.payload;
      if (Array.isArray(state.books)) {
        state.books.unshift(newOrder);
      } else if (state.books && Array.isArray(state.books.data)) {
        state.books.data.unshift(newOrder);
      } else {
        state.books = { data: [newOrder] };
      }
    },
    updateOrderOptimisticId: (state, action) => {
      const { uuid, newOrderData } = action.payload;
      if (!uuid || !newOrderData) return;
      const updateList = (list) => {
        const index = list.findIndex(o => String(o.uuid) === String(uuid));
        if (index !== -1) {
          list[index] = { ...list[index], ...newOrderData };
        }
      };
      if (Array.isArray(state.books)) updateList(state.books);
      else if (state.books && Array.isArray(state.books.data)) updateList(state.books.data);
    },
    // Məhsul ödənişi ləğvi: silmə sorğusu uğurlu olan kimi dərhal UI-dan çıxar —
    // sonrakı fon yeniləməsi (silentRefresh) yarışa düşüb köhnə datanı geri qaytarsa belə görünməsin
    removeItemPaymentBatchOptimistic: (state, action) => {
      const { orderUuid, batchUuid } = action.payload || {};
      if (!orderUuid || !batchUuid) return;
      const updateList = (list) => {
        const order = list.find(o => String(o.uuid) === String(orderUuid));
        if (order && Array.isArray(order.item_payments)) {
          order.item_payments = order.item_payments.filter(p => String(p.batch_uuid) !== String(batchUuid));
        }
      };
      if (Array.isArray(state.books)) updateList(state.books);
      else if (state.books && Array.isArray(state.books.data)) updateList(state.books.data);
    },
    tickTimer: (state) => {
      // Diqqət: yalnız taymeri aktiv olan sifarişləri draft üzərində birbaşa
      // dəyişdiririk (yeni array/obyekt yaratmırıq) — əks halda hər saniyə
      // BÜTÜN siyahının reference-i dəyişir və ona bağlı hər komponent
      // taymer olmasa belə yenidən render olunur (çeklər çoxaldıqca ağırlaşır)
      const list = Array.isArray(state.books)
        ? state.books
        : state.books && Array.isArray(state.books.data)
          ? state.books.data
          : null;
      if (!list || list.length === 0) return;

      for (const order of list) {
        if (Number(order.is_timer_status) !== 1) continue;

        const effH = (() => {
          const th = Number(order.table?.hourly_price || 0);
          let s = 0;
          (order.orders_items || []).forEach((it) => {
            const hp = Number(it.product?.hourly_price || 0);
            if (hp > 0) s += hp * Number(it.count || 0);
          });
          return s > 0 ? s : th;
        })();

        let totalSeconds = 0;
        if (order.is_timer_clock && String(order.is_timer_clock).includes(':')) {
          const parts = order.is_timer_clock.split(':').map(Number);
          if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
          totalSeconds = parseInt(order.is_timer_clock || '0', 10);
        }

        totalSeconds += 1;

        const hh = Math.floor(totalSeconds / 3600);
        const mm = Math.floor((totalSeconds % 3600) / 60);
        const ss = totalSeconds % 60;

        order.orders_items = order.orders_items || [];
        order.is_timer_clock = [hh, mm, ss].map(v => v < 10 ? "0" + v : v).join(":");
        order.rate_per_minute = parseFloat(((effH / 3600) * totalSeconds).toFixed(2));
        order.is_active_timer = 1;
      }
    }
  },
  extraReducers: (builder) => {
    // getActiveOrders
    builder.addCase(getActiveOrders.pending, (state, action) => {
      if (!action.meta?.arg?.silentRefresh) {
        state.status = 'loading';
      }
    });
    builder.addCase(getActiveOrders.fulfilled, (state, action) => {
      state.status = 'succeeded';
      const deletedIds = state.deletedOrderIds || [];
      if (deletedIds.length > 0) {
        const filterOrders = (list) => list.filter(o => {
          const oId = String(o.uuid || o.id);
          return !deletedIds.includes(oId);
        });
        const payload = action.payload;
        if (Array.isArray(payload)) {
          state.books = filterOrders(payload);
        } else if (payload && Array.isArray(payload.data)) {
          state.books = { ...payload, data: filterOrders(payload.data) };
        } else {
          state.books = payload;
        }
      } else {
        state.books = action.payload;
      }
    });
    builder.addCase(getActiveOrders.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    });

    // sendOrdersItems fulfilled — server tam order qaytarır, birbaşa books-da yenilə
    builder.addCase("pos/orders/fulfilled", (state, action) => {
      const updatedOrder = action.payload;
      if (!updatedOrder?.uuid) return;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(updatedOrder.uuid));
      if (idx !== -1) {
        ordersList[idx] = updatedOrder;
      }
    });

    // changeSaleType fulfilled — books-da order-i dərhal yenilə və ya əlavə et
    builder.addCase("orders/change-saletype/fulfilled", (state, action) => {
      const updatedOrder = action.payload?.data;
      if (!updatedOrder?.uuid) return;
      if (Array.isArray(state.books)) {
        const idx = state.books.findIndex(o => String(o.uuid) === String(updatedOrder.uuid));
        if (idx !== -1) state.books[idx] = updatedOrder;
        else state.books.unshift(updatedOrder);
      } else if (Array.isArray(state.books?.data)) {
        const idx = state.books.data.findIndex(o => String(o.uuid) === String(updatedOrder.uuid));
        if (idx !== -1) state.books.data[idx] = updatedOrder;
        else state.books.data.unshift(updatedOrder);
      }
    });



    // getArchivedOrders
    builder.addCase(getArchivedOrders.pending, (state) => {
      state.status = 'loading';
    });
    builder.addCase(getArchivedOrders.fulfilled, (state, action) => {
      state.status = 'succeeded';
      state.archivedBooks = action.payload.data || [];
    });
    builder.addCase(getArchivedOrders.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    });

    // Optimistic service fee update — servis haqqı dərhal hesablansın
    builder.addCase("pos/serviceFee/pending", (state, action) => {
      const { orderId, serviceValue, feeType } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        ordersList[idx] = {
          ...ordersList[idx],
          service_value: serviceValue,
          service_type: feeType,
        };
      }
    });

    // Service fee fulfilled — server tam hesablanmış service_charge ilə qaytarır
    builder.addCase("pos/serviceFee/fulfilled", (state, action) => {
      const updatedOrder = action.payload;
      if (!updatedOrder?.uuid) return;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(updatedOrder.uuid));
      if (idx !== -1) {
        ordersList[idx] = { ...ordersList[idx], ...updatedOrder };
      }
    });

    // Optimistic deposit update
    builder.addCase("orders/updateDeposit/pending", (state, action) => {
      const { orderId, depositValue } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        ordersList[idx] = {
          ...ordersList[idx],
          deposit: depositValue,
        };
      }
    });

    // Deposit fulfilled
    builder.addCase("orders/updateDeposit/fulfilled", (state, action) => {
      const updatedOrder = action.payload;
      if (!updatedOrder?.uuid) return;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(updatedOrder.uuid));
      if (idx !== -1) {
        ordersList[idx] = { ...ordersList[idx], ...updatedOrder };
      }
    });


    // Optimistic discount update — discount dərhal hesablansın
    builder.addCase("pos/discount/pending", (state, action) => {
      const { orderId, discountValue, discountType } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        ordersList[idx] = {
          ...ordersList[idx],
          discount_value: discountValue,
          discount_type: discountType,
        };
      }
    });

    // Optimistic customer assign — müştəri dərhal görsənsin
    builder.addCase("orders/assign-customer/pending", (state, action) => {
      const { orderId, customerId, customerName } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        ordersList[idx] = {
          ...ordersList[idx],
          customer_id: customerId || null,
          customer_name: customerName || null,
        };
      }
    });

    // Optimistic courier assign
    builder.addCase("orders/assign-courier/pending", (state, action) => {
      const { orderId, courierId, deliveryFee } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        ordersList[idx] = {
          ...ordersList[idx],
          courier_id: courierId || null,
          delivery_fee: deliveryFee || 0,
        };
      }
    });

    // Optimistic timer start
    builder.addCase("orders/startTimer/pending", (state, action) => {
      const { orderId, itemId } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        const order = ordersList[idx];
        if (itemId && order.orders_items) {
          const itemIdx = order.orders_items.findIndex(i => i.id === itemId);
          if (itemIdx !== -1) {
            order.orders_items[itemIdx].is_timer_status = 1;
            order.orders_items[itemIdx].timer_last_started_at = new Date().toISOString();
          }
        } else if (!itemId) {
          order.is_timer_status = 1;
          order.is_active_timer = 1;
        }
      }
    });

    // Optimistic timer stop
    builder.addCase("orders/stopTimer/pending", (state, action) => {
      const { orderId, itemId, clockStr } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        const order = ordersList[idx];
        if (itemId && order.orders_items) {
          const itemIdx = order.orders_items.findIndex(i => i.id === itemId);
          if (itemIdx !== -1) {
            order.orders_items[itemIdx].is_timer_status = 0;
            if (clockStr) order.orders_items[itemIdx].is_timer_clock = clockStr;
          }
        } else if (!itemId) {
          order.is_timer_status = 0;
          order.is_active_timer = 0;
          if (clockStr) order.is_timer_clock = clockStr;
        }
      }
    });

    // Optimistic timer reset
    builder.addCase("orders/resetTimer/pending", (state, action) => {
      const { orderId, itemId } = action.meta.arg;
      let ordersList = Array.isArray(state.books) ? state.books : state.books?.data;
      if (!ordersList) return;
      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        const order = ordersList[idx];
        if (itemId && order.orders_items) {
          const itemIdx = order.orders_items.findIndex(i => i.id === itemId);
          if (itemIdx !== -1) {
            order.orders_items[itemIdx].is_timer_status = 0;
            order.orders_items[itemIdx].is_timer_clock = "00:00:00";
          }
        } else if (!itemId) {
          order.is_timer_status = 0;
          order.is_active_timer = 0;
          order.is_timer_clock = "00:00:00";
          order.rate_per_minute = 0;
        }
      }
    });

    // Müştəri çeki çap edəndə print_count dərhal yenilənsin (optimistic + fulfilled)
    builder.addCase("orders/incrementPrintCount/pending", (state, action) => {
      const orderId = action.meta?.arg?.orderId;
      if (!orderId) return;

      let ordersList = null;
      if (Array.isArray(state.books)) ordersList = state.books;
      else if (state.books?.data) ordersList = state.books.data;
      if (!ordersList) return;

      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1) {
        const current = ordersList[idx].print_count || 0;
        ordersList[idx] = { ...ordersList[idx], print_count: current + 1 };
      }
    });
    builder.addCase("orders/incrementPrintCount/fulfilled", (state, action) => {
      const orderId = action.meta?.arg?.orderId;
      const updatedOrder = action.payload?.data;
      const newPrintCount = updatedOrder?.print_count;
      if (!orderId) return;

      let ordersList = null;
      if (Array.isArray(state.books)) ordersList = state.books;
      else if (state.books?.data) ordersList = state.books.data;
      if (!ordersList) return;

      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx !== -1 && newPrintCount !== undefined) {
        ordersList[idx] = { ...ordersList[idx], print_count: newPrintCount };
      }
    });

    // Remove from archive when reopened
    builder.addCase("orders/reopen/fulfilled", (state, action) => {
      const reopenedOrderId = action.meta.arg.orderId;
      state.archivedBooks = state.archivedBooks.filter(o => o.uuid !== reopenedOrderId);
    });

    // Handle delete-item specifically: optimistically remove from orders_items
    builder.addCase("orders/delete-item/fulfilled", (state, action) => {
      const { orderId, itemId, qty } = action.meta.arg;
      let ordersList = null;
      if (Array.isArray(state.books)) ordersList = state.books;
      else if (state.books?.data) ordersList = state.books.data;
      if (!ordersList) return;

      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx === -1) return;

      const order = ordersList[idx];
      if (!order.orders_items) return;

      if (qty && qty > 0) {
        // Partial delete — reduce count
        const itemIdx = order.orders_items.findIndex(i => Number(i.id) === Number(itemId));
        if (itemIdx !== -1) {
          const newCount = Number(order.orders_items[itemIdx].count) - qty;
          if (newCount <= 0) {
            ordersList[idx] = { ...order, orders_items: order.orders_items.filter((_, i) => i !== itemIdx) };
          } else {
            const newItems = [...order.orders_items];
            newItems[itemIdx] = { ...newItems[itemIdx], count: newCount };
            ordersList[idx] = { ...order, orders_items: newItems };
          }
        }
      } else {
        // Full delete
        ordersList[idx] = {
          ...order,
          orders_items: order.orders_items.filter(i => Number(i.id) !== Number(itemId))
        };
      }
    });

    // Handle batch delete: remove all deleted items from orders_items
    builder.addCase("orders/batch-delete-items/fulfilled", (state, action) => {
      const { orderId, items } = action.meta.arg;
      if (!orderId || !items?.length) return;

      let ordersList = null;
      if (Array.isArray(state.books)) ordersList = state.books;
      else if (state.books?.data) ordersList = state.books.data;
      if (!ordersList) return;

      const idx = ordersList.findIndex(o => String(o.uuid) === String(orderId));
      if (idx === -1) return;

      const order = ordersList[idx];
      if (!order.orders_items) return;

      let updatedItems = [...order.orders_items];
      for (const { itemId, qty } of items) {
        if (qty && qty > 0) {
          const itemIdx = updatedItems.findIndex(i => Number(i.id) === Number(itemId));
          if (itemIdx !== -1) {
            const newCount = Number(updatedItems[itemIdx].count) - qty;
            if (newCount <= 0) {
              updatedItems = updatedItems.filter((_, i) => i !== itemIdx);
            } else {
              updatedItems = [...updatedItems];
              updatedItems[itemIdx] = { ...updatedItems[itemIdx], count: newCount };
            }
          }
        } else {
          updatedItems = updatedItems.filter(i => Number(i.id) !== Number(itemId));
        }
      }
      ordersList[idx] = { ...order, orders_items: updatedItems };
    });

    // Qəbz etiketi: köhnə API yalnız { message } qaytarırdı — books-da order yenilənmirdi; meta.arg ilə sinxron
    builder.addCase("orders/updateTags/fulfilled", (state, action) => {
      const orderId = action.meta?.arg?.orderId;
      const tags = action.meta?.arg?.tags;
      if (orderId === undefined || orderId === null) return;

      let ordersList = null;
      if (Array.isArray(state.books)) ordersList = state.books;
      else if (state.books?.data) ordersList = state.books.data;
      if (!ordersList) return;

      const idx = ordersList.findIndex(
        (o) => o.uuid === orderId || String(o.uuid) === String(orderId)
      );
      if (idx !== -1) {
        ordersList[idx] = { ...ordersList[idx], tags };
      }
    });

    // Handle deleteCheck OR closeOrder fulfilled to remove from books
    builder.addMatcher(
      (action) =>
        action.type === "orders/deleteCheck/fulfilled" ||
        action.type === "orders/close/fulfilled",
      (state, action) => {
        const orderId = action.meta.arg?.orderId;
        if (!orderId) return;

        if (Array.isArray(state.books)) {
          state.books = state.books.filter(o => o.uuid !== orderId && o.id !== orderId && String(o.uuid) !== String(orderId));
        } else if (state.books && Array.isArray(state.books.data)) {
          state.books.data = state.books.data.filter(o => o.uuid !== orderId && o.id !== orderId && String(o.uuid) !== String(orderId));
        }
      }
    );

    builder.addMatcher(
      (action) =>
        action.type === "orders/gift/fulfilled" ||
        action.type === "orders/itemDiscount/fulfilled" ||
        action.type === "pos/orders/fulfilled" ||
        action.type === "orders/lockCheck/fulfilled" ||
        action.type === "orders/lock-check/fulfilled" ||
        action.type === "orders/updateItemPrice/fulfilled" ||
        action.type === "orders/updateItemCount/fulfilled" ||
        action.type === "orders/assign-customer/fulfilled" ||
        action.type === "orders/assign-courier/fulfilled" ||
        action.type === "orders/updateDeposit/fulfilled" ||
        action.type === "orders/updateComments/fulfilled" ||
        action.type === "orders/updateTags/fulfilled" ||
        action.type === "orders/serviceFee/fulfilled" ||
        action.type === "pos/discount/fulfilled" ||
        action.type === "orders/change-saletype/fulfilled" ||
        action.type === "orders/waiters/fulfilled" ||
        action.type === "orders/split/fulfilled" ||
        action.type === "orders/startTimer/fulfilled" ||
        action.type === "orders/stopTimer/fulfilled" ||
        action.type === "orders/resetTimer/fulfilled" ||
        action.type === "pos/sales/fulfilled" ||
        action.type === "pos/otherorderS/fulfilled",
      (state, action) => {
        const payload = action.payload?.data || action.payload;
        if (!payload) return;

        // Handle possible multiple orders (e.g., from split/transfer)
        const ordersToUpdate = [];
        if (payload.originalOrder) ordersToUpdate.push(payload.originalOrder);
        if (payload.newOrder) ordersToUpdate.push(payload.newOrder);
        if (!payload.originalOrder && !payload.newOrder && (payload.uuid || payload.id)) {
          ordersToUpdate.push(payload);
        }

        if (ordersToUpdate.length === 0) return;

        // Determine where the list is
        let ordersList = null;
        if (Array.isArray(state.books)) {
          ordersList = state.books;
        } else if (state.books && Array.isArray(state.books.data)) {
          ordersList = state.books.data;
        }

        if (ordersList) {
          ordersToUpdate.forEach(updatedOrder => {
            const targetId = updatedOrder.uuid || updatedOrder.id;
            const index = ordersList.findIndex(
              (o) => o.uuid === targetId || o.id === targetId || String(o.uuid) === String(targetId)
            );
            if (index !== -1) {
              ordersList[index] = { ...ordersList[index], ...updatedOrder };
            } else if (
              (payload.newOrder && updatedOrder === payload.newOrder) ||
              action.type === "pos/sales/fulfilled" ||
              action.type === "pos/otherorderS/fulfilled"
            ) {
              // If it's a completely new order (from split to new order, or new sales type), add it to the list
              ordersList.unshift(updatedOrder);
            }
          });
        }
      },
    );
  },
});

export const { removeOrderOptimistic, addOrderOptimistic, updateOrderOptimisticId, removeItemPaymentBatchOptimistic, tickTimer, clearDeletedOrderId: clearDeletedOrderIdBooks } = BooksSlice.actions;
export default BooksSlice.reducer;


