const axios = require("axios");
const LoginModel = require("../model/LoginModel");
const WaitersModel = require("../model/WaitersModel");
const { Op } = require("sequelize");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getWaitersList = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/waiters/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const apiWaiters = response.data.data.map((w) => {
        Object.keys(w).forEach((k) => {
          if (w[k] === undefined) w[k] = 0;
        });
        w.profile_id = profile_id; // Inject profile_id
        return w;
      });

      const apiIds = apiWaiters.map((w) => w.id);

      // DB-də olub, API-da olmayanları sil (hard delete)
      if (apiIds.length > 0) {
        await WaitersModel.destroy({ where: { id: { [Op.notIn]: apiIds } }, force: true });
      } else {
        await WaitersModel.destroy({ where: {}, force: true }); // Bütün ofisiantları sil
      }

      // Insert / update
      if (apiWaiters.length > 0) {
        await WaitersModel.bulkCreate(apiWaiters, {
          updateOnDuplicate: Object.keys(apiWaiters[0]),
        });
      }

      console.log("DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};



module.exports = { profileData, getWaitersList };
