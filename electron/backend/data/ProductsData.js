const axios = require("axios");
const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");
const LoginModel = require("../model/LoginModel");
const db = require("../database/config");
const { Op } = require("sequelize");

// Şəkilli (img base64) sahələr olduğu üçün bütün sətirləri tək INSERT-də
// göndərmək 'max_allowed_packet' limitini aşa bilir — kiçik qruplarla yazırıq
const bulkCreateInChunks = async (Model, rows, options, chunkSize = 25) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    try {
      await Model.bulkCreate(chunk, options);
    } catch (chunkErr) {
      console.error(
        `[bulkCreateInChunks] ${Model.name} chunk (${i}-${i + chunk.length}) uğursuz oldu, digər qruplarla davam edilir:`,
        chunkErr.message,
      );
    }
  }
};

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

// V2 API-dən color dəyərlərini çək
const fetchColorsFromV2 = async (endpoint) => {
  const colorMap = {};
  try {
    const res = await axios.get(endpoint, { timeout: 15000 });
    const items = res.data?.items || res.data?.data || [];
    items.forEach((item) => {
      if (item.id && item.color) colorMap[item.id] = item.color;
    });
  } catch (e) {
    /* v2 endpoint mövcud olmaya bilər */
  }
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

    // 1-ci mənbə: köhnə API (46.224.8.157:35627)
    let rawData = null;

    try {
      const response = await axios.get(
        `http://46.224.8.157:35627/api/pos/general-categories/${profile_id}`,
        { timeout: 15000 },
      );
      if (response.data && Array.isArray(response.data.data)) {
        rawData = response.data.data;
      }
    } catch (v1Err) {
      console.warn("General Categories V1 xətası:", v1Err.message);
    }

    // 2-ci mənbə (fallback): cloud API (api.unipos.tech)
    if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
      try {
        const cloudResp = await axios.get(
          `https://api.unipos.tech/api/general-categories?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
          { timeout: 15000 },
        );
        const cloudItems = cloudResp.data?.items || cloudResp.data?.data || [];
        if (Array.isArray(cloudItems) && cloudItems.length > 0) {
          rawData = cloudItems;
          console.log(`[GenCategories] Cloud API-dən ${rawData.length} general category gəldi`);
        }
      } catch (cloudErr) {
        console.warn("General Categories Cloud API xətası:", cloudErr.message);
      }
    }

    // 3-cü mənbə (fallback): local admin panel (localhost:8089)
    if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
      try {
        const localResp = await axios.get(
          `http://localhost:8089/api/general-categories?profile_id=${profile_id}`,
          { timeout: 5000 },
        );
        if (Array.isArray(localResp.data)) {
          rawData = localResp.data;
          console.log(
            `[GenCategories] Local admin-dən ${rawData.length} general category gəldi`,
          );
        }
      } catch (localErr) {
        console.warn("General Categories Local Admin xətası:", localErr.message);
      }
    }

    if (rawData && Array.isArray(rawData)) {
      // Admin paneldən qoyulan rəngləri v2 API-dən çək
      const colorMap = await fetchColorsFromV2(
        `https://api.unipos.tech/api/general-categories?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
      );

      const generalCategories = rawData.map((g) => {
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
        await GeneralCategoriesModel.destroy({
          where: { profile_id },
          force: true,
        });
      }

      if (generalCategories.length > 0) {
        const existingOrders = await GeneralCategoriesModel.findAll({
          attributes: ["id", "ordering"],
          where: { id: generalCategories.map((g) => g.id) },
          raw: true,
        });
        const orderMap = {};
        existingOrders.forEach((r) => {
          if (r.ordering != null) orderMap[r.id] = r.ordering;
        });
        const generalCategoriesWithOrder = generalCategories.map((g) => ({
          ...g,
          ordering: orderMap[g.id] != null ? orderMap[g.id] : (g.ordering ?? 0),
        }));
        const updateKeys = Object.keys(generalCategoriesWithOrder[0]).filter(
          (key) => GeneralCategoriesModel.rawAttributes[key] && key !== "ordering",
        );
        await bulkCreateInChunks(GeneralCategoriesModel, generalCategoriesWithOrder, {
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

    // 1-ci mənbə: köhnə API (46.224.8.157:35627)
    let categoriesData = null;

    try {
      const response = await axios.get(
        `http://46.224.8.157:35627/api/pos/categories/${profile_id}`,
        { timeout: 15000 },
      );
      categoriesData = response.data.categories || response.data.data;
    } catch (v1Err) {
      console.warn("Categories V1 xətası:", v1Err.message);
    }

    // 2-ci mənbə (fallback): cloud API (api.unipos.tech)
    if (!categoriesData || !Array.isArray(categoriesData) || categoriesData.length === 0) {
      try {
        const cloudResp = await axios.get(
          `https://api.unipos.tech/api/categories?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
          { timeout: 15000 },
        );
        const cloudItems = cloudResp.data?.items || cloudResp.data?.data || [];
        if (Array.isArray(cloudItems) && cloudItems.length > 0) {
          categoriesData = cloudItems;
          console.log(`[Categories] Cloud API-dən ${categoriesData.length} kategoriya gəldi`);
        }
      } catch (cloudErr) {
        console.warn("Categories Cloud API xətası:", cloudErr.message);
      }
    }

    // 3-cü mənbə (fallback): local admin panel (localhost:8089)
    if (!categoriesData || !Array.isArray(categoriesData) || categoriesData.length === 0) {
      try {
        const localResp = await axios.get(
          `http://localhost:8089/api/categories?profile_id=${profile_id}&limit=10000&page=1`,
          { timeout: 5000 },
        );
        if (localResp.data && Array.isArray(localResp.data.items)) {
          categoriesData = localResp.data.items;
          console.log(
            `[Categories] Local admin-dən ${categoriesData.length} kategoriya gəldi`,
          );
        }
      } catch (localErr) {
        console.warn("Categories Local Admin xətası:", localErr.message);
      }
    }

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
        const existingOrders = await CategoriesModel.findAll({
          attributes: ["id", "ordering"],
          where: { id: categories.map((c) => c.id) },
          raw: true,
        });
        const orderMap = {};
        existingOrders.forEach((r) => {
          if (r.ordering != null) orderMap[r.id] = r.ordering;
        });
        const categoriesWithOrder = categories.map((c) => ({
          ...c,
          ordering: orderMap[c.id] != null ? orderMap[c.id] : (c.ordering ?? 0),
        }));
        const updateKeys = Object.keys(categoriesWithOrder[0]).filter(
          (key) => CategoriesModel.rawAttributes[key] && key !== "ordering",
        );
        await bulkCreateInChunks(CategoriesModel, categoriesWithOrder, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }

    // Orphan kateqoriyaları təmizlə: general_categorie_id = 1 qalıb amma
    // id=1 olan general category yoxdursa → 0 et (ROOT view-da görsənsin)
    try {
      const [, fixMeta] = await db.sequelize.query(`
        UPDATE categories
        SET general_categorie_id = 0
        WHERE profile_id = ?
          AND general_categorie_id IS NOT NULL
          AND general_categorie_id != 0
          AND general_categorie_id NOT IN (
            SELECT id FROM general_categories WHERE profile_id = ?
          )
      `, {
        replacements: [profile_id, profile_id],
        type: db.sequelize.QueryTypes.UPDATE,
      });
      const fixedCount = fixMeta?.affectedRows || 0;
      if (fixedCount > 0) {
        console.log(`[Categories] ${fixedCount} orphan kategoriya təmizləndi (general_categorie_id → 0)`);
      }
    } catch (cleanErr) {
      console.warn("[Categories] Orphan cleanup xətası:", cleanErr.message);
    }
  } catch (err) {
    console.error("Categories Error:", err);
  }
};

