const { default: axios } = require("axios");
const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");
const LoginModel = require("../model/LoginModel")
const { Op } = require("sequelize");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getGeneralCategories = async () => {
  try {
    const profile_id = await profileData();
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/general-categories/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const generalCategories = response.data.data.map((g) => {
        Object.keys(g).forEach((k) => {
          if (g[k] === undefined) g[k] = 0;
        });
        g.profile_id = profile_id;
        return g;
      });

      const apiIds = generalCategories.map((g) => g.id);

      // DB-də olub, API-da olmayanları sil
      await GeneralCategoriesModel.destroy({
        where: { id: { [Op.notIn]: apiIds } },
      });

      // Insert / update
      await GeneralCategoriesModel.bulkCreate(generalCategories, {
        updateOnDuplicate: Object.keys(generalCategories[0]),
      });

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

const getCategories = async () => {
  try {
    const profile_id = await profileData();
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/categories/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const categories = response.data.data.map((c) => {
        Object.keys(c).forEach((k) => {
          if (c[k] === undefined) c[k] = 0;
        });
        c.profile_id = profile_id;
        return c;
      });

      const apiIds = categories.map((c) => c.id);

      // DB-də olub, API-da olmayanları sil
      await CategoriesModel.destroy({
        where: { id: { [Op.notIn]: apiIds } },
      });

      // Insert / update
      await CategoriesModel.bulkCreate(categories, {
        updateOnDuplicate: Object.keys(categories[0]),
      });

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

const getProducts = async () => {
  try {
    const profile_id = await profileData();
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/products/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const products = response.data.data.map((p) => {
        Object.keys(p).forEach((k) => {
          if (p[k] === undefined) p[k] = 0;
        });
        p.profile_id = profile_id;
        return p;
      });

      const apiIds = products.map((p) => p.id);

      // DB-də olub, API-da olmayanları sil
      await ProductsModel.destroy({
        where: { id: { [Op.notIn]: apiIds } },
      });

      // Insert / update
      await ProductsModel.bulkCreate(products, {
        updateOnDuplicate: Object.keys(products[0]),
      });

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getGeneralCategories, getCategories, getProducts };
