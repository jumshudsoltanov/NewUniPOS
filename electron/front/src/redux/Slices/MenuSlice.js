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
        // DEBUG: printer_id vəziyyətini yoxla
        const allProducts = (action.payload?.data || []).flatMap(c => c.products || []);
        const withPrinter = allProducts.filter(p => p.printer_details?.length > 0);
        const withPrinterId = allProducts.filter(p => p.printer_id && p.printer_id !== "0" && p.printer_id !== "");
        console.group("📂 [MenuSlice] menuWithCategories yükləndi");
        console.log(`✅ Ümumi məhsul: ${allProducts.length}`);
        console.log(`🖨️ printer_details DOLU məhsullar (${withPrinter.length}):`, withPrinter.map(p => `${p.name} → [${p.printer_details.map(pr => pr.name || pr.local_name).join(", ")}]`));
        console.log(`🔑 printer_id DOLU məhsullar (${withPrinterId.length}):`, withPrinterId.map(p => `${p.name} (#${p.id}) → printer_id: ${p.printer_id}`));
        if (withPrinter.length === 0) console.warn("⚠️ Heç bir məhsula printer təyin edilməyib! Sync işləməyib ola bilər.");
        console.groupEnd();
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

export const { applyProductOrdering } = MenuSlice.actions;
export default MenuSlice.reducer;
