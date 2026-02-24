const axios = require("axios");
const LoginModel = require("../model/LoginModel");
const { getWaitersList } = require("../data/WaitersData");
const { getTableGroups, getTables } = require("../data/TablesData");
const {
  getGeneralCategories,
  getCategories,
  getProducts,
} = require("../data/ProductsData");
const { getTags } = require("../data/TagsData");
const { getPaymentMethods } = require("../data/PaymentMethodsData");
const { getSalesTypes } = require("../data/SalesTypesData");
let token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9maWxlX2lkIjoxNCwidGVybWluYWxfaWQiOjYwMTUyNzM1LCJ0ZXJtaW5hbF9ncm91cF9pZCI6MjExLCJpc19tYXN0ZXIiOjEsInVzZXJuYW1lIjoidW5pcG9zIiwicmVzdGF1cmFudF9uYW1lIjoiVW5pUE9TIFRlY2hub2xvZ2llcyBSZXN0b3JhbiAiLCJpYXQiOjE3Njk0NDYwMDMsImV4cCI6MTgwMDk4MjAwM30.5xADfX7YasOcKKC9oP-w-949SAxbM_fUq_p13zSf4_8";

const getLogin = async (req, res) => {
  try {
    const { username, terminalId, password } = req.body;

    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await axios.post(
          "http://46.224.8.157:35627/api/terminal/login",
          {
            username: username,
            terminal_id: terminalId,
            terminal_password: password,
          },
        );
        break;
      } catch (apiErr) {
        if (apiErr.response?.status === 429 && attempts < maxAttempts - 1) {
          const retryAfter = parseInt(apiErr.response.headers['retry-after'] || '30', 10);
          const waitTime = Math.min(retryAfter, 60) * 1000;
          console.log(`Login 429 - retry ${attempts + 1}/${maxAttempts} after ${waitTime / 1000}s`);
          await new Promise(r => setTimeout(r, waitTime));
          attempts++;
        } else {
          throw apiErr;
        }
      }
    }

    const profile = response.data?.data?.profile;
    const terminal = response.data?.data?.terminal;

    if (!profile) {
      return res.status(400).json({ message: "Profile tapılmadı" });
    }

    const isMaster = terminal?.is_master == 1;
    const isMasterSlaveActive = terminal?.is_master_slave_active == 1;

    global.isMasterNode = isMaster;

    await LoginModel.destroy({ where: {} });

    const allowedFields = Object.keys(LoginModel.rawAttributes);
    const filteredProfile = {};
    Object.keys(profile).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredProfile[key] = profile[key];
      }
    });

    try {
      await LoginModel.upsert({
        ...filteredProfile,
        profile_id: profile.id,
        is_master: isMaster ? 1 : 0,
        is_master_slave_active: isMasterSlaveActive ? 1 : 0,
        kitchen_receipt: terminal?.kitchen_receipt !== undefined ? terminal.kitchen_receipt : filteredProfile.kitchen_receipt,
        customer_receipt: terminal?.customer_receipt !== undefined ? terminal.customer_receipt : filteredProfile.customer_receipt,
      });
    } catch (upsertError) {
      console.error("LoginModel Upsert Error:", upsertError.message);
    }

    if (global.isMasterNode) {
      if (global.httpServer) {
        const { initMasterServer } = require("../socket/MasterServer");
        initMasterServer(global.httpServer);
      }

      await getWaitersList(profile.id);
      await getTableGroups(profile.id);
      await getTables(profile.id);
      await getGeneralCategories(profile.id);
      await getCategories(profile.id);
      await getProducts(profile.id);
      await getTags(profile.id);
      await getPaymentMethods(profile.id);
      await getSalesTypes(profile.id);
    }

    try {
      const storedProfile = await LoginModel.findOne({ where: { id: profile.id } });
      if (storedProfile && response.data && response.data.data && response.data.data.profile) {
        response.data.data.profile = {
          ...response.data.data.profile,
          ...storedProfile.toJSON()
        };
      }
    } catch (dbError) {
      console.log("No local database available to fetch stored profile, continuing with cloud profile");
    }

    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = status === 429
      ? "Server çox yüklənib. Bir neçə dəqiqə gözləyib yenidən cəhd edin."
      : "Login zamanı xəta baş verdi";
    console.error("Login Controller Error:", status, error.response?.data?.message || error.message);
    res.status(status).json({
      message,
      error: error.response?.data || error.message,
    });
  }
};

module.exports = { getLogin };
