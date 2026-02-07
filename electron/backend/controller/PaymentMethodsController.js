const PaymentMethodsModel = require("../model/PaymentMethodsModel");

const getPaymentMethodsList = async (req, res) => {
    const { profileId } = req.params;
    try {
        const paymentMethods = await PaymentMethodsModel.findAll({
            where: { profile_id: profileId },
            order: [["id", "ASC"]],
        });

        if (paymentMethods.length === 0) {
            res.status(200).json({ message: "false", data: [] });
            return;
        }

        res.status(200).json({ message: "success", data: paymentMethods });
    } catch (error) {
        console.error("Payment Methods Controller Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { getPaymentMethodsList };
