const axios = require("axios");
const db = require("../database/config");

const LOCAL_ADMIN_API = "http://46.224.8.157:8089/api";
const CLOUD_API = "https://api.unipos.tech/api";

const updateLocalOrdering = async (tableName, orderedItems) => {
    for (let i = 0; i < orderedItems.length; i++) {
        const { id, ordering } = orderedItems[i];
        if (id != null) {
            const val = ordering ?? i + 1;
            await db.sequelize.query(
                `UPDATE \`${tableName}\` SET \`ordering\` = :val WHERE \`id\` = :id`,
                { replacements: { val, id }, type: db.Sequelize.QueryTypes.UPDATE }
            );
        }
    }
};

// Verilmiş URL-ə PUT sorğusu göndər
const tryPut = async (url, payload) => {
    try {
        const response = await axios.put(url, payload, { timeout: 10000 });
        if (response.status >= 200 && response.status < 300) {
            console.log("[Ordering] Uğurlu:", url);
            return true;
        }
    } catch (e) {
        console.warn("[Ordering] Xəta:", url, e?.response?.status || e?.message);
    }
    return false;
};

const forwardOrdering = (adminPath, cloudPath, tableName) => async (req, res) => {
    try {
        const { orderedItems, profile_id, category_id } = req.body;
        if (!orderedItems || !Array.isArray(orderedItems)) {
            return res.status(400).json({ message: "orderedItems tələb olunur" });
        }
        // 1. Local DB-ni raw SQL ilə yenilə
        await updateLocalOrdering(tableName, orderedItems);
        const payload = { orderedItems, profile_id };
        if (category_id != null) payload.category_id = category_id;

        // 2. Admin və Cloud-a paralel göndər
        await Promise.allSettled([
            tryPut(`${LOCAL_ADMIN_API}${adminPath}`, payload),
            tryPut(`${CLOUD_API}${cloudPath}`, payload),
        ]);

        return res.status(200).json({ success: true, message: "Sıralama yadda saxlanıldı" });
    } catch (error) {
        console.error("Ordering Error:", error?.response?.data || error.message);
        res.status(error?.response?.status || 500).json(
            error?.response?.data || { message: "Ordering xətası" }
        );
    }
};

exports.generalCategoriesOrdering = forwardOrdering("/general-categories/ordering", "/general-categories/ordering", "general_categories");
exports.categoriesOrdering = forwardOrdering("/categories/ordering", "/categories/ordering", "categories");
exports.productsOrdering = forwardOrdering("/products/ordering", "/products/ordering", "products");
