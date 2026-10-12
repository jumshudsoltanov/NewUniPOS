import { createSlice, createAsyncThunk, createAction } from "@reduxjs/toolkit";
import { bootDedupeAllows } from "../../utils/bootDedupe";
import apiConfig from "../../utils/apiConfig";

/**
 * Menyu keşi (localStorage): proqram açılanda grid şəbəkə cavabını gözləmədən
 * son bilinən menyu ilə dərhal çəkilir, təzə cavab gələndə üstündən yazılır.
 * Şəkillər (base64) keşə yazılmır — localStorage limitinə (≈5 MB) sığsın.
 */
const CACHE_PREFIX = "unipos_menu_cache_v1";
const cacheKey = (kind, profileId) => `${CACHE_PREFIX}:${kind}:${profileId}`;

const stripImages = (payload) => {
  const strip = (products) =>
    Array.isArray(products) ? products.map(({ img, ...rest }) => rest) : products;
  const data = (payload?.data || []).map((node) => {
    const n = { ...node };
    if (Array.isArray(n.products)) n.products = strip(n.products);
    if (Array.isArray(n.categories)) {
      n.categories = n.categories.map((c) => ({ ...c, products: strip(c.products) }));
    }
    return n;
  });
  return { ...payload, data };
};

const readMenuCache = (kind, profileId) => {
  try {
    const raw = localStorage.getItem(cacheKey(kind, profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.data) && parsed.data.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const writeMenuCache = (kind, profileId, payload) => {
  try {
    if (!Array.isArray(payload?.data)) return;
    localStorage.setItem(cacheKey(kind, profileId), JSON.stringify(stripImages(payload)));
  } catch {
    /* kvota və s. — keş olmadan davam */
  }
};

/** Keşdən yüklənmiş menyu (şəbəkə cavabından əvvəl) */
export const menuCacheLoaded = createAction("menu/cache-loaded");

const hydrateFromCache = (kind, profileId, thunkAPI, currentData) => {
  if (Array.isArray(currentData) && currentData.length > 0) return;
  const cached = readMenuCache(kind, profileId);
  if (cached) thunkAPI.dispatch(menuCacheLoaded({ kind, payload: cached }));
};

export const menuWithGeneralCategories = createAsyncThunk(
  "orders/all-menu",
  async (profileId, thunkAPI) => {
    hydrateFromCache("general", profileId, thunkAPI, thunkAPI.getState()?.MenuSlice?.menuDataWithGeneralCategories?.data);
    try {
      const response = await apiConfig.get(
        `/menu/${profileId}/all-menu`,
        {},
      );
      writeMenuCache("general", profileId, response.data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
  {
    // Açılışda eyni sorğunun bir neçə komponentdən təkrar göndərilməsini
    // birləşdirir. Yalnız ilk saniyələrdə işləyir — bax: utils/bootDedupe.js
    condition: (profileId) => bootDedupeAllows("all-menu:" + profileId),
  },
);

export const menuWithCategories = createAsyncThunk(
  "orders/men-categories",
  async (profileId, thunkAPI) => {
    hydrateFromCache("categories", profileId, thunkAPI, thunkAPI.getState()?.MenuSlice?.menuDataWithCategories?.data);
    try {
      const response = await apiConfig.get(
        `/menu/${profileId}/menu-with-categories`,
        {},
      );
      writeMenuCache("categories", profileId, response.data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
  {
    // Açılışda eyni sorğunun bir neçə komponentdən təkrar göndərilməsini
    // birləşdirir. Yalnız ilk saniyələrdə işləyir — bax: utils/bootDedupe.js
    condition: (profileId) => bootDedupeAllows("menu-with-categories:" + profileId),
  },
);

const MenuSlice = createSlice({
  name: "mwnu",
  initialState: {
    menuDataWithGeneralCategories: {},
    menuDataWithCategories: {},
  },
  reducers: {
    updateProductModifierGroups: (state, action) => {
      const { productId, modifier_groups } = action.payload;
      const updateInCats = (cats) => {
        if (!Array.isArray(cats)) return;
        for (const cat of cats) {
          if (!Array.isArray(cat.products)) continue;
          const idx = cat.products.findIndex(p => p.id === productId);
          if (idx !== -1) {
            cat.products[idx] = { ...cat.products[idx], modifier_groups };
          }
        }
      };
      updateInCats(state.menuDataWithCategories?.data);
      const genCats = state.menuDataWithGeneralCategories?.data;
      if (Array.isArray(genCats)) {
        for (const gc of genCats) updateInCats(gc.categories);
      }
    },
    applyProductOrdering: (state, action) => {
      const { categoryId, orderedIds } = action.payload;
      if (!state.menuDataWithCategories?.data) return;
      const catIndex = state.menuDataWithCategories.data.findIndex(c => c.id === categoryId);
      if (catIndex === -1) return;
      const cat = state.menuDataWithCategories.data[catIndex];
      if (!cat.products) return;
      const orderMap = {};
      orderedIds.forEach((id, i) => { orderMap[id] = i; });
      cat.products.sort((a, b) => {
        const ai = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
        const bi = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
        return ai - bi;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(menuCacheLoaded, (state, action) => {
        const { kind, payload } = action.payload || {};
        if (kind === "general" && !(state.menuDataWithGeneralCategories?.data?.length > 0)) {
          state.menuDataWithGeneralCategories = payload;
        }
        if (kind === "categories" && !(state.menuDataWithCategories?.data?.length > 0)) {
          state.menuDataWithCategories = payload;
        }
      })
      .addCase(menuWithGeneralCategories.fulfilled, (state, action) => {
        state.menuDataWithGeneralCategories = action.payload;
      })
      .addCase(menuWithCategories.fulfilled, (state, action) => {
        state.menuDataWithCategories = action.payload;
      })
      // Instant Update for Products
      .addMatcher(
        (action) => action.type === 'products/update/fulfilled',
        (state, action) => {
          const updatedProduct = action.payload?.data || action.payload;
          if (!updatedProduct || !updatedProduct.id) return;

          // Update in menuDataWithCategories
          if (state.menuDataWithCategories?.data && Array.isArray(state.menuDataWithCategories.data)) {
            state.menuDataWithCategories.data = state.menuDataWithCategories.data.map(cat => {
              if (cat.products && Array.isArray(cat.products)) {
                return {
                  ...cat,
                  products: cat.products.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p)
                };
              }
              return cat;
            });
          }
        }
      )
      // Instant Add for Products (Optional, but good for UX)
      .addMatcher(
        (action) => action.type === 'products/add/fulfilled',
        (state, action) => {
          const newProduct = action.payload?.data || action.payload;
          if (!newProduct || !newProduct.category_id) return;

          if (state.menuDataWithCategories?.data && Array.isArray(state.menuDataWithCategories.data)) {
            state.menuDataWithCategories.data = state.menuDataWithCategories.data.map(cat => {
              if (cat.id === newProduct.category_id) {
                const products = cat.products ? [...cat.products] : [];
                if (!products.find(p => p.id === newProduct.id)) {
                  products.push(newProduct);
                }
                return { ...cat, products };
              }
              return cat;
            });
          }
        }
      )
      .addMatcher(
        (action) => action.type === 'products/delete/fulfilled',
        (state, action) => {
          const deletedId = action.payload;
          if (!deletedId) return;

          if (state.menuDataWithCategories?.data && Array.isArray(state.menuDataWithCategories.data)) {
            state.menuDataWithCategories.data = state.menuDataWithCategories.data.map(cat => {
              if (cat.products && Array.isArray(cat.products)) {
                return {
                  ...cat,
                  products: cat.products.filter(p => p.id !== deletedId)
                };
              }
              return cat;
            });
          }

          if (state.menuDataWithGeneralCategories?.data && Array.isArray(state.menuDataWithGeneralCategories.data)) {
            state.menuDataWithGeneralCategories.data = state.menuDataWithGeneralCategories.data.map(genCat => {
              if (genCat.categories && Array.isArray(genCat.categories)) {
                return {
                  ...genCat,
                  categories: genCat.categories.map(cat => {
                    if (cat.products && Array.isArray(cat.products)) {
                      return {
                        ...cat,
                        products: cat.products.filter(p => p.id !== deletedId)
                      };
                    }
                    return cat;
                  })
                };
              }
              return genCat;
            });
          }
        }
      );
  },
});

export const { applyProductOrdering, updateProductModifierGroups } = MenuSlice.actions;
export default MenuSlice.reducer;
