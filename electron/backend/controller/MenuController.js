const GeneralCategoriesModel = require("../model/GeneralCategoriesModel");
const CategoriesModel = require("../model/CategoriesModel");
const ProductsModel = require("../model/ProductsModel");
const PrintersModel = require("../model/PrintersModel");
const { Op } = require("sequelize");

/** Kateqoriyasız məhsulların göstərildiyi virtual "Digər" kateqoriyasının sabit id-si (real id-lərlə toqquşmur). */
const UNCATEGORIZED_CATEGORY_ID = -1;

const getMenuWithGeneralCategories = async (req, res) => {
  const { profileId } = req.params;

  try {
    const response = await GeneralCategoriesModel.findAll({
      where: { profile_id: profileId },
      order: [
        ['ordering', 'ASC'],
        [{ model: CategoriesModel, as: 'categories' }, 'ordering', 'ASC'],
      ],
      include: {
        model: CategoriesModel,
        as: "categories",
        include: {
          model: ProductsModel,
          as: "products",
          // Şəkil (base64) və tərkib POS-da bu endpoint-dən oxunmur — payload-u dəfələrlə kiçildir
          attributes: { exclude: ["img", "ingredient"] },
          where: { is_hidden_pos: { [Op.or]: [0, null] } },
          required: false,
        },
      },
    });

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
        .filter(Boolean);
    };

    const data = response.map((gc) => {
      const gcPlain = gc.get({ plain: true });
      if (gcPlain.categories) {
        gcPlain.categories.forEach((c) => {
          c.printer_details = attachPrinters(c);
          if (c.products) {
            c.products.sort((a, b) => {
              const ao = a.ordering != null ? a.ordering : 999999;
              const bo = b.ordering != null ? b.ordering : 999999;
              return ao - bo;
            });
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
    console.error("[MENU] xəta:", error.message);
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
        [{ model: ProductsModel, as: 'products' }, 'ordering', 'ASC'],
      ],
      include: {
        model: ProductsModel,
        as: "products",
        attributes: { exclude: ["ingredient"] },
        where: { is_hidden_pos: { [Op.or]: [0, null] } },
        required: false,
      },
    });

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
        .filter(Boolean);
    };

    const sortProducts = (list) =>
      list.sort((a, b) => {
        const ao = a.ordering != null ? a.ordering : 999999;
        const bo = b.ordering != null ? b.ordering : 999999;
        return ao - bo;
      });

    const data = response.map((c) => {
      const cPlain = c.get({ plain: true });
      cPlain.printer_details = attachPrinters(cPlain);
      if (cPlain.products) {
        sortProducts(cPlain.products);
        cPlain.products.forEach((p) => {
          p.printer_details = attachPrinters(p);
        });
      }
      return cPlain;
    });

    // Kateqoriyasız məhsullar (category_id boş/0 və ya mövcud olmayan kateqoriyaya aid)
    // əvvəl POS-da ümumiyyətlə görünmürdü. Onları "Digər" adlı virtual kateqoriyada göstəririk.
    const categoryIds = data.map((c) => c.id).filter((id) => id != null);
    const orphanWhere = {
      profile_id: profileId,
      is_hidden_pos: { [Op.or]: [0, null] },
      [Op.or]: [
        { category_id: null },
        { category_id: 0 },
        ...(categoryIds.length > 0 ? [{ category_id: { [Op.notIn]: categoryIds } }] : []),
      ],
    };
    const orphanProducts = await ProductsModel.findAll({
      where: orphanWhere,
      attributes: { exclude: ["ingredient"] },
      raw: true,
    });
    if (orphanProducts.length > 0) {
      sortProducts(orphanProducts);
      orphanProducts.forEach((p) => {
        p.printer_details = attachPrinters(p);
      });
      data.push({
        id: UNCATEGORIZED_CATEGORY_ID,
        profile_id: Number(profileId),
        name: "Digər",
        general_categorie_id: 0,
        ordering: 999999,
        is_virtual: 1,
        printer_id: null,
        printer_details: [],
        products: orphanProducts,
      });
    }

    res.status(200).json({ message: "success", data: data });
  } catch (error) {
    console.error("[MENU] xəta:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getMenuWithGeneralCategories, getMenuWithCategories };
