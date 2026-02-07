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

    console.log(`Payment Methods çəkilir... Profile ID: ${profile_id}`);

    const response = await axios.get(
      `http://46.224.8.157:35627/api/pos/payment-methods/${profile_id}`,
    );

    // Genişləndirilmiş data yoxlanışı
    let rawData = null;
    if (response.data) {
      if (Array.isArray(response.data)) {
        rawData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        rawData = response.data.data;
      } else if (response.data.paymentMethods && Array.isArray(response.data.paymentMethods)) {
        rawData = response.data.paymentMethods;
      } else if (response.data.paymentMehods && Array.isArray(response.data.paymentMehods)) {
        rawData = response.data.paymentMehods;
      }
    }

    if (rawData && Array.isArray(rawData)) {
      console.log(`API-dan ${rawData.length} ədəd data gəldi.`);

      const paymentMethods = rawData.map((p) => {
        const item = { ...p };
        item.profile_id = profile_id;

        if (item.is_split === undefined || item.is_split === null) item.is_split = 0;
        if (item.is_tax === undefined || item.is_tax === null) item.is_tax = 0;
        if (!item.type) item.type = "other";
        if (!item.name) item.name = "Unknown";

        return item;
      });

      if (paymentMethods.length === 0) {
        console.log("API-dan heç bir ödəniş üsulu gəlmədi");
        return;
      }

      const apiIds = paymentMethods.map((g) => g.id);

      // DB-də olub, API-da olmayanları sil (yalnız bu profil üçün)
      const deletedCount = await PaymentMethodsModel.destroy({
        where: {
          id: { [Op.notIn]: apiIds },
          profile_id: profile_id
        },
      });
      console.log(`${deletedCount} ədəd köhnə data silindi.`);

      // Insert / update üçün sahələri təyin edək (id-ni update siyahısından çıxarırıq)
      const updateKeys = Object.keys(PaymentMethodsModel.rawAttributes).filter(
        (key) => key !== "id" && key !== "createdAt" && key !== "updatedAt"
      );

      try {
        await PaymentMethodsModel.bulkCreate(paymentMethods, {
          updateOnDuplicate: updateKeys,
        });
        console.log(`Payment Methods uğurla sync olundu: ${paymentMethods.length} ədəd`);
      } catch (bulkErr) {
        console.error("bulkCreate xətası:", bulkErr.message);
        if (bulkErr.errors) {
          bulkErr.errors.forEach(e => console.error("Validasiya/SQL xətası:", e.message));
        }
      }
    } else {
      console.log("API-dan gözlənilməz format gəldi:", JSON.stringify(response.data).substring(0, 200));
    }
  } catch (err) {
    console.error("Payment Methods Error:", err.message || err);
  }
};



module.exports = { getPaymentMethods }