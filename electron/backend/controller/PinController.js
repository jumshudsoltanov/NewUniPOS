const { sendBulkMessage } = require("../bot/whatsapp/Whatsapp");
const WaitersModel = require("../model/WaitersModel");

// ─── In-memory verification code store ───────────────────────────────────────
const verificationCodes = new Map();
const WHATSAPP_NUMBER = "994775012507";
const CODE_TTL_MS = 5 * 60 * 1000; // 5 dəqiqə

// Hər dəqiqə vaxtı keçmiş kodları təmizlə
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of verificationCodes.entries()) {
    if (now > value.expiresAt) verificationCodes.delete(key);
  }
}, 60 * 1000);

// ─── Send verification code ──────────────────────────────────────────────────

const sendVerificationCode = async (req, res) => {
  try {
    const { profileId } = req.body;
    if (!profileId) {
      return res.status(400).json({ success: false, message: "profileId required" });
    }

    // Random 4-digit code (1000–9999)
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // Store with expiry
    const profileKey = String(profileId);
    verificationCodes.set(profileKey, {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    // Send via WhatsApp
    const message = `UniPOS - Giriş təsdiq kodu: *${code}*\n\nKod 5 dəqiqə ərzində etibarlıdır.`;
    await sendBulkMessage(WHATSAPP_NUMBER, message);

    console.log(`[PinVerification] ✅ Code ${code} sent to ${WHATSAPP_NUMBER} for profile ${profileId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[PinVerification] ❌ Send error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Kod göndərilmədi" });
  }
};

// ─── Verify code ─────────────────────────────────────────────────────────────

const verifyCode = async (req, res) => {
  try {
    const { profileId, code } = req.body;
    if (!profileId || !code) {
      return res.status(400).json({ success: false, message: "profileId and code required" });
    }

    const profileKey = String(profileId);
    const stored = verificationCodes.get(profileKey);

    if (!stored) {
      return res.status(400).json({ success: false, message: "Kod tapılmadı. Yenidən kod istəyin." });
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(profileKey);
      return res.status(400).json({ success: false, message: "Kodun müddəti bitib. Yenidən kod istəyin." });
    }

    if (stored.code !== String(code).trim()) {
      return res.status(400).json({ success: false, message: "Kod yanlışdır." });
    }

    // Code verified — remove it
    verificationCodes.delete(profileKey);

    // Find first available waiter (non-fatal — unlock goes through even without waiter)
    let firstWaiter = null;
    try {
      firstWaiter = await WaitersModel.findOne({
        where: { profile_id: Number(profileId) },
        order: [["id", "ASC"]],
      });
    } catch (waiterErr) {
      console.warn("[PinVerification] ⚠️ Waiter lookup failed:", waiterErr.message);
    }

    console.log(`[PinVerification] ✅ Code verified for profile ${profileId}, waiter: ${firstWaiter?.name || "none"}`);
    res.json({
      success: true,
      message: "Kod təsdiqləndi",
      waiter: firstWaiter || null,
    });
  } catch (error) {
    console.error("[PinVerification] ❌ Verify error:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Xəta baş verdi: " + error.message });
  }
};

// ─── Payment notification (POS block) ────────────────────────────────────────

const sendPaymentNotification = async (req, res) => {
  try {
    const { profileId } = req.body;
    if (!profileId) {
      return res.status(400).json({ success: false, message: "profileId required" });
    }

    // Get profile name
    const LoginModel = require("../model/LoginModel");
    const profile = await LoginModel.findByPk(Number(profileId), { paranoid: false }).catch(() => null);
    const profileName = profile?.restaurant_name || profile?.username || "Naməlum";

    const message = `🔔 *ÖDƏNİŞ BİLDİRİŞİ* 🔔\n\nMüəssisə: *${profileName}*\nStatus: *Ödəniş olundu*\n\nZəhmət olmasa yoxlayın və təsdiq edin.`;
    await sendBulkMessage(WHATSAPP_NUMBER, message);

    console.log(`[PinPaymentNotify] ✅ Notification sent for profile ${profileId} (${profileName})`);
    res.json({ success: true, message: "Bildiriş göndərildi" });
  } catch (error) {
    console.error("[PinPaymentNotify] ❌ Error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Bildiriş göndərilmədi" });
  }
};

module.exports = { sendVerificationCode, verifyCode, sendPaymentNotification };
