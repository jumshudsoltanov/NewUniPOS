const { default: axios } = require("axios");
const SalesTypesModal = require("../model/SalesTypesModal");
const LoginModel = require("../model/LoginModel");
const { Op } = require("sequelize");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getSalesTypes = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/sale-types/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const salestypes = response.data.data.map((g) => {
        Object.keys(g).forEach((k) => {
          if (g[k] === undefined) g[k] = 0;
        });
        g.profile_id = profile_id;
        return g;
      });

      if (salestypes.length === 0) return;

      const apiIds = salestypes.map((g) => g.id);

      // DB-də olub, API-da olmayanları sil
      await SalesTypesModal.destroy({
        where: { id: { [Op.notIn]: apiIds } },
      });

      // Insert / update
      const updateSaleTypes = Object.keys(salestypes[0]).filter(
        (key) => SalesTypesModal.rawAttributes[key],
      );

      await SalesTypesModal.bulkCreate(salestypes, {
        updateOnDuplicate: updateSaleTypes,
      });

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Sale Types Error:", err);
  }
};

module.exports = { getSalesTypes };
