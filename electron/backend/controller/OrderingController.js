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
        const { orderedItems, profile_id } = req.body;
        if (!orderedItems || !Array.isArray(orderedItems)) {
            return res.status(400).json({ message: "orderedItems tələb olunur" });
        }
        const payload = { orderedItems, profile_id };
        let adminSaved = false;
        for (const [base, path] of [[ADMIN_API, adminPath], [CLOUD_API, cloudPath]]) {
            try {
                const response = await axios.put(`${base}${path}`, payload, { timeout: 10000 });
                if (response.status >= 200 && response.status < 300) {
                    adminSaved = true;
                    if (base === ADMIN_API) console.log("[Ordering] Admin API uğurlu:", base + path);
                    break;
                }
            } catch (e) {
                if (e?.response?.status === 404 || e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND") continue;
                console.warn("[Ordering] API cəhdi:", base + path, e?.message);
            }
        }
        if (Model) {
            await updateLocalOrdering(Model, orderedItems, profile_id);
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
