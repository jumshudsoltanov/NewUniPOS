const SalesTypesModel = require("../model/SalesTypesModal");

const getSaleTypes = async (req, res) => {
  const { profileId } = req.params;

  try {
    const saleTypes = await SalesTypesModel.findAll({
      where: { profile_id: profileId },
    });

    res.status(200).json({ message: "success", data: saleTypes });
  } catch (error) {
    res.status(500).json({ message: "error", error: error.message });
  }
};

module.exports = { getSaleTypes };
