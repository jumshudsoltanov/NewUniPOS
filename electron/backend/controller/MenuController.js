const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");

const getMenuWithGeneralCategories = async (req, res) => {
  const { profileId } = req.params;

  try {
    const response = await GeneralCategoriesModel.findAll({
      where: { profile_id: profileId },
      include: {
        model: CategoriesModel,
        as: "categories",
        include: {
          model: ProductsModel,
          as: "products",
        },
      },
    });

    if (response.length === 0) {
      res
        .status(200)
        .json({ message: "false", data: "tables or halls not found" });
      return;
    }
    res.status(200).json({ message: "success", data: response });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMenuWithCategories = async (req, res) => {
  const { profileId } = req.params;

  try {
    const response = await CategoriesModel.findAll({
      where: { profile_id: profileId },
      include: {
        model: ProductsModel,
        as: "products",
      },
    });

    if (response.length === 0) {
      res
        .status(200)
        .json({ message: "false", data: "tables or halls not found" });
      return;
    }
    res.status(200).json({ message: "success", data: response });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getMenuWithGeneralCategories, getMenuWithCategories };
