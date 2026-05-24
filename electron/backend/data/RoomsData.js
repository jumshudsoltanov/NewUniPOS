const axios = require("axios");
const LoginModel = require("../model/LoginModel");
const RoomModel = require("../model/RoomModel");
const { Op } = require("sequelize");

const API_BASE = "https://api.unipos.tech/api";

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};

const getRooms = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    // Əvvəlcə V2 API-dən (api.unipos.tech) otaqları çək
    let apiRooms = [];
    try {
      const v2resp = await axios.get(`${API_BASE}/rooms`, {
        params: { profile_id },
        timeout: 10000,
      });
      apiRooms = v2resp.data;
      if (!Array.isArray(apiRooms)) apiRooms = apiRooms?.data || [];
    } catch (e) {
      console.warn("[RoomsData] V2 API xətası:", e.message);
      // Fallback: V1 sync server
      try {
        const v1resp = await axios.get(`http://46.224.8.157:35627/api/rooms/${profile_id}`, { timeout: 10000 });
        apiRooms = v1resp.data;
        if (!Array.isArray(apiRooms)) apiRooms = apiRooms?.data || [];
      } catch (e2) {
        console.warn("[RoomsData] V1 API xətası:", e2.message);
      }
    }

    if (Array.isArray(apiRooms) && apiRooms.length > 0) {
      apiRooms = apiRooms.map((r) => {
        Object.keys(r).forEach((k) => {
          if (r[k] === undefined) r[k] = null;
        });
        r.profile_id = profile_id;
        return r;
      });

      const apiIds = apiRooms.map((r) => r.id);
      if (apiIds.length > 0) {
        await RoomModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id }, force: true });
      } else {
        await RoomModel.destroy({ where: { profile_id }, force: true });
      }

      const updateKeys = Object.keys(apiRooms[0]).filter(
        (key) => RoomModel.rawAttributes[key],
      );
      await RoomModel.bulkCreate(apiRooms, {
        updateOnDuplicate: updateKeys,
      });

      console.log(`Rooms DB sync olundu: ${apiRooms.length} otaq`);
    } else {
      await RoomModel.destroy({ where: { profile_id }, force: true });
      console.log("Rooms DB sync: 0 otaq (serverdə otaq yoxdur)");
    }
  } catch (err) {
    console.error("[RoomsData] Sync xətası:", err.message);
  }
};

module.exports = { getRooms };
