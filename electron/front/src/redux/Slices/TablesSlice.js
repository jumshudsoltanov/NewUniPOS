import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { pickPendingOptimisticOrders } from "./BooksSlice";
import { bootDedupeAllows } from "../../utils/bootDedupe";
import axios from "../../utils/apiConfig";
import axiosRaw from "axios";
import { getEffectiveHourlyPrice, getLiveTimerCharge } from "../../utils/orderHourlyPrice";
import { findMenuItemById, parseTimerIntervals } from "../../utils/menuIndex";

const ADMIN_API = "https://api.unipos.tech/api";

export const loadLayoutsFromAdmin = createAsyncThunk(
  "tables/loadLayoutsFromAdmin",
  async (profile_id, _thunkAPI) => {
    try {
      // Send profile_id; backend falls back to all if not found
      const params = profile_id ? { profile_id } : {};
      const res = await axiosRaw.get(`${ADMIN_API}/table-layouts`, { params, timeout: 8000 });
      return res.data || {};
    } catch {
      return {};
    }
  }
);

export const loadLocalLayouts = createAsyncThunk(
  "tables/loadLocalLayouts",
  async (_, _thunkAPI) => {
    try {
      const res = await axios.get("/tables-layouts/local");
      return res.data?.data || {};
    } catch {
      return {};
    }
  }
);

