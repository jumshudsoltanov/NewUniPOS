const WaitersModel = require("../model/WaitersModel");

const getWaiterInfo = async (req, res) => {
  const { pin } = req.params;
  try {
    const waiter = await WaitersModel.findOne({ where: { pin: pin } });
    if (!waiter) {
      res.status(200).json({ message: "false", data: "waiter not found" });
    }
    res.status(200).json({ message: "success", data: waiter });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getWaiterLists = async (req, res) => {
  const { profileId } = req.params;
  try {
    const waiters = await WaitersModel.findAll({
      where: { profile_id: profileId },
      attributes: ["id", "name"],
    });
    if (!waiters) {
      res.status(200).json({ message: "false", data: "waiter not found" });
    }
    res.status(200).json({ message: "success", data: waiters });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getWaiterInfo, getWaiterLists };
