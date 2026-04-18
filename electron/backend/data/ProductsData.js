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

const normalizePrinterIdValue = (value) => {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const ids = value
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    return ids.length ? [...new Set(ids)].join(",") : null;
  }
  const asString = String(value).trim();
  if (!asString || asString === "0") return null;
  return asString;
};

const extractPrinterIdString = (item) => {
  const direct = normalizePrinterIdValue(item?.printer_id);
  if (direct) return direct;

  const detailIds = (item?.printer_details || [])
    .map((p) => Number(p?.id ?? p?.printer_id ?? p?.pivot?.printer_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  return detailIds.length ? [...new Set(detailIds)].join(",") : null;
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
        `https://api.unipos.tech/api/general-categories?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
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
        `https://api.unipos.tech/api/categories?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
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

    // V1, V2, V3(local admin) və modifiers-i eyni anda paralel çək
    const [v1Result, v2Result, v3Result, modResult] = await Promise.allSettled([
      axios.get(`http://46.224.8.157:35627/api/products/${profile_id}`),
      axios.get(`https://api.unipos.tech/api/products?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`),
      axios.get(`http://localhost:8089/api/products?profile_id=${profile_id}&limit=10000&per_page=10000&page=1`),
      axios.get(`http://46.224.8.157:35627/api/modifiers/${profile_id}`),
    ]);

    if (v1Result.status === "rejected") {
      console.warn("[ProductsData] V1 API xətası:", v1Result.reason?.message);
    }

    // V2-dən printer_id, color, hourly_price çək
    const printerMap = {};
    const colorMap = {};
    const hourlyPriceMap = {};
    if (v2Result.status === "fulfilled") {
      const items = v2Result.value.data?.items || [];
      items.forEach((item) => {
        if (!item.id) return;
        if (item.printer_id) {
          printerMap[item.id] = Array.isArray(item.printer_id)
            ? item.printer_id.join(",")
            : item.printer_id.toString();
        }
        if (item.color) colorMap[item.id] = item.color;
        if (item.hourly_price != null) hourlyPriceMap[item.id] = item.hourly_price;
      });
    } else {
      console.error("[ProductsData] V2 API xətası:", v2Result.reason?.message);
    }

    // V3 (local admin :8089) — printer_details birbaşa gəlir, id/ad üzrə match
    const v3IdMap = {}; // productId -> printer_id(csv)
    const v3NameMap = {}; // name.lower → { printer_id, printer_details }
    if (v3Result.status === "fulfilled") {
      const rawV3 = v3Result.value.data;
      const v3Items = Array.isArray(rawV3)
        ? rawV3
        : rawV3?.items || rawV3?.data || [];
      console.log(`[ProductsData] V3 local admin: ${v3Items.length} məhsul gəldi`);
      v3Items.forEach((item) => {
        if (!item.name) return;
        const extractedPrinterId = extractPrinterIdString(item);
        if (item.id && extractedPrinterId) {
          v3IdMap[item.id] = extractedPrinterId;
        }
        if (extractedPrinterId || item.printer_details?.length > 0) {
          v3NameMap[item.name.toLowerCase().trim()] = {
            printer_id: extractedPrinterId,
            printer_details: item.printer_details || []
          };
          console.log(`[ProductsData] V3: "${item.name}" → printer_id:${extractedPrinterId}, printers:[${(item.printer_details || []).map(p => p.name).join(',')}]`);
        }
      });
    } else {
      console.warn("[ProductsData] V3 local admin xətası (optional):", v3Result.reason?.message);
    }

    // Modifiers çək
    const modifierMap = {};
    if (modResult.status === "fulfilled") {
      const groups = modResult.value.data?.data || [];
      groups.forEach((group) => {
        if (!group.product_id) return;
        if (!modifierMap[group.product_id]) modifierMap[group.product_id] = [];
        modifierMap[group.product_id].push({
          id: group.id,
          name: group.name,
          selection_type: group.selection_type || "multiple",
          is_required: group.is_required || 0,
          max_selection: group.max_selections || 0,
          ordering: group.ordering || 0,
          items: (group.items || []).map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price || 0,
            quantity: item.quantity || 1,
            is_default: item.is_default || 0,
            ordering: item.ordering || 0,
            product_id: item.product_id,
            modifier_group_id: item.modifier_group_id,
          })),
        });
      });
      console.log(`[ProductsData] Modifier groups çəkildi: ${groups.length} group`);
    } else {
      console.error("[ProductsData] Modifiers API xətası:", modResult.reason?.message);
    }

    const v1Products =
      v1Result.status === "fulfilled" && Array.isArray(v1Result.value?.data?.data)
        ? v1Result.value.data.data
        : [];
    const v3ProductsRaw =
      v3Result.status === "fulfilled"
        ? (Array.isArray(v3Result.value?.data)
            ? v3Result.value.data
            : v3Result.value?.data?.items || v3Result.value?.data?.data || [])
        : [];

    const sourceProducts = v1Products.length > 0 ? v1Products : v3ProductsRaw;

    if (sourceProducts.length > 0) {
      const products = sourceProducts.map((p) => {
        Object.keys(p).forEach((k) => {
          if (p[k] === undefined) p[k] = k === "printer_id" ? null : 0;
        });
        // V2 əlavələri (köhnə cloud sahələri üçün fallback)
        if (printerMap[p.id]) p.printer_id = printerMap[p.id];
        // New local admin prioriteti: id uyğun gəlirsə həmişə üstün tut
        if (v3IdMap[p.id]) {
          p.printer_id = v3IdMap[p.id];
          console.log(`[ProductsData] V3 id match: "${p.name}" (#${p.id}) → printer_id:${p.printer_id}`);
        }
        // V3 ad üzrə fallback match
        if (!p.printer_id || p.printer_id === "0") {
          const nameKey = p.name?.toLowerCase().trim();
          if (nameKey && v3NameMap[nameKey]?.printer_id) {
            p.printer_id = v3NameMap[nameKey].printer_id;
            console.log(`[ProductsData] V3 ad match: "${p.name}" → printer_id:${p.printer_id}`);
          }
        }
        p.printer_id = normalizePrinterIdValue(p.printer_id);
        p.profile_id = profile_id;
        if (colorMap[p.id]) p.color = colorMap[p.id];
        if (hourlyPriceMap[p.id] != null) p.hourly_price = hourlyPriceMap[p.id];
        if (modifierMap[p.id]) p.modifier_groups = modifierMap[p.id];
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
          where: { id: products.map((p) => p.id) },
          raw: true,
        });
        const orderMap = {};
        existingOrders.forEach((r) => { if (r.ordering != null) orderMap[r.id] = r.ordering; });

        const productsWithOrder = products.map((p) => ({
          ...p,
          ordering: orderMap[p.id] != null ? orderMap[p.id] : (p.ordering ?? 0),
        }));

        const updateKeys = Object.keys(productsWithOrder[0]).filter(
          (key) => ProductsModel.rawAttributes[key] && key !== "ordering" && key !== "modifier_groups",
        );
        await ProductsModel.bulkCreate(productsWithOrder, {
          updateOnDuplicate: updateKeys,
        });

        // modifier_groups JSON kimi ayrıca update et — bulkCreate JSON field-i düzgün saxlamır
        const modifierUpdates = productsWithOrder.filter((p) => p.modifier_groups != null);
        for (const p of modifierUpdates) {
          const value = typeof p.modifier_groups === "string"
            ? p.modifier_groups
            : JSON.stringify(p.modifier_groups);
          await ProductsModel.update(
            { modifier_groups: value },
            { where: { id: p.id } }
          );
        }
      }

      console.log(`[ProductsData] Products DB sync olundu: ${products.length} məhsul insert/update + silindi`);
    } else {
      console.warn("[ProductsData] Heç bir məhsul mənbədən gəlmədi (V1/V3 boşdur)");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getGeneralCategories, getCategories, getProducts };
