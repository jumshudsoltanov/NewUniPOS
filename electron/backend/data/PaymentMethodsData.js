const PaymentMethodsModel = require("../model/PaymentMethodsModel");
const LoginModel = require("../model/LoginModel");
const { Op } = require("sequelize");
const { default: axios } = require("axios");

const profileData = async () => {
  const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
  return profile ? profile.id : null;
};


const getPaymentMethods = async (passedProfileId) => {
  try {
    const profile_id = passedProfileId || (await profileData());
    if (!profile_id) throw new Error("Profile ID tapılmadı");

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/payment-methods/${profile_id}`,
    );

    if (response.data && Array.isArray(response.data.data)) {
      const paymentMethods = response.data.data.map((p) => {
        Object.keys(p).forEach((k) => {
          if (p[k] === undefined) p[k] = 0;
        });
        p.profile_id = profile_id;
        return p;
      });

      if (paymentMethods.length === 0) return;

      const apiIds = paymentMethods.map((g) => g.id);

      // DB-də olub, API-da olmayanları sil
      await PaymentMethodsModel.destroy({
        where: { id: { [Op.notIn]: apiIds } },
      });

      // Insert / update
      const updateKeys = Object.keys(
        paymentMethods[0],
      ).filter((key) => PaymentMethodsModel.rawAttributes[key]);

      await PaymentMethodsModel.bulkCreate(paymentMethods, {
        updateOnDuplicate: updateKeys,
      });

      console.log("Payment Methods DB sync olundu");
    }
  } catch (err) {
    console.error("Payment Methods Error:", err);
  }
};



module.exports = { getPaymentMethods }