const PrintersModel = require("../model/PrintersModel");
const LoginModel = require("../model/LoginModel");

const getPrinters = async (req, res) => {
    const { profileId } = req.params;
    try {
        const printers = await PrintersModel.findAll({
            where: { profile_id: profileId },
        });
        res.status(200).json({ message: "success", data: printers });
    } catch (error) {
        console.error("getPrinters Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const updatePrinter = async (req, res) => {
    const { id } = req.params;
    const { name, local_name, ip, port, is_cashier, type, connection_type, usb_name } = req.body;
    try {
        await PrintersModel.update(
            { name, local_name, ip, port, is_cashier, type, connection_type, usb_name },
            { where: { id } }
        );
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

const toggleMasterPrinting = async (req, res) => {
    const { profileId, status, type } = req.body; // type: 'cashier' or 'product'
    try {
        const field = type === 'cashier' ? 'is_master_cashier_printing' : 'is_master_product_printing';
        await LoginModel.update({ [field]: status ? 1 : 0 }, { where: { id: profileId } });
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Toggle failed", error: error.message });
    }
};

const testPrint = async (req, res) => {
    const { printerName } = req.body;
    try {
        const { ipcMain } = require("electron");
        res.status(200).json({ message: "Test print command sent" });
    } catch (error) {
        res.status(500).json({ message: "Test print failed" });
    }
};

const updateCustomerDisplaySettings = async (req, res) => {
    const { profileId, isActive, screenId } = req.body;
    try {
        await LoginModel.update({
            is_customer_display_active: isActive ? 1 : 0,
            customer_display_screen_id: screenId
        }, { where: { id: profileId } });
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

module.exports = { getPrinters, updatePrinter, toggleMasterPrinting, testPrint, updateCustomerDisplaySettings };
