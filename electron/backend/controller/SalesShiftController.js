const { randomUUID } = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");
const SalesShiftsModel = require("../model/SalesShiftsModel");
const { getShiftSummaryForRange } = require("./ReportController");

const ADMIN_API = "http://46.224.8.157:8089/api";

/**
 * Növbəni admin serverə göndər. Uğursuz olsa is_synced=0 saxlanır,
 * syncShiftsPending intervalı internet gələndə yenidən cəhd edəcək.
 */
async function sendShiftToAdmin(shiftUuid, payload, action) {
  try {
    const url =
      action === "open"
        ? `${ADMIN_API}/sales-shifts/${payload.profileId}/open`
        : `${ADMIN_API}/sales-shifts/shift/${shiftUuid}/close`;
    await axios.post(url, payload, { timeout: 15000 });
    await SalesShiftsModel.update(
      { is_synced: 1 },
      { where: { uuid: shiftUuid } }
    );
    console.log(`[SHIFT_SYNC] ${action} sent: ${shiftUuid}`);
  } catch (err) {
    // is_synced=0 olaraq qalır — interval yenidən cəhd edəcək
    console.warn(`[SHIFT_SYNC] ${action} failed (${shiftUuid}): ${err.message}`);
  }
}

// Hər 30 saniyə: göndərilməmiş növbələri yenidən admin-ə göndər
setInterval(async () => {
  try {
    const pending = await SalesShiftsModel.findAll({
      where: { is_synced: 0 },
      order: [["opened_at", "ASC"]],
      limit: 20,
    });
    if (pending.length === 0) return;

    for (const shift of pending) {
      try {
        const isClosed = shift.status === "closed";
        let snapshot = null;
        if (shift.report_snapshot) {
          try { snapshot = JSON.parse(shift.report_snapshot); } catch { snapshot = null; }
        }
        if (isClosed) {
          await axios.post(
            `${ADMIN_API}/sales-shifts/shift/${shift.uuid}/close`,
            {
              waiterId: shift.closed_by_waiter_id || null,
              waiterName: shift.closed_by_name || null,
              closed_at: shift.closed_at,
              report_snapshot: snapshot,
              profileId: shift.profile_id,
            },
            { timeout: 15000 }
          );
        } else if (!isClosed) {
          await axios.post(
            `${ADMIN_API}/sales-shifts/${shift.profile_id}/open`,
            {
              uuid: shift.uuid,
              terminalId: shift.terminal_id || null,
              waiterId: shift.opened_by_waiter_id || null,
              waiterName: shift.opened_by_name || null,
              opened_at: shift.opened_at,
              startingCash: Number(shift.starting_cash) || 0,
              profileId: shift.profile_id,
            },
            { timeout: 15000 }
          );
        }
        await SalesShiftsModel.update(
          { is_synced: 1 },
          { where: { uuid: shift.uuid } }
        );
        console.log(`[SHIFT_SYNC_RETRY] Synced: ${shift.uuid} (${shift.status})`);
      } catch (e) {
        console.warn(`[SHIFT_SYNC_RETRY] Failed ${shift.uuid}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error("[SHIFT_SYNC_INTERVAL]", e.message);
  }
}, 30000);

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
  const { terminalId, waiterId, waiterName, startingCash } = req.body || {};
  try {
    const existing = await SalesShiftsModel.findOne({
      where: {
        profile_id: profileId,
        status: "open",
        terminal_id:
          terminalId != null && terminalId !== "" ? terminalId : null,
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
      starting_cash: Number(startingCash) || 0,
      is_synced: 0,
    });

    // Admin serverə göndər — uğursuz olsa is_synced=0 qalır, interval yenidən cəhd edəcək
    sendShiftToAdmin(row.uuid, {
      uuid: row.uuid,
      terminalId: terminalId || null,
      waiterId: waiterId || null,
      waiterName: waiterName || null,
      opened_at: row.opened_at,
      startingCash: row.starting_cash || 0,
      profileId: Number(profileId),
    }, "open");

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
    // ÖNƏMLİ: ən ERKƏN açılan növbəni götür (ASC) — beləcə bütün
    // terminalların sifarişləri tarix aralığına daxil olur.
    // DESC istifadəsində slave master-dan sonra növbə açarsa,
    // master-ın əvvəlki sifarişləri (məs. 400 AZN) itirdi.
    const shift = await SalesShiftsModel.findOne({
      where,
      order: [["opened_at", "ASC"]],
    });
    if (!shift) {
      return res.status(200).json({ message: "success", data: null });
    }
    const startDate = new Date(shift.opened_at);
    const endDate = new Date();
    // Lokal vaxt formatında göndər — UTC çevrilməsi tarix aralığını
    // 4 saat sürüşdürərək son sifarişləri itirir.
    const startStr = fmt(startDate);
    const endStr = fmt(endDate);
    // terminal_id filtri yox — bütün terminalların sifarişləri göstərilsin
    const summary = await getShiftSummaryForRange(
      profileId,
      null,
      startStr,
      endStr,
    );
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
    // Lokal vaxt formatında göndər — UTC çevrilməsi tarix aralığını
    // 4 saat sürüşdürərək son sifarişləri itirir.
    const startStr = fmt(startDate);
    const endStr = fmt(endDate);
    // terminal_id filtri yox — bütün terminalların sifarişləri göstərilsin
    const summary = await getShiftSummaryForRange(
      profileId,
      null,
      startStr,
      endStr,
    );
    const snapshot = {
      closedAt: endStr,
      openedAt: startStr,
      terminalId: shift.terminal_id || null,
      startingCash: Number(shift.starting_cash) || 0,
      summary,
      profileId: Number(profileId),
    };
    shift.closed_at = new Date();
    shift.status = "closed";
    shift.closed_by_waiter_id = waiterId || null;
    shift.closed_by_name = waiterName || null;
    shift.report_snapshot = JSON.stringify(snapshot);
    shift.is_synced = 0;
    await shift.save();

    // Admin serverə göndər — uğursuz olsa is_synced=0 qalır, interval yenidən cəhd edəcək
    sendShiftToAdmin(shiftUuid, {
      waiterId: waiterId || null,
      waiterName: waiterName || null,
      closed_at: shift.closed_at,
      report_snapshot: snapshot,
    }, "close");

    // Bütün terminallara socket ilə xəbər ver
    try {
      const { getIo } = require("../socket/MasterServer");
      if (getIo())
        getIo().emit("shift_updated", { action: "close", profileId });
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
  const { from, to } = req.query;
  try {
    const where = { profile_id: profileId, status: "closed" };
    if (from || to) {
      where.closed_at = {};
      if (from) where.closed_at[Op.gte] = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.closed_at[Op.lte] = toDate;
      }
    }
    const rows = await SalesShiftsModel.findAll({
      where,
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
    return res
      .status(200)
      .json({ message: "success", data: { shift: row, snapshot } });
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