export const saveTableLayouts = createAsyncThunk(
  "tables/saveTableLayouts",
  async (_, thunkAPI) => {
    thunkAPI.dispatch(saveEditMode());
    const state = thunkAPI.getState().TablesSlice;
    try {
      await axios.post("/tables-layouts/local", { layouts: state.localTableLayouts });
    } catch (e) {
      console.error(e);
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
  {
    // Açılışda 4 dəfə çağırılırdı — bax: utils/bootDedupe.js
    condition: (profileId) => bootDedupeAllows("tables:" + profileId),
  },
);

const TablesSlice = createSlice({
  name: "tables",
  initialState: {
    tableGroups: {},
    currentHallId: null,
    isTablesLoading: true,
    isTableEditMode: false,
    deletedOrderIds: [],
    hallOrder: JSON.parse(localStorage.getItem("pos_hall_order") || "[]"),
    tableOrder: JSON.parse(localStorage.getItem("pos_table_orders") || "{}"),
    adminTableLayouts: {},
    localTableLayouts: (() => {
      try {
        return JSON.parse(localStorage.getItem("pos_local_table_layouts") || "{}");
      } catch { return {}; }
    })(),
    tableLayouts: (() => {
      try {
        const raw = JSON.parse(localStorage.getItem("pos_table_layouts") || "{}");
        const out = {};
        Object.entries(raw).forEach(([hallId, layout]) => {
          const norm = {};
          if (layout) Object.entries(layout).forEach(([tid, v]) => { norm[String(tid)] = v; });
          out[String(hallId)] = norm;
        });
        return out;
      } catch { return {}; }
    })(),
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
      state.localTableLayouts = { ...state.tempTableLayouts };

      const merged = {};
      Object.keys(state.adminTableLayouts || {}).forEach(hallId => {
        merged[hallId] = { ...(state.adminTableLayouts[hallId] || {}) };
      });
      Object.keys(state.localTableLayouts || {}).forEach(hallId => {
        if (!merged[hallId]) merged[hallId] = {};
        Object.keys(state.localTableLayouts[hallId]).forEach(tableId => {
          merged[hallId][tableId] = state.localTableLayouts[hallId][tableId];
        });
      });
      state.tableLayouts = merged;

      localStorage.setItem("pos_hall_order", JSON.stringify(state.hallOrder));
      localStorage.setItem("pos_table_orders", JSON.stringify(state.tableOrder));
      localStorage.setItem("pos_local_table_layouts", JSON.stringify(state.localTableLayouts));
      localStorage.setItem("pos_table_layouts", JSON.stringify(state.tableLayouts));
      
      state.tempHallOrder = [];
      state.tempTableOrder = {};
      state.tempTableLayouts = {};
    },
    updateLocalLayoutsFromServer: (state, action) => {
      state.localTableLayouts = action.payload || {};
      
      const merged = {};
      Object.keys(state.adminTableLayouts || {}).forEach(hallId => {
        merged[hallId] = { ...(state.adminTableLayouts[hallId] || {}) };
      });
      Object.keys(state.localTableLayouts || {}).forEach(hallId => {
        if (!merged[hallId]) merged[hallId] = {};
        Object.keys(state.localTableLayouts[hallId]).forEach(tableId => {
          merged[hallId][tableId] = state.localTableLayouts[hallId][tableId];
        });
      });
      state.tableLayouts = merged;

      localStorage.setItem("pos_table_layouts", JSON.stringify(state.tableLayouts));
      localStorage.setItem("pos_local_table_layouts", JSON.stringify(state.localTableLayouts));
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
    clearHallLayout: (state, action) => {
      const hallId = String(action.payload);
      state.tempTableLayouts[hallId] = {};
      if (state.localTableLayouts[hallId]) {
        delete state.localTableLayouts[hallId];
      }
    },
    removeOrderOptimistic: (state, action) => {
      const orderId = action.payload;
      if (!orderId || !state.tableGroups?.data) return;
      // Track this order as optimistically deleted so future getTableGroups
      // responses don't bring it back
      if (!state.deletedOrderIds.includes(String(orderId))) {
        state.deletedOrderIds.push(String(orderId));
      }
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
    clearDeletedOrderId: (state, action) => {
      const orderId = String(action.payload);
      state.deletedOrderIds = state.deletedOrderIds.filter(id => id !== orderId);
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
    tickTimer: (state, action) => {
      if (!state.tableGroups?.data) return;
      // Diqqət: heç bir masada aktiv taymer yoxdursa top-level array reference-i
      // dəyişməməlidir — əks halda hər saniyə bütün masalar lövhəsi (heç bir
      // dəyişiklik olmasa belə) yenidən render olunur
      let anyHallChangedTop = false;
      const newTableGroupsData = state.tableGroups.data.map((hall) => {
        if (!hall.tables) return hall;
        const newTables = hall.tables.map((table) => {
          if (!table.orders || table.orders.length === 0) return table;

          const newOrders = table.orders.map((order) => {
            // PERFORMANS: əvvəl ucuz yoxlama — taymer yoxdursa heç nə allokasiya etmirik.
            // Köhnə kod hər saniyə hər sifariş üçün obyekt kopyalayır və tam menyunu
            // skan edirdi; menyu minlərlə məhsuldan ibarət olduqda POS donurdu.
            const timerIsOn = Number(order.is_timer_status) === 1;
            let hasTimerProduct = false;
            if (!timerIsOn) {
              const items = order.orders_items;
              if (items && items.length > 0) {
                for (let i = 0; i < items.length; i++) {
                  const it = items[i];
                  if (Number(it.product?.hourly_price || 0) > 0) { hasTimerProduct = true; break; }
                  if (parseTimerIntervals(it.product?.timer_intervals) !== null) { hasTimerProduct = true; break; }
                  const catItem = findMenuItemById(action.payload, it.product_id || it.id);
                  if (catItem) {
                    if (Number(catItem.hourly_price || 0) > 0) { hasTimerProduct = true; break; }
                    if (parseTimerIntervals(catItem.timer_intervals) !== null) { hasTimerProduct = true; break; }
                  }
                }
              }
            }

            // Tick if the table timer is active OR if the order contains a timer product
            if (!timerIsOn && !hasTimerProduct) {
              return order;
            }

            const orderForEff = {
              ...order,
              table: { ...(order.table || {}), hourly_price: table.hourly_price },
              orders_items: order.orders_items || [],
            };
            const effH = getEffectiveHourlyPrice(orderForEff);

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

            const { charge } = getLiveTimerCharge(orderForEff, totalSeconds, effH, action.payload);

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
          anyHallChangedTop = true;
          return { ...hall, tables: newTables };
        }
        return hall;
      });

      if (anyHallChangedTop) {
        state.tableGroups.data = newTableGroupsData;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadLayoutsFromAdmin.fulfilled, (state, action) => {
      const adminLayouts = action.payload;
      // Always update even if empty — signal received
      if (!adminLayouts) return;
      // Normalize: convert all keys to strings for consistent lookup
      const normalize = (hallLayout) => {
        if (!hallLayout) return {};
        const out = {};
        Object.entries(hallLayout).forEach(([k, v]) => { out[String(k)] = v; });
        return out;
      };
      const adminMerged = {};
      Object.entries(adminLayouts).forEach(([hallId, layout]) => {
        if (layout && Object.keys(layout).length > 0) {
          adminMerged[String(hallId)] = normalize(layout);
        }
      });
      state.adminTableLayouts = adminMerged;

      const finalMerged = {};
      Object.keys(state.adminTableLayouts || {}).forEach(hallId => {
        finalMerged[hallId] = { ...(state.adminTableLayouts[hallId] || {}) };
      });
      Object.keys(state.localTableLayouts || {}).forEach(hallId => {
        if (!finalMerged[hallId]) finalMerged[hallId] = {};
        Object.keys(state.localTableLayouts[hallId]).forEach(tableId => {
          finalMerged[hallId][tableId] = state.localTableLayouts[hallId][tableId];
        });
      });

      state.tableLayouts = finalMerged;
      state.tempTableLayouts = {};
      localStorage.setItem("pos_table_layouts", JSON.stringify(finalMerged));
    });

    builder.addCase(loadLocalLayouts.fulfilled, (state, action) => {
      const localLayouts = action.payload || {};
      state.localTableLayouts = localLayouts;
      localStorage.setItem("pos_local_table_layouts", JSON.stringify(localLayouts));
      
      const finalMerged = {};
      Object.keys(state.adminTableLayouts || {}).forEach(hallId => {
        finalMerged[hallId] = { ...(state.adminTableLayouts[hallId] || {}) };
      });
      Object.keys(state.localTableLayouts || {}).forEach(hallId => {
        if (!finalMerged[hallId]) finalMerged[hallId] = {};
        Object.keys(state.localTableLayouts[hallId]).forEach(tableId => {
          finalMerged[hallId][tableId] = state.localTableLayouts[hallId][tableId];
        });
      });
      
      state.tableLayouts = finalMerged;
      localStorage.setItem("pos_table_layouts", JSON.stringify(finalMerged));
    });

    builder.addCase(getTableGroups.pending, (state) => {
      if (!state.tableGroups?.data || state.tableGroups.data.length === 0) {
        state.isTablesLoading = true;
      }
    });
    /**
     * Çek geri qaytarılanda masa siyahısındakı süzgəcdən də çıxarılmalıdır —
     * əks halda `getTableGroups` çeki hər dəfə atır və masa boş görünür.
     * Bax: BooksSlice-dakı eyni işləyici.
     */
    builder.addCase("orders/reopen/fulfilled", (state, action) => {
      const reopenedOrderId = String(action.meta.arg.orderId);
      state.deletedOrderIds = (state.deletedOrderIds || []).filter(
        (id) => String(id) !== reopenedOrderId,
      );
    });
    builder.addCase(getTableGroups.fulfilled, (state, action) => {
      state.isTablesLoading = false;
      const payload = action.payload;
      const deletedIds = state.deletedOrderIds || [];
      // Optimistik (hələ serverə yazılmamış) sifarişlər masada qalsın — bax: BooksSlice.pickPendingOptimisticOrders
      const prevTablesById = new Map();
      (state.tableGroups?.data || []).forEach((hall) => (hall.tables || []).forEach((tb) => prevTablesById.set(String(tb.id), tb)));
      if (payload?.data) {
        state.tableGroups = {
          ...payload,
          data: payload.data.map(hall => ({
            ...hall,
            tables: hall.tables ? hall.tables.map(table => ({
              ...table,
              orders: [...pickPendingOptimisticOrders(prevTablesById.get(String(table.id))?.orders, table.orders || []), ...(table.orders ? table.orders.filter(o => {
                if (o.status === 3) return false;
                // Filter out optimistically deleted orders
                if (deletedIds.length > 0) {
                  const oId = String(o.uuid || o.id);
                  if (deletedIds.includes(oId)) return false;
                }
                return true;
              }) : [])]
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
      const { orderId, itemId } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            const order = table.orders[idx];
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
      });
    });

    // Optimistic timer stop in tables
    builder.addCase("orders/stopTimer/pending", (state, action) => {
      const { orderId, itemId, clockStr } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            const order = table.orders[idx];
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
      });
    });

    // Optimistic timer reset in tables
    builder.addCase("orders/resetTimer/pending", (state, action) => {
      const { orderId, itemId } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            const order = table.orders[idx];
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
      });
    });

    // Optimistic deposit update
    builder.addCase("orders/updateDeposit/pending", (state, action) => {
      const { orderId, depositValue } = action.meta.arg;
      if (!state.tableGroups?.data) return;
      state.tableGroups.data.forEach((hall) => {
        if (!hall.tables) return;
        hall.tables.forEach((table) => {
          if (!table.orders) return;
          const idx = table.orders.findIndex(o => String(o.uuid) === String(orderId));
          if (idx !== -1) {
            table.orders[idx] = {
              ...table.orders[idx],
              deposit: depositValue,
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

    builder.addCase("orders/updateTags/fulfilled", (state, action) => {
      const orderId = action.meta?.arg?.orderId;
      const tags = action.meta?.arg?.tags;
      if (!orderId) return;

      Object.values(state.tableGroups).forEach((group) => {
        if (group.tables) {
          group.tables.forEach((table) => {
            if (table.orders) {
              const idx = table.orders.findIndex(
                (o) => o.uuid === orderId || String(o.uuid) === String(orderId)
              );
              if (idx !== -1) {
                table.orders[idx] = { ...table.orders[idx], tags };
              }
            }
          });
        }
      });
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
        action.type === "orders/updateDeposit/fulfilled" ||
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
  clearHallLayout,
  tickTimer,
  updateActiveCheckLocal,
  localSyncOrder,
  removeOrderOptimistic: tablesRemoveOrderOptimistic,
  addOrderToTableOptimistic,
  clearDeletedOrderId,
  updateLocalLayoutsFromServer
} = TablesSlice.actions;

export const tickTablesThunk = () => (dispatch, getState) => {
  const state = getState();
  const menuData = state.OrderSlice?.menu || state.MenuSlice?.data || [];
  dispatch(tickTimer(menuData));
};

export { tablesRemoveOrderOptimistic as removeOrderOptimisticFromTables };
export default TablesSlice.reducer;


