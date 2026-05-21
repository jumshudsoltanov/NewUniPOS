const WaitersModel = require("../model/WaitersModel");
const { normalizeDigits } = require("../utils/normalizeDigits");

/**
 * PIN və ya card_id ilə ofisiant — profile_id mütləq (təhlükəsizlik + düzgün filial)
 * Query: ?profile_id=1&pin=1234  və ya  ?profile_id=1&card_id=...
 */
const resolveWaiterLogin = async (req, res) => {
  try {
    const profile_id = req.query.profile_id;
    const pin = req.query.pin;
    const card_id = req.query.card_id;

    if (profile_id == null || profile_id === "") {
      return res.status(400).json({ message: "false", data: "profile_id required" });
    }
    const pid = Number(profile_id);
    if (Number.isNaN(pid)) {
      return res.status(400).json({ message: "false", data: "invalid profile_id" });
    }

    const cardTrim = card_id != null ? String(card_id).trim() : "";
    const cardDigits = normalizeDigits(cardTrim);
    const pinTrim = pin != null ? String(pin).trim() : "";

    let waiter = null;
    if (cardTrim !== "") {
      if (cardDigits !== "" && cardDigits !== "0") {
        waiter = await WaitersModel.findOne({ where: { profile_id: pid, card_id: cardDigits } });

        if (!waiter) {
          const waiters = await WaitersModel.findAll({ where: { profile_id: pid } });
          waiter = waiters.find((w) => normalizeDigits(w?.card_id) === cardDigits) || null;
        }
      }
    } else if (pinTrim !== "") {
      waiter = await WaitersModel.findOne({ where: { profile_id: pid, pin: pinTrim } });
    } else {
      return res.status(400).json({ message: "false", data: "pin or card_id required" });
    }

    if (!waiter) {
      return res.status(200).json({ message: "false", data: "waiter not found" });
    }
    res.status(200).json({ message: "success", data: waiter });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getWaiterInfo = async (req, res) => {
  const { pin } = req.params;
  try {
    const waiter = await WaitersModel.findOne({ where: { pin: pin } });
    if (!waiter) {
      return res.status(200).json({ message: "false", data: "waiter not found" });
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
      return res.status(200).json({ message: "false", data: "waiter not found" });
    }
    res.status(200).json({ message: "success", data: waiters });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getWaiterInfo, getWaiterLists, resolveWaiterLogin };
