const axios = require("axios");
const LoginModel = require("../model/LoginModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const TablesModel = require("../model/TablesModel");
const { Op } = require("sequelize");
const db = require("../database/config");

const { QueryTypes } = require("sequelize");

const dropTablesForeignKeys = async () => {
  try {
    const constraints = await db.sequelize.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tables' AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
      { type: QueryTypes.SELECT }
    );
    for (const row of constraints) {
      await db.sequelize.query('ALTER TABLE `tables` DROP FOREIGN KEY `' + row.CONSTRAINT_NAME + '`', { type: QueryTypes.RAW });
      console.log('[TablesData] tables FK silindi: ' + row.CONSTRAINT_NAME);
    }
  } catch (_) {}
};

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
        tg.profile_id = profile_id;
        return tg;
      });

      // V2 API-dən table-groups əlavə field-lərini çək
      try {
        const v2Response = await axios.get(
          `https://api.unipos.tech/api/table-groups?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
        );
        const v2Items = v2Response.data?.items || v2Response.data?.data || [];
        if (Array.isArray(v2Items) && v2Items.length > 0) {
          const v2Map = {};
          v2Items.forEach((tg) => { if (tg.id) v2Map[tg.id] = tg; });
          const modelFields = Object.keys(TableGroupsModel.rawAttributes);
          apiTableGroups.forEach((tg) => {
            const v2 = v2Map[tg.id];
            if (!v2) return;
            modelFields.forEach((field) => {
              if (v2[field] !== undefined && v2[field] !== null) {
                tg[field] = v2[field];
              }
            });
          });
        }
      } catch (e) {
        console.error("[TablesData] V2 table-groups API xətası:", e.message);
      }

      const apiIds = apiTableGroups.map((tg) => tg.id);

      if (apiIds.length > 0) {
        await TableGroupsModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id }, force: true });
      } else {
        await TableGroupsModel.destroy({ where: { profile_id }, force: true });
      }

      if (apiTableGroups.length > 0) {
        const updateKeys = Object.keys(apiTableGroups[0]).filter(
          (key) => TableGroupsModel.rawAttributes[key],
        );
        await TableGroupsModel.bulkCreate(apiTableGroups, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("TableGroups DB sync olundu: insert/update + silindi");
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
        t.profile_id = profile_id;
        return t;
      });

      // V2 API-dən tables əlavə field-lərini çək (hourly_price, deposit, shape_type, vs.)
      try {
        const v2Response = await axios.get(
          `https://api.unipos.tech/api/tables?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
        );
        const v2Items = v2Response.data?.items || v2Response.data?.data || [];
        if (Array.isArray(v2Items) && v2Items.length > 0) {
          const v2Map = {};
          v2Items.forEach((t) => { if (t.id) v2Map[t.id] = t; });
          const modelFields = Object.keys(TablesModel.rawAttributes);
          apiTables.forEach((t) => {
            const v2 = v2Map[t.id];
            if (!v2) return;
            modelFields.forEach((field) => {
              if (v2[field] !== undefined && v2[field] !== null) {
                t[field] = v2[field];
              }
            });
          });
        }
      } catch (e) {
        console.error("[TablesData] V2 tables API xətası:", e.message);
      }

      const apiIds = apiTables.map((t) => t.id);

      if (apiIds.length > 0) {
        await TablesModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id }, force: true });
      } else {
        await TablesModel.destroy({ where: { profile_id }, force: true });
      }

      await dropTablesForeignKeys();
      if (apiTables.length > 0) {
        const updateKeys = Object.keys(apiTables[0]).filter(
          (key) => TablesModel.rawAttributes[key],
        );
        await TablesModel.bulkCreate(apiTables, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("Tables DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getTableGroups, getTables };
