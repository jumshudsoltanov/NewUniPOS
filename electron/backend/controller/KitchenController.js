const OrdersItemsModel = require("../model/OrdersItemsModel");
const OrdersModel = require("../model/OrdersModel");
const ProductsModel = require("../model/ProductsModel");
const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const WaitersModel = require("../model/WaitersModel");
const { getIo } = require("../socket/MasterServer");

const getKitchenOrders = async (req, res) => {
    const { profileId } = req.params;
    try {
        const LoginModel = require("../model/LoginModel");

        let targetProfileId = profileId;
        // If profileId is missing or doesn't match local, try to find ANY local profile
        const localProfile = await LoginModel.findOne();
        if (localProfile && String(localProfile.id) !== String(profileId)) {
            targetProfileId = localProfile.id;
        }

        const orders = await OrdersModel.findAll({
            where: {
                profile_id: targetProfileId,
                status: [0, 1] // Active orders (0=new/provisional, 1=active)
            },
            include: [
                {
                    model: OrdersItemsModel,
                    as: "orders_items",
                    where: {
                        kds_status: [0, 1] // Pending or Preparing
                    },
                    include: [
                        {
                            model: ProductsModel,
                            as: "product",
                            attributes: ["name", "id"],
                            include: [
                                {
                                    model: require("../model/CategoriesModel"),
                                    as: "category",
                                    attributes: ["name"]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: TablesModel,
                    as: "table",
                    include: [
                        {
                            model: TableGroupsModel,
                            as: "hall"
                        }
                    ]
                },
                {
                    model: WaitersModel,
                    as: "waiter",
                    attributes: ["name"]
                }
            ],
            order: [["createdAt", "ASC"]]
        });

        res.json({ success: true, data: orders });
    } catch (error) {
        console.error("KDS Fetch Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateKdsStatus = async (req, res) => {
    const { itemId } = req.params;
    const { status } = req.body; // 1=preparing, 2=ready

    try {
        const item = await OrdersItemsModel.findByPk(itemId, {
            include: [
                { model: OrdersModel, as: "order" },
                { model: ProductsModel, as: "product" }
            ]
        });

        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        item.kds_status = status;
        await item.save();

        // Real-time notification
        const io = getIo();
        if (io) {
            if (status === 2) {
                // Notify POS that an item is ready
                io.emit("kitchen_item_ready", {
                    itemId,
                    orderId: item.order?.id || item.order_id, // Use numeric ID if available
                    productName: item.product?.name || "Məhsul",
                    tableName: item.order?.table_name || "Masa"
                });
            }
            // Sync all KDS screens
            io.emit("kds_update_trigger");
        }

        res.json({ success: true, message: "Status updated" });
    } catch (error) {
        console.error("KDS Status Update Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateKitchenDisplaySettings = async (req, res) => {
    const { profileId, isActive, screenId } = req.body;
    console.log("KDS: Received settings update request:", { profileId, isActive, screenId });
    try {
        const LoginModel = require("../model/LoginModel");
        let profile = await LoginModel.findByPk(profileId);

        if (!profile) {
            console.log("KDS: Profile not found by PK, trying findOne...");
            profile = await LoginModel.findOne();
        }

        if (profile) {
            console.log("KDS: Found profile for settings update:", profile.id);
            profile.is_kitchen_display_active = isActive ? 1 : 0;
            profile.kitchen_display_screen_id = screenId;
            await profile.save();
            res.json({ success: true, message: "Settings updated" });
        } else {
            console.error("KDS: NO PROFILE FOUND in database for settings update.");
            res.status(404).json({ success: false, message: "Profile not found" });
        }
    } catch (error) {
        console.error("KDS: Error in updateKitchenDisplaySettings:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getKitchenOrders,
    updateKdsStatus,
    updateKitchenDisplaySettings
};
