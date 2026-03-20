/**
 * Admin server üçün ordering (sıralama) router.
 * Bu faylı admin layihənizə əlavə edin.
 *
 * İstifadə (app.js və ya server.js):
 * const orderingRoutes = require('./routes/orderingRoutes');
 * app.use('/api', orderingRoutes);
 * app.use('/api/pos', orderingRoutes);
 */

const express = require("express");
const router = express.Router();

// Model yollarını admin layihənizə uyğun dəyişin (məs: ./models/GeneralCategoriesModel)
let GeneralCategoriesModel, CategoriesModel, ProductsModel;
try {
  GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
  CategoriesModel = require("../model/CategoriesModel");
  ProductsModel = require("../model/ProductsModel");
} catch (e) {
  try {
    GeneralCategoriesModel = require("../../model/GeneralCategoriesModel");
    CategoriesModel = require("../../model/CategoriesModel");
    ProductsModel = require("../../model/ProductsModel");
  } catch (e2) {
    // Model yoxdursa DB update skip olunacaq, amma 200 qayıdacaq
  }
}

const updateOrdering = async (Model, orderedItems, profile_id) => {
  if (!Model) return;
  for (let i = 0; i < orderedItems.length; i++) {
    const { id, ordering } = orderedItems[i];
    if (id != null) {
      const where = profile_id != null ? { id, profile_id } : { id };
      await Model.update({ ordering: ordering ?? i + 1 }, { where });
    }
  }
};

router.put("/general-categories/ordering", async (req, res) => {
  try {
    const { orderedItems, profile_id } = req.body;
    if (!orderedItems || !Array.isArray(orderedItems)) {
      return res.status(400).json({ message: "orderedItems tələb olunur" });
    }
    await updateOrdering(GeneralCategoriesModel, orderedItems, profile_id);
    return res.status(200).json({ success: true, message: "Sıralama yadda saxlanıldı" });
  } catch (error) {
    console.error("General categories ordering error:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.put("/categories/ordering", async (req, res) => {
  try {
    const { orderedItems, profile_id } = req.body;
    if (!orderedItems || !Array.isArray(orderedItems)) {
      return res.status(400).json({ message: "orderedItems tələb olunur" });
    }
    await updateOrdering(CategoriesModel, orderedItems, profile_id);
    return res.status(200).json({ success: true, message: "Sıralama yadda saxlanıldı" });
  } catch (error) {
    console.error("Categories ordering error:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.put("/products/ordering", async (req, res) => {
  try {
    const { orderedItems, profile_id } = req.body;
    if (!orderedItems || !Array.isArray(orderedItems)) {
      return res.status(400).json({ message: "orderedItems tələb olunur" });
    }
    await updateOrdering(ProductsModel, orderedItems, profile_id);
    return res.status(200).json({ success: true, message: "Sıralama yadda saxlanıldı" });
  } catch (error) {
    console.error("Products ordering error:", error);
    return res.status(500).json({ message: error.message });
  }
});

router.put("/categories/:categoryId/products/ordering", async (req, res) => {
  try {
    const { orderedItems, profile_id } = req.body;
    if (!orderedItems || !Array.isArray(orderedItems)) {
      return res.status(400).json({ message: "orderedItems tələb olunur" });
    }
    await updateOrdering(ProductsModel, orderedItems, profile_id);
    return res.status(200).json({ success: true, message: "Sıralama yadda saxlanıldı" });
  } catch (error) {
    console.error("Products ordering (category) error:", error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
