import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/apiConfig";
import axiosRaw from "axios";
import { getEffectiveHourlyPrice } from "../../utils/orderHourlyPrice";

const ADMIN_API = "https://api.unipos.tech/api";

export const loadLayoutsFromAdmin = createAsyncThunk(
  "tables/loadLayoutsFromAdmin",
  async (profile_id, thunkAPI) => {
    try {
      const res = await axiosRaw.get(`${ADMIN_API}/table-layouts`, { params: { profile_id }, timeout: 8000 });
      return res.data || {};
    } catch {
      return {};
    }
  }
);

export const getTableGroups = createAsyncThunk(
  "tables/getTableGroups",
  async (profileId, thunkAPI) => {
    try {
      let url = `/tables/${profileId}`;
      const loginedWaiter = thunkAPI.getState()?.WaitersSlice?.loginedWaiter;
      if (Number(loginedWaiter?.data?.can_edit_all_checks) === 1 && loginedWaiter?.data?.id) {
        url += `?waiter_id=${loginedWaiter.data.id}`;
      }
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  },
);

const TablesSlice = createSlice({
  name: "tables",
  initialState: {
    tableGroups: {},
    currentHallId: null,
    isTablesLoading: true,
    isTableEditMode: false,
    hallOrder: JSON.parse(localStorage.getItem("pos_hall_order") || "[]"),
    tableOrder: JSON.parse(localStorage.getItem("pos_table_orders") || "{}"),
    tableLayouts: JSON.parse(localStorage.getItem("pos_table_layouts") || "{}"),
    tempHallOrder: [],
    tempTableOrder: {},
    tempTableLayouts: {},
  },
  reducers: {
    currentTableList: (state, action) => {
      state.currentHallId = action.payload.hallId;
    },
    startEditMode: (state) => {
      state.isTableEditMode = true;
      state.tempHallOrder = [...state.hallOrder];
      state.tempTableOrder = { ...state.tableOrder };
      state.tempTableLayouts = { ...state.tableLayouts };
    },
    cancelEditMode: (state) => {
      state.isTableEditMode = false;
      state.tempHallOrder = [];
      state.tempTableOrder = {};
    },
    saveEditMode: (state) => {
      state.isTableEditMode = false;
      state.hallOrder = [...state.tempHallOrder];
      state.tableOrder = { ...state.tempTableOrder };
      state.tableLayouts = { ...state.tempTableLayouts };
      localStorage.setItem("pos_hall_order", JSON.stringify(state.hallOrder));
      localStorage.setItem("pos_table_orders", JSON.stringify(state.tableOrder));
      localStorage.setItem("pos_table_layouts", JSON.stringify(state.tableLayouts));
      state.tempHallOrder = [];
      state.tempTableOrder = {};
      state.tempTableLayouts = {};
    },
    setTempHallOrder: (state, action) => {
      state.tempHallOrder = action.payload;
    },
    setTempTableOrder: (state, action) => {
      const { hallId, order } = action.payload;
      state.tempTableOrder[hallId] = order;
    },
    setTempTableLayout: (state, action) => {
      const { hallId, layout } = action.payload;
      // Merge with existing layout for that hall
      state.tempTableLayouts[hallId] = {
        ...(state.tempTableLayouts[hallId] || {}),
        ...layout
      };
    },
    removeOrderOptimistic: (state, action) => {
      const orderId = action.payload;
      if (!orderId || !state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (hall.tables) {
          hall.tables.forEach((table) => {
            if (table.orders) {
              table.orders = table.orders.filter(
                (o) => String(o.uuid) !== String(orderId) && String(o.id) !== String(orderId)
              );
            }
          });
        }
      });
    },
    addOrderToTableOptimistic: (state, action) => {
      const { order, tableId } = action.payload;
      if (!order || !tableId || !state.tableGroups?.data) return;
      for (const hall of state.tableGroups.data) {
        const table = hall.tables?.find((t) => t.id == tableId);
        if (table) {
          if (!table.orders) table.orders = [];
          table.orders.unshift(order);
          break;
        }
      }
    },
    tickTimer: (state) => {
      if (!state.tableGroups?.data) return;
      state.tableGroups.data = state.tableGroups.data.map((hall) => {
        if (!hall.tables) return hall;
        const newTables = hall.tables.map((table) => {
          if (!table.orders || table.orders.length === 0) return table;

          const newOrders = table.orders.map((order) => {
            if (order.is_timer_status !== 1) return order;

            const orderForEff = {
              ...order,
              table: { ...(order.table || {}), hourly_price: table.hourly_price },
              orders_items: order.orders_items || [],
            };
            const effH = getEffectiveHourlyPrice(orderForEff);
            if (effH <= 0) return order;

            let totalSeconds = 0;
            if (order.is_timer_clock && String(order.is_timer_clock).includes(":")) {
              const parts = order.is_timer_clock.split(":").map(Number);
              if (parts.length === 3) {
                totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }
            } else {
              totalSeconds = parseInt(order.is_timer_clock || "0", 10);
            }

            totalSeconds += 1;

            const hh = Math.floor(totalSeconds / 3600);
            const mm = Math.floor((totalSeconds % 3600) / 60);
            const ss = totalSeconds % 60;
            const clockStr = [hh, mm, ss].map((v) => (v < 10 ? "0" + v : v)).join(":");

            const charge = parseFloat(((effH / 3600) * totalSeconds).toFixed(2));

            return {
              ...order,
              is_timer_clock: clockStr,
              rate_per_minute: charge,
              is_active_timer: 1,
            };
          });

          const anyChanged = newOrders.some((no, i) => no !== table.orders[i]);
          if (anyChanged) {
            return { ...table, orders: newOrders };
          }
          return table;
        });

        const anyTableChanged = newTables.some((nt, i) => nt !== hall.tables[i]);
        if (anyTableChanged) {
          return { ...hall, tables: newTables };
        }
        return hall;
      });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadLayoutsFromAdmin.fulfilled, (state, action) => {
      const adminLayouts = action.payload;
      if (!adminLayouts || Object.keys(adminLayouts).length === 0) return;
      // Merge: admin layouts override localStorage only for halls that have data
      const merged = { ...state.tableLayouts };
      Object.entries(adminLayouts).forEach(([hallId, layout]) => {
        if (layout && Object.keys(layout).length > 0) {
          merged[hallId] = layout;
        }
      });
      state.tableLayouts = merged;
      state.tempTableLayouts = {};
      localStorage.setItem("pos_table_layouts", JSON.stringify(merged));
    });

    builder.addCase(getTableGroups.pending, (state) => {
      if (!state.tableGroups?.data || state.tableGroups.data.length === 0) {
        state.isTablesLoading = true;
      }
    });
    builder.addCase(getTableGroups.fulfilled, (state, action) => {
      state.isTablesLoading = false;
      const payload = action.payload;
      if (payload?.data) {
        state.tableGroups = {
          ...payload,
          data: payload.data.map(hall => ({
            ...hall,
            tables: hall.tables ? hall.tables.map(table => ({
              ...table,
              orders: table.orders ? table.orders.filter(o => o.status !== 3) : []
            })) : []
          }))
        };
      } else {
        state.tableGroups = payload;
      }

      // Set default hall if not set
      if (!state.currentHallId && state.tableGroups?.data?.length > 0) {
        state.currentHallId = state.tableGroups.data[0].id;
      }
    });
    builder.addCase(getTableGroups.rejected, (state) => {
      state.isTablesLoading = false;
    });

    // Optimistic timer start in tables
    builder.addCase("orders/startTimer/pending", (state, action) => {
      const { orderId } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            table.orders[idx] = { ...table.orders[idx], is_timer_status: 1, is_active_timer: 1 };
          }
        });
      });
    });

    // Optimistic timer stop in tables
    builder.addCase("orders/stopTimer/pending", (state, action) => {
      const { orderId, clockStr } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            table.orders[idx] = {
              ...table.orders[idx],
              is_timer_status: 0,
              is_active_timer: 0,
              is_timer_clock: clockStr || table.orders[idx].is_timer_clock,
            };
          }
        });
      });
    });

    // Optimistic timer reset in tables
    builder.addCase("orders/resetTimer/pending", (state, action) => {
      const { orderId } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            table.orders[idx] = {
              ...table.orders[idx],
              is_timer_status: 0,
              is_active_timer: 0,
              is_timer_clock: "00:00:00",
              rate_per_minute: 0,
            };
          }
        });
      });
    });

    builder.addCase("orders/split/fulfilled", (state, action) => {
      const inner = action.payload?.data || action.payload;
      const originalOrder = inner?.originalOrder;
      const newOrder = inner?.newOrder;
      if (!state.tableGroups?.data) return;

      const patchOrder = (orderData) => {
        if (!orderData?.uuid) return;
        const tid = orderData.uuid || orderData.id;
        state.tableGroups.data.forEach((hall) => {
          hall.tables?.forEach((table) => {
            if (!table.orders?.length) return;
            const idx = table.orders.findIndex(
              (o) => String(o.uuid) === String(tid) || o.id === tid,
            );
            if (idx !== -1) {
              table.orders[idx] = { ...table.orders[idx], ...orderData };
            }
          });
        });
      };

      if (originalOrder) patchOrder(originalOrder);

      if (newOrder?.uuid && newOrder.table_id != null) {
        const nu = newOrder.uuid || newOrder.id;
        state.tableGroups.data.forEach((hall) => {
          hall.tables?.forEach((table) => {
            if (Number(table.id) !== Number(newOrder.table_id)) return;
            if (!table.orders) table.orders = [];
            const idx = table.orders.findIndex(
              (o) => String(o.uuid) === String(nu) || o.id === nu,
            );
            if (idx !== -1) {
              table.orders[idx] = { ...table.orders[idx], ...newOrder };
            } else {
              table.orders.unshift(newOrder);
            }
          });
        });
      }
    });

    builder.addMatcher(
      (action) =>
        action.type === "orders/deleteCheck/fulfilled" ||
        action.type === "orders/close/fulfilled",
      (state, action) => {
        const orderId = action.meta.arg?.orderId;
        if (!orderId) return;

        if (state.tableGroups?.data) {
          state.tableGroups.data.forEach((hall) => {
            if (hall.tables) {
              hall.tables.forEach((table) => {
                if (table.orders) {
                  table.orders = table.orders.filter(
                    (o) => o.uuid !== orderId && o.id !== orderId && String(o.uuid) !== String(orderId)
                  );
                }
              });
            }
          });
        }
      },
    );

    builder.addMatcher(
      (action) =>
        action.type === "orders/startTimer/fulfilled" ||
        action.type === "orders/stopTimer/fulfilled" ||
        action.type === "orders/resetTimer/fulfilled" ||
        action.type === "orders/lockCheck/fulfilled" ||
        action.type === "orders/lock-check/fulfilled" ||
        action.type === "orders/gift/fulfilled" ||
        action.type === "orders/itemDiscount/fulfilled" ||
        action.type === "orders/delete-item/fulfilled" ||
        action.type === "orders/updateItemPrice/fulfilled" ||
        action.type === "orders/incrementPrintCount/fulfilled",
      (state, action) => {
        const updatedOrder = action.payload?.data || action.payload;
        if (!updatedOrder || (!updatedOrder.uuid && !updatedOrder.id)) return;

        if (state.tableGroups?.data) {
          state.tableGroups.data.forEach((hall) => {
            if (hall.tables) {
              hall.tables.forEach((table) => {
                if (table.orders) {
                  const targetId = updatedOrder.uuid || updatedOrder.id;
                  const index = table.orders.findIndex(
                    (o) => o.uuid === targetId || o.id === targetId || String(o.uuid) === String(targetId)
                  );
                  if (index !== -1) {
                    table.orders[index] = {
                      ...table.orders[index],
                      ...updatedOrder,
                    };
                  }
                }
              });
            }
          });
        }
      },
    );
  },
});

export const {
  currentTableList,
  startEditMode,
  cancelEditMode,
  saveEditMode,
  setTempHallOrder,
  setTempTableOrder,
  setTempTableLayout,
  tickTimer,
  removeOrderOptimistic: tablesRemoveOrderOptimistic,
  addOrderToTableOptimistic
} = TablesSlice.actions;
export { tablesRemoveOrderOptimistic as removeOrderOptimisticFromTables };
export default TablesSlice.reducer;


