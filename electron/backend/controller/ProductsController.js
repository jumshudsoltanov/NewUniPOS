const ProductsModel = require("../model/ProductsModel");
const axios = require("axios");

const API_URL = "https://api.unipos.tech/api/products";
const API_URL_FALLBACK = "http://46.224.8.157:35627/api/products";

const apiPost = (url, data) => axios.post(url, data).catch(() => axios.post(url.replace("https://api.unipos.tech", "http://46.224.8.157:35627"), data));
const apiPut = (url, data) => axios.put(url, data).catch(() => axios.put(url.replace("https://api.unipos.tech", "http://46.224.8.157:35627"), data));

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
