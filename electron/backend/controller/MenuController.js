const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");
const PrintersModel = require("../model/PrintersModel");

const getMenuWithGeneralCategories = async (req, res) => {
  const { profileId } = req.params;

  try {
    const response = await GeneralCategoriesModel.findAll({
      where: { profile_id: profileId },
      order: [
        ['ordering', 'ASC'],
        [{ model: CategoriesModel, as: 'categories' }, 'ordering', 'ASC'],
        [{ model: CategoriesModel, as: 'categories' }, { model: ProductsModel, as: 'products' }, 'ordering', 'ASC']
      ],
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

    const printers = await PrintersModel.findAll({
      where: { profile_id: profileId },
      raw: true,
    });

    const printerMap = printers.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const attachPrinters = (item) => {
      if (!item.printer_id) return [];
      const ids = String(item.printer_id).split(",").map(Number);
      return ids
        .map((id) => printerMap[id])
        .filter(Boolean)
        .map((p) => ({ name: p.name, local_name: p.local_name }));
    };

    const data = response.map((gc) => {
      const gcPlain = gc.get({ plain: true });
      if (gcPlain.categories) {
        gcPlain.categories.forEach((c) => {
          c.printer_details = attachPrinters(c);
          if (c.products) {
            c.products.forEach((p) => {
              p.printer_details = attachPrinters(p);
            });
          }
        });
      }
      return gcPlain;
    });

    res.status(200).json({ message: "success", data: data });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMenuWithCategories = async (req, res) => {
  const { profileId } = req.params;

  try {
    const response = await CategoriesModel.findAll({
      where: { profile_id: profileId },
      order: [
        ['ordering', 'ASC'],
        [{ model: ProductsModel, as: 'products' }, 'ordering', 'ASC']
      ],
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

    const printers = await PrintersModel.findAll({
      where: { profile_id: profileId },
      raw: true,
    });

    const printerMap = printers.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const attachPrinters = (item) => {
      if (!item.printer_id) return [];
      const ids = String(item.printer_id).split(",").map(Number);
      return ids
        .map((id) => printerMap[id])
        .filter(Boolean)
        .map((p) => ({ name: p.name, local_name: p.local_name }));
    };

    const data = response.map((c) => {
      const cPlain = c.get({ plain: true });
      cPlain.printer_details = attachPrinters(cPlain);
      if (cPlain.products) {
        cPlain.products.forEach((p) => {
          p.printer_details = attachPrinters(p);
        });
      }
      return cPlain;
    });

    res.status(200).json({ message: "success", data: data });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getMenuWithGeneralCategories, getMenuWithCategories };