const getProducts = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    // V1, V2, V3(local admin) və modifiers-i eyni anda paralel çək.
    // Diqqət: timeout olmadan, şəkilləri böyük olan profillərdə bir mənbə
    // yavaş cavab verəndə bütün sinxronizasiya qeyri-müəyyən müddət
    // gözləyirdi ("data çox gec gəlir"). 25s-dən sonra həmin mənbə
    // uğursuz sayılır, digərləri ilə davam edilir (Promise.allSettled).
    const PRODUCTS_FETCH_TIMEOUT_MS = 25000;
    const [v1Result, v2Result, v3Result, modResult] = await Promise.allSettled([
      axios.get(`http://46.224.8.157:35627/api/products/${profile_id}`, {
        timeout: PRODUCTS_FETCH_TIMEOUT_MS,
      }),
      axios.get(
        `https://api.unipos.tech/api/products?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
        { timeout: PRODUCTS_FETCH_TIMEOUT_MS },
      ),
      axios.get(
        `http://localhost:8089/api/products?profile_id=${profile_id}&limit=10000&per_page=10000&page=1`,
        { timeout: 5000 }, // lokal admin panel — işləmirsə tez cavab gəlməlidir
      ),
      axios.get(`http://46.224.8.157:35627/api/modifiers/${profile_id}`, {
        timeout: PRODUCTS_FETCH_TIMEOUT_MS,
      }),
    ]);

    if (v1Result.status === "rejected") {
      console.warn("[ProductsData] V1 API xətası:", v1Result.reason?.message);
    }

    // V2-dən printer_id, color, hourly_price, free_count, barcode çək
    const printerMap = {};
    const colorMap = {};
    const hourlyPriceMap = {};
    const freeCountMap = {};
    const barcodeMap = {};
    const productTypeMap = {};
    const timerIntervalsMap = {};
    const areOrdersIncludedMap = {};
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
        if (item.hourly_price != null)
          hourlyPriceMap[item.id] = item.hourly_price;
        if (item.free_count != null)
          freeCountMap[item.id] = Number(item.free_count) === 1 ? 1 : 0;
        if (item.barcode)
          barcodeMap[item.id] = item.barcode.toString();
        if (item.product_type)
          productTypeMap[item.id] = item.product_type;
        if (item.timer_intervals !== undefined)
          timerIntervalsMap[item.id] = item.timer_intervals;
        if (item.are_orders_included !== undefined)
          areOrdersIncludedMap[item.id] = item.are_orders_included;
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
      console.log(
        `[ProductsData] V3 local admin: ${v3Items.length} məhsul gəldi`,
      );
      v3Items.forEach((item) => {
        if (!item.name) return;
        const extractedPrinterId = extractPrinterIdString(item);
        if (item.id && extractedPrinterId) {
          v3IdMap[item.id] = extractedPrinterId;
        }
        if (extractedPrinterId || item.printer_details?.length > 0) {
          v3NameMap[item.name.toLowerCase().trim()] = {
            printer_id: extractedPrinterId,
            printer_details: item.printer_details || [],
          };
          console.log(
            `[ProductsData] V3: "${item.name}" → printer_id:${extractedPrinterId}, printers:[${(item.printer_details || []).map((p) => p.name).join(",")}]`,
          );
        }
      });
    } else {
      console.warn(
        "[ProductsData] V3 local admin xətası (optional):",
        v3Result.reason?.message,
      );
    }

    // Modifiers çək
    const modifierMap = {};
    if (modResult.status === "fulfilled") {
      const groups = modResult.value.data?.data || [];
      groups.forEach((group) => {
        const gid = Number(group.product_id);
        if (!Number.isFinite(gid)) return;
        if (!modifierMap[gid]) modifierMap[gid] = [];
        modifierMap[gid].push({
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
      console.log(
        `[ProductsData] Modifier groups çəkildi: ${groups.length} group`,
      );
    } else {
      console.error(
        "[ProductsData] Modifiers API xətası:",
        modResult.reason?.message,
      );
    }

    const v1Products =
      v1Result.status === "fulfilled" &&
      Array.isArray(v1Result.value?.data?.data)
        ? v1Result.value.data.data
        : [];
    const v3ProductsRaw =
      v3Result.status === "fulfilled"
        ? Array.isArray(v3Result.value?.data)
          ? v3Result.value.data
          : v3Result.value?.data?.items || v3Result.value?.data?.data || []
        : [];

    const sourceProducts = v1Products.length > 0 ? v1Products : v3ProductsRaw;

    if (sourceProducts.length > 0) {
      const products = sourceProducts.map((p) => {
        Object.keys(p).forEach((k) => {
          if (p[k] === undefined) {
            if (k === "printer_id" || k === "modifier_groups" || k === "ingredient") {
              p[k] = null;
            } else {
              p[k] = 0;
            }
          }
        });
        // V2 əlavələri (köhnə cloud sahələri üçün fallback)
        if (printerMap[p.id]) p.printer_id = printerMap[p.id];
        // New local admin prioriteti: id uyğun gəlirsə həmişə üstün tut
        if (v3IdMap[p.id]) {
          p.printer_id = v3IdMap[p.id];
          console.log(
            `[ProductsData] V3 id match: "${p.name}" (#${p.id}) → printer_id:${p.printer_id}`,
          );
        }
        // V3 ad üzrə fallback match
        if (!p.printer_id || p.printer_id === "0") {
          const nameKey = p.name?.toLowerCase().trim();
          if (nameKey && v3NameMap[nameKey]?.printer_id) {
            p.printer_id = v3NameMap[nameKey].printer_id;
            console.log(
              `[ProductsData] V3 ad match: "${p.name}" → printer_id:${p.printer_id}`,
            );
          }
        }
        p.printer_id = normalizePrinterIdValue(p.printer_id);
        p.profile_id = profile_id;
        if (colorMap[p.id]) p.color = colorMap[p.id];
        if (hourlyPriceMap[p.id] != null) p.hourly_price = hourlyPriceMap[p.id];
        if (freeCountMap[p.id] != null) p.free_count = freeCountMap[p.id];
        if (barcodeMap[p.id] != null) p.barcode = barcodeMap[p.id];
        if (productTypeMap[p.id] != null) p.product_type = productTypeMap[p.id];
        p.timer_intervals = timerIntervalsMap[p.id] !== undefined ? timerIntervalsMap[p.id] : (p.timer_intervals ?? null);
        p.are_orders_included = areOrdersIncludedMap[p.id] !== undefined ? areOrdersIncludedMap[p.id] : (p.are_orders_included ?? 0);
        // /modifiers API-də bu məhsul üçün qrup varsa ondan istifadə et; yoxdursa V1/V3-dən gələn JSON terkib saxlanılır
        const pidNum = Number(p.id);
        if (Number.isFinite(pidNum) && Object.prototype.hasOwnProperty.call(modifierMap, pidNum)) {
          p.modifier_groups = modifierMap[pidNum];
        }
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
        existingOrders.forEach((r) => {
          if (r.ordering != null) orderMap[r.id] = r.ordering;
        });

        const productsWithOrder = products.map((p) => ({
          ...p,
          ordering: orderMap[p.id] != null ? orderMap[p.id] : (p.ordering ?? 0),
        }));

        const updateKeys = Object.keys(productsWithOrder[0]).filter(
          (key) =>
            ProductsModel.rawAttributes[key] &&
            key !== "ordering" &&
            key !== "modifier_groups" &&
            key !== "timer_intervals",
        );
        await bulkCreateInChunks(ProductsModel, productsWithOrder, {
          updateOnDuplicate: updateKeys,
        });

        // modifier_groups JSON — bulkCreate bu sahəni etibarlı yeniləmir; yalnız API-dən açıq gələndə yaz (undefined = DB-dəki köhnə saxlanılır)
        for (const p of productsWithOrder) {
          if (p.modifier_groups === undefined) continue;
          let value = null;
          const mg = p.modifier_groups;
          if (mg !== null && mg !== "") {
            value = typeof mg === "string" ? mg : JSON.stringify(mg);
          }
          await ProductsModel.update(
            { modifier_groups: value },
            { where: { id: p.id, profile_id } },
          );
        }

        // timer_intervals JSON
        for (const p of productsWithOrder) {
          if (p.timer_intervals === undefined) continue;
          let timerVal = null;
          const ti = p.timer_intervals;
          if (ti !== null && ti !== "") {
            timerVal = typeof ti === "string" ? ti : JSON.stringify(ti);
          }
          await ProductsModel.update(
            { timer_intervals: timerVal },
            { where: { id: p.id, profile_id } },
          );
        }
      }

      console.log(
        `[ProductsData] Products DB sync olundu: ${products.length} məhsul insert/update + silindi`,
      );
    } else {
      console.warn(
        "[ProductsData] Heç bir məhsul mənbədən gəlmədi (V1/V3 boşdur)",
      );
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getGeneralCategories, getCategories, getProducts };
