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
  reducers: {},
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

export default MenuSlice.reducer;
