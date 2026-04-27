import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiConfig from "../../utils/apiConfig";

export const menuWithGeneralCategories = createAsyncThunk(
  "orders/all-menu",
  async (profileId, thunkAPI) => {
    try {
      const response = await apiConfig.get(
        `/menu/${profileId}/all-menu`,
        {},
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

export const menuWithCategories = createAsyncThunk(
  "orders/men-categories",
  async (profileId, thunkAPI) => {
    try {
      const response = await apiConfig.get(
        `/menu/${profileId}/menu-with-categories`,
        {},
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data);
    }
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
