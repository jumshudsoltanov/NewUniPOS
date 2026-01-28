const { default: axios } = require("axios");
const LoginModel = require("../model/LoginModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const TablesModel = require("../model/TablesModel");
const { Op } = require("sequelize");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getTableGroups = async () => {
  try {
    const profile_id = await profileData();
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/tables/halls/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const apiTableGroups = response.data.data.map((tg) => {
        Object.keys(tg).forEach((k) => {
          if (tg[k] === undefined) tg[k] = 0;
        });
        tg.profile_id = profile_id; // Inject profile_id
        return tg;
      });

      const apiIds = apiTableGroups.map((tg) => tg.id);

      // DB-də olub, API-da olmayanları sil
      await TableGroupsModel.destroy({ where: { id: { [Op.notIn]: apiIds } } });

      // Insert / update
      await TableGroupsModel.bulkCreate(apiTableGroups, {
        updateOnDuplicate: Object.keys(apiTableGroups[0]),
      });

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

const getTables = async () => {
  try {
    const profile_id = await profileData();
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/tables/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const apiTables = response.data.data.map((t) => {
        Object.keys(t).forEach((k) => {
          if (t[k] === undefined) t[k] = 0;
        });
        t.profile_id = profile_id; // Inject profile_id
        return t;
      });

      const apiIds = apiTables.map((t) => t.id);

      // DB-də olub, API-da olmayanları sil
      await TablesModel.destroy({ where: { id: { [Op.notIn]: apiIds } } });

      // Insert / update
      await TablesModel.bulkCreate(apiTables, {
        updateOnDuplicate: Object.keys(apiTables[0]),
      });

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getTableGroups, getTables };
