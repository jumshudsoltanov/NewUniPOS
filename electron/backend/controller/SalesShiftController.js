const { randomUUID } = require("crypto");
const axios = require("axios");
const SalesShiftsModel = require("../model/SalesShiftsModel");
const { getShiftSummaryForRange } = require("./ReportController");

const ADMIN_API = "http://46.224.8.157:8089/api";

const fmt = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
};

const openShift = async (req, res) => {
  const { profileId } = req.params;
  const { terminalId, waiterId, waiterName } = req.body || {};
  try {
    const existing = await SalesShiftsModel.findOne({
      where: {
        profile_id: profileId,
        status: "open",
        terminal_id: terminalId != null && terminalId !== "" ? terminalId : null,
      },
    });
    if (existing) {
      return res.status(400).json({
        message: "open_exists",
        data: existing,
      });
    }
    const row = await SalesShiftsModel.create({
      uuid: randomUUID(),
      profile_id: profileId,
      terminal_id: terminalId || null,
      opened_at: new Date(),
      status: "open",
      opened_by_waiter_id: waiterId || null,
      opened_by_name: waiterName || null,
    });

    // Admin serverə göndər (xəta olsa da davam et)
    axios.post(`${ADMIN_API}/sales-shifts/${profileId}/open`, {
      uuid: row.uuid,
      terminalId: terminalId || null,
      waiterId: waiterId || null,
      waiterName: waiterName || null,
      opened_at: row.opened_at,
    }).catch(() => {});

    // Bütün terminallara socket ilə xəbər ver
    try {
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("shift_updated", { action: "open", profileId });
    } catch (_) {}

    return res.status(200).json({ message: "success", data: row });
  } catch (e) {
    console.error("openShift", e);
    return res.status(500).json({ message: e.message });
  }
};

const getCurrentShift = async (req, res) => {
  const { profileId } = req.params;
  try {
    // terminal_id-dən asılı olmayaraq profile-dakı istənilən açıq növbəni qaytarır
    const row = await SalesShiftsModel.findOne({
      where: { profile_id: profileId, status: "open" },
      order: [["opened_at", "DESC"]],
    });
    return res.status(200).json({ message: "success", data: row });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const getLiveSummary = async (req, res) => {
  const { profileId } = req.params;
  const { shiftUuid } = req.query;
  try {
    const where = { profile_id: profileId, status: "open" };
    if (shiftUuid) where.uuid = shiftUuid;
    const shift = await SalesShiftsModel.findOne({ where, order: [["opened_at", "DESC"]] });
    if (!shift) {
      return res.status(200).json({ message: "success", data: null });
    }
    const startDate = new Date(shift.opened_at);
    const endDate = new Date();
    const startStr = fmt(startDate);
    const endStr = fmt(endDate);
    // terminal_id filtri yox — bütün terminalların sifarişləri göstərilsin
    const summary = await getShiftSummaryForRange(profileId, null, startDate, endDate);
    return res.status(200).json({
      message: "success",
      data: { shift, summary, range: { startStr, endStr } },
    });
  } catch (e) {
    console.error("getLiveSummary", e);
    return res.status(500).json({ message: e.message });
  }
};

const closeShift = async (req, res) => {
  const { profileId, shiftUuid } = req.params;
  const { waiterId, waiterName, terminalId } = req.body || {};
  try {
    const shift = await SalesShiftsModel.findOne({
      where: { profile_id: profileId, uuid: shiftUuid, status: "open" },
    });
    if (!shift) {
      return res.status(404).json({ message: "not_found" });
    }
    const startDate = new Date(shift.opened_at);
    const endDate = new Date();
    const startStr = fmt(startDate);
    const endStr = fmt(endDate);
    // terminal_id filtri yox — bütün terminalların sifarişləri göstərilsin
    const summary = await getShiftSummaryForRange(profileId, null, startDate, endDate);
    const snapshot = {
      closedAt: endStr,
      openedAt: startStr,
      terminalId: shift.terminal_id || null,
      summary,
      profileId: Number(profileId),
    };
    shift.closed_at = new Date();
    shift.status = "closed";
    shift.closed_by_waiter_id = waiterId || null;
    shift.closed_by_name = waiterName || null;
    shift.report_snapshot = JSON.stringify(snapshot);
    await shift.save();

    // Admin serverə göndər (xəta olsa da davam et)
    axios.post(`${ADMIN_API}/sales-shifts/shift/${shiftUuid}/close`, {
      waiterId: waiterId || null,
      waiterName: waiterName || null,
      closed_at: shift.closed_at,
      report_snapshot: snapshot,
    }).catch(() => {});

    // Bütün terminallara socket ilə xəbər ver
    try {
      const { getIo } = require("../socket/MasterServer");
      if (getIo()) getIo().emit("shift_updated", { action: "close", profileId });
    } catch (_) {}

    return res.status(200).json({
      message: "success",
      data: { shift, summary, range: { startStr, endStr } },
    });
  } catch (e) {
    console.error("closeShift", e);
    return res.status(500).json({ message: e.message });
  }
};

const listHistory = async (req, res) => {
  const { profileId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const rows = await SalesShiftsModel.findAll({
      where: { profile_id: profileId, status: "closed" },
      order: [["closed_at", "DESC"]],
      limit,
    });
    return res.status(200).json({ message: "success", data: rows });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const getShiftByUuid = async (req, res) => {
  const { profileId, shiftUuid } = req.params;
  try {
    const row = await SalesShiftsModel.findOne({
      where: { profile_id: profileId, uuid: shiftUuid },
    });
    if (!row) return res.status(404).json({ message: "not_found" });
    let snapshot = null;
    if (row.report_snapshot) {
      try {
        snapshot = JSON.parse(row.report_snapshot);
      } catch {
        snapshot = null;
      }
    }
    return res.status(200).json({ message: "success", data: { shift: row, snapshot } });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = {
  openShift,
  getCurrentShift,
  getLiveSummary,
  closeShift,
  listHistory,
  getShiftByUuid,
};
