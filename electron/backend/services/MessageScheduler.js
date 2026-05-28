const ScheduledMessageModel = require("../model/ScheduledMessageModel");
const { sendBulkMessage } = require("../bot/whatsapp/Whatsapp");
const { Op } = require("sequelize");

const CHECK_INTERVAL_MS = 30_000; // every 30 seconds

let intervalHandle = null;

const processDueMessages = async () => {
  try {
    const due = await ScheduledMessageModel.findAll({
      where: {
        status: "pending",
        scheduled_at: { [Op.lte]: new Date() },
      },
    });

    for (const msg of due) {
      try {
        await sendBulkMessage(msg.phone, msg.message);
        msg.status = "sent";
        msg.sent_at = new Date();
        await msg.save();
        console.log(`[SCHEDULER] Sent scheduled message #${msg.id} to ${msg.phone}`);
      } catch (err) {
        console.error(`[SCHEDULER] Failed message #${msg.id}:`, err.message);
        msg.status = "failed";
        await msg.save();
      }
    }
  } catch (err) {
    console.error("[SCHEDULER] Process error:", err.message);
  }
};

const startScheduler = () => {
  if (intervalHandle) return;
  console.log("[SCHEDULER] Started (interval: 30s)");
  processDueMessages(); // immediate run on start
  intervalHandle = setInterval(processDueMessages, CHECK_INTERVAL_MS);
};

const stopScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[SCHEDULER] Stopped");
  }
};

module.exports = { startScheduler, stopScheduler };
