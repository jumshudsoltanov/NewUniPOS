const { default: axios } = require("axios");
const LoginModel = require("../model/LoginModel");
const PrintersModel = require("../model/PrintersModel");
const { Op } = require("sequelize");

const profileData = async () => {
    const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
    return profile ? profile.id : null;
};

const getPrinters = async (passedProfileId) => {
    try {
        const profile_id = passedProfileId || (await profileData());
        if (!profile_id) throw new Error("Profile ID tapılmadı");

        const response = await axios.get(
            `http://46.224.8.157:35627/api/pos/printers/${profile_id}`,
        );

        if (response.data && Array.isArray(response.data.data)) {
            const apiPrinters = response.data.data.map((p) => {
                Object.keys(p).forEach((k) => {
                    if (p[k] === undefined) p[k] = null;
                });
                p.profile_id = profile_id; // Inject profile_id
                return p;
            });

            const apiIds = apiPrinters.map((p) => p.id);

            // Delete printers not in API response
            if (apiIds.length > 0) {
                await PrintersModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id } });
            } else {
                await PrintersModel.destroy({ where: { profile_id } });
            }

            // Insert / update
            await PrintersModel.bulkCreate(apiPrinters, {
                updateOnDuplicate: ["profile_id", "name", "local_name", "is_cashier", "type"],
            });

            console.log("Printers DB sync olundu: insert/update + silindi");
        }
    } catch (err) {
        console.error("Printers Data Error:", err.message);
    }
};

module.exports = { getPrinters };
