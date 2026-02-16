const PrintersModel = require("../model/PrintersModel");

const getPrinters = async (req, res) => {
    const { profileId } = req.params;
    try {
        const printers = await PrintersModel.findAll({
            where: { profile_id: profileId },
        });

        if (printers.length === 0) {
            return res.status(200).json({ message: "false", data: [] });
        }

        res.status(200).json({ message: "success", data: printers });
    } catch (error) {
        console.error("Printers Controller Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { getPrinters };
