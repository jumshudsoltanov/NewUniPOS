const ProductsModel = require("../model/ProductsModel");
const axios = require("axios");
const hostBridge = require("../hostBridge");

const API_URL = "https://api.unipos.tech/api/products";

/**
 * Məhsul yaratma/dəyişmə yalnız `api.unipos.tech`-dədir.
 *
 * Əvvəl `.catch()` ilə `http://46.224.8.157:35627/api/products`-a keçilirdi,
 * amma qrapi-də məhsul YALNIZ OXUNUR — POST/PUT orada yoxdur. Yəni ehtiyat
 * cəhd həmişə uğursuz olurdu və əsl xətanı gizlədirdi: `.catch()` ikinci
 * sorğunun xətasını atırdı, ona görə loqda "products 404" görünürdü, halbuki
 * problem əsas serverdə idi. Mənbə: QR_ORDER_SOCKET_PLAN.md, 8-ci bənd.
 */
const apiPost = (url, data) => axios.post(url, data);
const apiPut = (url, data) => axios.put(url, data);

exports.createProduct = async (req, res) => {
    try {
        const { profile_id, ...productData } = req.body;

        // 1. Send to Remote Admin API
        const response = await apiPost(API_URL, { ...productData, profile_id });

        if (response.data) {
            const newProduct = response.data;

            // 2. Save to Local DB
            // Ensure fields match what local DB expects
            // Local DB fields: name, price, product_type, etc.
            // Map remote response to local model if needed

            await ProductsModel.create({
                ...newProduct,
                profile_id: profile_id || newProduct.profile_id
            });

            res.status(201).json(newProduct);
        } else {
            throw new Error("Failed to create product on remote server");
        }
    } catch (error) {
        console.error("Create Product Error:", error.message);
        res.status(500).json({ message: "Failed to create product", error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { profile_id, ...productData } = req.body;

        // 1. Send to Remote Admin API
        const response = await apiPut(`${API_URL}/${id}`, { ...productData, profile_id });

        if (response.data) {
            const updatedProduct = response.data;

            // 2. Update Local DB
            await ProductsModel.update(updatedProduct, {
                where: { id: id }
            });

            res.status(200).json(updatedProduct);
        } else {
            throw new Error("Failed to update product on remote server");
        }
    } catch (error) {
        console.error("Update Product Error:", error.message);
        res.status(500).json({ message: "Failed to update product", error: error.message });
    }
};

exports.updateModifierGroups = async (req, res) => {
    try {
        const { id } = req.params;
        let { modifier_groups } = req.body;
        const value = Array.isArray(modifier_groups)
            ? JSON.stringify(modifier_groups)
            : typeof modifier_groups === 'string'
                ? modifier_groups
                : JSON.stringify([]);
        const [rowsUpdated] = await ProductsModel.update(
            { modifier_groups: value },
            { where: { id: Number(id) } }
        );
        console.log(`[MODIFIER] Product ${id} updated, rows: ${rowsUpdated}, value length: ${value.length}`);
        try {
            const parsed = JSON.parse(value);
            // Backend ayrı prosesdə işlədiyi üçün `global.mainWindow` burada yoxdur;
            // hostBridge mesajı main.js-ə ötürür, o da pəncərəyə göndərir.
            hostBridge.sendToRenderer('modifier-groups-updated', { productId: Number(id), modifier_groups: parsed });
        } catch (_) {}
        res.status(200).json({ message: "ok", rowsUpdated });
    } catch (error) {
        console.error("Update Modifier Groups Error:", error.message);
        res.status(500).json({ message: "Failed to update modifier groups", error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { profile_id } = req.body; // Expect profile_id in body if needed, or fetch it

        // 1. Send to Remote Admin API (Soft Delete via Update)
        await apiPut(`${API_URL}/${id}`, {
            is_hidden_pos: 1,
            is_hidden_qr: 1,
            profile_id
        });

        // 2. Update Local DB (Soft Delete)
        await ProductsModel.update({
            is_hidden_pos: 1,
            is_hidden_qr: 1
        }, {
            where: { id: id }
        });

        res.status(200).json({ message: "Product deleted (hidden) successfully" });
    } catch (error) {
        console.error("Delete Product Error:", error.message);
        res.status(500).json({ message: "Failed to delete product", error: error.message });
    }
};
