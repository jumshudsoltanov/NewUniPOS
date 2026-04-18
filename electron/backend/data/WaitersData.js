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
        w.profile_id = profile_id;
        return w;
      });

      // V2 API-dən əlavə field-lər çək (require_comment_for_price_change, can_see_shortcuts, vs.)
      try {
        const v2Response = await axios.get(
          `https://api.unipos.tech/api/waiters?profile_id=${profile_id}&per_page=1000&limit=1000&page=1`,
        );
        const v2Items = v2Response.data?.items || v2Response.data?.data || [];
        if (Array.isArray(v2Items) && v2Items.length > 0) {
          const v2Map = {};
          v2Items.forEach((w) => { if (w.id) v2Map[w.id] = w; });

          // V2-dən gələn bütün model field-lərini merge et
          const modelFields = Object.keys(WaitersModel.rawAttributes);
          apiWaiters.forEach((w) => {
            const v2 = v2Map[w.id];
            if (!v2) return;
            modelFields.forEach((field) => {
              if (v2[field] !== undefined && v2[field] !== null) {
                w[field] = v2[field];
              }
            });
          });
        }
      } catch (e) {
        console.error("[WaitersData] V2 API xətası:", e.message);
      }

      const apiIds = apiWaiters.map((w) => w.id);

      if (apiIds.length > 0) {
        await WaitersModel.destroy({ where: { profile_id, id: { [Op.notIn]: apiIds }, is_local: { [Op.ne]: 1 } }, force: true });
      } else {
        await WaitersModel.destroy({ where: { profile_id, is_local: { [Op.ne]: 1 } }, force: true });
      }

      if (apiWaiters.length > 0) {
        const updateKeys = Object.keys(apiWaiters[0]).filter(
          (key) => WaitersModel.rawAttributes[key],
        );
        await WaitersModel.bulkCreate(apiWaiters, {
          updateOnDuplicate: updateKeys,
        });
      }

      console.log("Waiters DB sync olundu: insert/update + silindi");
    }
  } catch (err) {
    console.error("Xəta:", err.message);
  }
};



module.exports = { profileData, getWaitersList };
