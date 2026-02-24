const axios = require("axios");
const LoginModel = require("../model/LoginModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const TablesModel = require("../model/TablesModel");
const { Op } = require("sequelize");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getTableGroups = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
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
      if (apiIds.length > 0) {
        await TableGroupsModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id }, force: true });
      } else {
        await TableGroupsModel.destroy({ where: { profile_id }, force: true });
      }

      // Insert / update
      if (apiTableGroups.length > 0) {
        await TableGroupsModel.bulkCreate(apiTableGroups, {
          updateOnDuplicate: Object.keys(apiTableGroups[0]),
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

const getTables = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
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
      if (apiIds.length > 0) {
        await TablesModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id }, force: true });
      } else {
        await TablesModel.destroy({ where: { profile_id }, force: true });
      }

      // Insert / update
      if (apiTables.length > 0) {
        await TablesModel.bulkCreate(apiTables, {
          updateOnDuplicate: Object.keys(apiTables[0]),
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getTableGroups, getTables };
