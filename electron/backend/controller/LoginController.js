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

    const response = await axios.post(
      "http://46.224.8.157:35627/api/terminal/login",
      {
        username: username,
        terminal_id: terminalId,
        terminal_password: password,
      },
    );

    const profile = response.data?.data?.profile;

    if (!profile) {
      return res.status(400).json({ message: "Profile tapılmadı" });
    }

    await LoginModel.upsert({
      profile_id: profile.id,
      ...profile,
    });

    // Fetch initial data after login
    await getWaitersList(profile.id);
    await getTableGroups(profile.id);
    await getTables(profile.id);
    await getGeneralCategories(profile.id);
    await getCategories(profile.id);
    await getProducts(profile.id);
    await getTags(profile.id);
    await getPaymentMethods(profile.id);
    await getSalesTypes(profile.id);

    // Fetch the stored profile so we include local fields like background_img
    const storedProfile = await LoginModel.findOne({ where: { id: profile.id } });
    if (storedProfile && response.data && response.data.data && response.data.data.profile) {
      response.data.data.profile = {
        ...response.data.data.profile,
        ...storedProfile.toJSON()
      };
    }

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({
      message: "Login zamanı xəta baş verdi",
      error: error.response?.data || error.message,
    });
  }
};

module.exports = { getLogin };
