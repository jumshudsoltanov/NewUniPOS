const axios = require("axios");
const { Op } = require("sequelize");
const TagsModel = require("../model/TagsModel");
const LoginModel = require("../model/LoginModel");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getTags = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/tags/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const apiTables = response.data.data.map((t) => {
        Object.keys(t).forEach((k) => {
          if (t[k] === undefined) t[k] = 0;
        });
        t.profile_id = profile_id;
        return t;
      });

      const apiIds = apiTables.map((t) => t.id);

      if (apiIds.length > 0) {
        await TagsModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id }, force: true });
      } else {
        await TagsModel.destroy({ where: { profile_id }, force: true });
      }

      // Insert / update
      if (apiTables.length > 0) {
        await TagsModel.bulkCreate(apiTables, {
          updateOnDuplicate: Object.keys(apiTables[0]),
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};

module.exports = { getTags };
