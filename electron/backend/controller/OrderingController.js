const axios = require("axios");
const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");

const ADMIN_API = "http://46.224.8.157:35627/api";
const CLOUD_API = "https://api.unipos.tech/api";

const updateLocalOrdering = async (Model, orderedItems, profile_id) => {
    for (let i = 0; i < orderedItems.length; i++) {
        const { id, ordering } = orderedItems[i];
        if (id != null) {
            const where = profile_id != null ? { id, profile_id } : { id };
            await Model.update({ ordering: ordering ?? i + 1 }, { where });
        }
    }
};

const forwardOrdering = (adminPath, cloudPath, Model) => async (req, res) => {
    try {
        const { orderedItems, profile_id, category_id } = req.body;
        if (!orderedItems || !Array.isArray(orderedItems)) {
            return res.status(400).json({ message: "orderedItems tələb olunur" });
        }
        // 1. Əvvəlcə local DB-ni yenilə (admin uğursuz olsa belə sıralama saxlanılsın)
        if (Model) {
            await updateLocalOrdering(Model, orderedItems, profile_id);
        }
        const payload = { orderedItems, profile_id };
        if (category_id != null) payload.category_id = category_id;
        let pathsToTry = [
            [ADMIN_API, "/pos" + adminPath],
            [ADMIN_API, adminPath],
            [CLOUD_API, cloudPath],
        ];
        if (adminPath === "/products/ordering" && category_id != null) {
            pathsToTry = [
                [ADMIN_API, `/pos/categories/${category_id}/products/ordering`],
                [ADMIN_API, `/categories/${category_id}/products/ordering`],
                ...pathsToTry,
            ];
        }
        for (const [base, path] of pathsToTry) {
            try {
                const response = await axios.put(`${base}${path}`, payload, { timeout: 10000 });
                if (response.status >= 200 && response.status < 300) {
                    console.log("[Ordering] API uğurlu:", base + path);
                    break;
                }
            } catch (e) {
                if (e?.response?.status === 404 || e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND") {
                    continue;
                }
                console.warn("[Ordering] API cəhdi:", base + path, e?.response?.status, e?.message);
            }
        }
        return res.status(200).json({ success: true, message: "Sıralama yadda saxlanıldı" });
    } catch (error) {
        console.error("Ordering Error:", error?.response?.data || error.message);
        res.status(error?.response?.status || 500).json(
            error?.response?.data || { message: "Ordering xətası" }
        );
    }
};

exports.generalCategoriesOrdering = forwardOrdering("/general-categories/ordering", "/general-categories/ordering", GeneralCategoriesModel);
exports.categoriesOrdering = forwardOrdering("/categories/ordering", "/categories/ordering", CategoriesModel);
exports.productsOrdering = forwardOrdering("/products/ordering", "/products/ordering", ProductsModel);
