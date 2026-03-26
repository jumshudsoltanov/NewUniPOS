const axios = require("axios");
const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");
const LoginModel = require("../model/LoginModel");
const { Op } = require("sequelize");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

// V2 API-dən color dəyərlərini çək
const fetchColorsFromV2 = async (endpoint) => {
  const colorMap = {};
  try {
    const res = await axios.get(endpoint);
    const items = res.data?.items || res.data?.data || [];
    items.forEach((item) => {
      if (item.id && item.color) colorMap[item.id] = item.color;
    });
  } catch (e) { /* v2 endpoint mövcud olmaya bilər */ }
  return colorMap;
};

const getGeneralCategories = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/general-categories/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      // Admin paneldən qoyulan rəngləri v2 API-dən çək
      const colorMap = await fetchColorsFromV2(
        `https://api.unipos.tech/api/general-categories?profile_id=${profile_id}&per_page=1000`,
      );

      const generalCategories = response.data.data.map((g) => {
        Object.keys(g).forEach((k) => {
          if (g[k] === undefined) g[k] = k === "printer_id" ? null : 0;
        });
        g.profile_id = profile_id;
        // V2-dən gəlsə rəngi əlavə et
        if (colorMap[g.id]) g.color = colorMap[g.id];
        return g;
      });

      const apiIds = generalCategories.map((g) => g.id);

      if (apiIds.length > 0) {
        await GeneralCategoriesModel.destroy({
          where: { profile_id, id: { [Op.notIn]: apiIds } },
          force: true,
        });
      } else {
        await GeneralCategoriesModel.destroy({ where: { profile_id }, force: true });
      }

      if (generalCategories.length > 0) {
        const updateKeys = Object.keys(generalCategories[0]).filter(
          (key) => GeneralCategoriesModel.rawAttributes[key],
        );
        await GeneralCategoriesModel.bulkCreate(generalCategories, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("General Categories Error:", err);
  }
};

const getCategories = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/categories/${profile_id}`,
    );

    const categoriesData = response.data.categories || response.data.data;

    if (categoriesData && Array.isArray(categoriesData)) {
      // Admin paneldən qoyulan rəngləri v2 API-dən çək
      const colorMap = await fetchColorsFromV2(
        `https://api.unipos.tech/api/categories?profile_id=${profile_id}&per_page=1000`,
      );

      const categories = categoriesData.map((c) => {
        Object.keys(c).forEach((k) => {
          if (c[k] === undefined) c[k] = k === "printer_id" ? null : 0;
        });
        if (Array.isArray(c.printer_id)) {
          c.printer_id = c.printer_id.join(",");
        }
        c.profile_id = profile_id;
        // V2-dən gəlsə rəngi əlavə et
        if (colorMap[c.id]) c.color = colorMap[c.id];
        return c;
      });

      const apiIds = categories.map((c) => c.id);

      if (apiIds.length > 0) {
        await CategoriesModel.destroy({
          where: { profile_id, id: { [Op.notIn]: apiIds } },
          force: true,
        });
      } else {
        await CategoriesModel.destroy({ where: { profile_id }, force: true });
      }

      if (categories.length > 0) {
        const updateKeys = Object.keys(categories[0]).filter(
          (key) => CategoriesModel.rawAttributes[key],
        );
        await CategoriesModel.bulkCreate(categories, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Categories Error:", err);
  }
};

const getProducts = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/products/${profile_id}`,
    );

    // V2 API-dən printer_id VƏ color məlumatlarını çək
    let printerMap = {};
    let colorMap = {};
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const v2Response = await axios.get(
        `https://api.unipos.tech/api/products?profile_id=${profile_id}&per_page=1000`,
      );
      if (v2Response.data && Array.isArray(v2Response.data.items)) {
        v2Response.data.items.forEach((item) => {
          if (item.id) {
            if (item.printer_id) {
              printerMap[item.id] = Array.isArray(item.printer_id)
                ? item.printer_id.join(",")
                : item.printer_id.toString();
            }
            if (item.color) colorMap[item.id] = item.color;
          }
        });
      }
    } catch (e) {
      console.error("Xəta (v2 API):", e.message);
    }

    if (response.data && Array.isArray(response.data.data)) {
      const products = response.data.data.map((p) => {
        Object.keys(p).forEach((k) => {
          if (p[k] === undefined) p[k] = k === "printer_id" ? null : 0;
        });
        if (printerMap[p.id]) p.printer_id = printerMap[p.id];
        if (Array.isArray(p.printer_id)) p.printer_id = p.printer_id.join(",");
        p.profile_id = profile_id;
        // V2-dən gəlsə rəngi əlavə et
        if (colorMap[p.id]) p.color = colorMap[p.id];
        return p;
      });

      const apiIds = products.map((p) => p.id);

      if (apiIds.length > 0) {
        await ProductsModel.destroy({
          where: { profile_id, id: { [Op.notIn]: apiIds } },
          force: true,
        });
      } else {
        await ProductsModel.destroy({ where: { profile_id }, force: true });
      }

      if (products.length > 0) {
        // Mövcud ordering-ləri saxla
        const existingOrders = await ProductsModel.findAll({
          attributes: ["id", "ordering"],
          where: { id: products.map(p => p.id) },
          raw: true,
        });
        const orderMap = {};
        existingOrders.forEach(r => { if (r.ordering != null) orderMap[r.id] = r.ordering; });

        const productsWithOrder = products.map(p => ({
          ...p,
          ordering: orderMap[p.id] != null ? orderMap[p.id] : (p.ordering ?? 0),
        }));

        const updateKeys = Object.keys(productsWithOrder[0]).filter(
          (key) => ProductsModel.rawAttributes[key] && key !== "ordering",
        );
        await ProductsModel.bulkCreate(productsWithOrder, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getGeneralCategories, getCategories, getProducts };
