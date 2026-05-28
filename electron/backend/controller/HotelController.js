const RoomModel = require("../model/RoomModel");
const ScheduledMessageModel = require("../model/ScheduledMessageModel");
const axios = require("axios");
const { sendBulkMessage } = require("../bot/whatsapp/Whatsapp");

const API_BASE = "https://api.unipos.tech/api";
const FALLBACK_API = "http://46.224.8.157:35627/api";

const apiGet = async (path, params) => {
  try {
    return await axios.get(`${API_BASE}${path}`, { params, timeout: 10000 });
  } catch (e) {
    console.warn(`[HOTEL] V2 API xətası (${path}), V1 fallback edilir:`, e.message);
    return await axios.get(`${FALLBACK_API}${path}`, { params, timeout: 10000 });
  }
};

const apiPost = async (path, data) => {
  try {
    return await axios.post(`${API_BASE}${path}`, data, { timeout: 10000 });
  } catch (e) {
    console.warn(`[HOTEL] V2 API POST xətası (${path}), V1 fallback edilir:`, e.message);
    return await axios.post(`${FALLBACK_API}${path}`, data, { timeout: 10000 });
  }
};

const apiPatch = async (path, data) => {
  try {
    return await axios.patch(`${API_BASE}${path}`, data, { timeout: 10000 });
  } catch (e) {
    console.warn(`[HOTEL] V2 API PATCH xətası (${path}), V1 fallback edilir:`, e.message);
    return await axios.patch(`${FALLBACK_API}${path}`, data, { timeout: 10000 });
  }
};

const apiDelete = async (path) => {
  try {
    return await axios.delete(`${API_BASE}${path}`, { timeout: 10000 });
  } catch (e) {
    console.warn(`[HOTEL] V2 API DELETE xətası (${path}), V1 fallback edilir:`, e.message);
    return await axios.delete(`${FALLBACK_API}${path}`, { timeout: 10000 });
  }
};

const apiPut = async (path, data) => {
  try {
    return await axios.put(`${API_BASE}${path}`, data, { timeout: 10000 });
  } catch (e) {
    console.warn(`[HOTEL] V2 API PUT xətası (${path}), V1 fallback edilir:`, e.message);
    return await axios.put(`${FALLBACK_API}${path}`, data, { timeout: 10000 });
  }
};

const HotelController = {
  getRooms: async (req, res) => {
    try {
      const { profileId } = req.params;
      const rooms = await RoomModel.findAll({ where: { profile_id: profileId } });
      res.json({ message: "success", data: rooms });
    } catch (error) {
      console.error("[HOTEL] Rooms fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  getRoomSummary: async (req, res) => {
    try {
      const { profileId } = req.params;

      // Rooms from local DB
      const rooms = await RoomModel.findAll({ where: { profile_id: profileId } });

      // Bookings & folios from admin API (no local models yet)
      let bookings = [], folios = [];
      try {
        const [bRes, fRes] = await Promise.all([
          apiGet("/bookings", { profile_id: profileId }),
          apiGet("/folios", { profile_id: profileId }),
        ]);
        bookings = Array.isArray(bRes.data) ? bRes.data : bRes.data?.data || [];
        folios = Array.isArray(fRes.data) ? fRes.data : fRes.data?.data || [];
      } catch (e) {
        console.warn("[HOTEL] Booking/folio fetch warning:", e.message);
      }

      const bookingMap = {};
      bookings.forEach((b) => { bookingMap[b.room_id] = b; });
      const folioMap = {};
      folios.forEach((f) => { folioMap[f.room_id] = f; });

      const enriched = rooms.map((room) => ({
        ...room.get({ plain: true }),
        guest_name: bookingMap[room.id]?.guest_name || "",
        guest_phone: bookingMap[room.id]?.guest_phone || "",
        check_in: bookingMap[room.id]?.check_in || "",
        check_out: bookingMap[room.id]?.check_out || "",
        folio_balance: folioMap[room.id]?.balance || 0,
        booking_id: bookingMap[room.id]?.id || null,
      }));

      res.json({ message: "success", data: enriched });
    } catch (error) {
      console.error("[HOTEL] Room summary error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  getBookings: async (req, res) => {
    try {
      const { profileId } = req.params;
      const response = await apiGet("/bookings", { profile_id: profileId });
      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Bookings fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  getFolios: async (req, res) => {
    try {
      const { profileId } = req.params;
      const response = await apiGet("/folios", { profile_id: profileId });
      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Folios fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  getRoomGroups: async (req, res) => {
    try {
      const { profileId } = req.params;
      let groups = [];
      try {
        const response = await apiGet("/room-groups", { profile_id: profileId });
        groups = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      } catch (e) {
        console.warn("[HOTEL] Room groups API xətası, local fallback edilir:", e.message);
      }
      // Əgər API-dan nəticə gəlməyibsə, local rooms cədvəlindən qrupları çıxart
      if (!Array.isArray(groups) || groups.length === 0) {
        const rooms = await RoomModel.findAll({
          where: { profile_id: profileId },
          attributes: ["room_group_id"],
          raw: true,
        });
        const seen = new Set();
        groups = rooms
          .map((r) => r.room_group_id)
          .filter((id) => id != null && !seen.has(id) && seen.add(id))
          .map((id) => ({ id, name: `Qrup ${id}` }));
      }
      res.json({ message: "success", data: groups });
    } catch (error) {
      console.error("[HOTEL] Room groups fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  updateRoomStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const response = await apiPatch(`/rooms/${id}/status`, { status });

      // Also update local DB
      await RoomModel.update({ status }, { where: { id } });

      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Update room status error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  updateBooking: async (req, res) => {
    try {
      const { id } = req.params;
      const response = await apiPut(`/bookings/${id}`, req.body);
      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Update booking error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  updateBookingStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const response = await apiPatch(`/bookings/${id}/status`, { status });
      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Update booking status error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  deleteBooking: async (req, res) => {
    try {
      const { id } = req.params;
      const response = await apiDelete(`/bookings/${id}`);
      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Delete booking error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  createBooking: async (req, res) => {
    try {
      const { profile_id, room_id, guest_name, guest_phone, check_in, check_out, adults, children, notes } = req.body;
      const response = await apiPost("/bookings", {
        profile_id, room_id, guest_name, guest_phone, check_in, check_out, adults, children, notes,
      });

      // Update local room status to occupied
      await RoomModel.update({ status: "occupied" }, { where: { id: room_id } });

      // Auto-send WhatsApp confirmation if phone provided
      const bookingData = response.data?.data || response.data;
      const bookingId = bookingData?.id;
      if (guest_phone && guest_name) {
        const roomRow = await RoomModel.findByPk(room_id);
        const roomNumber = roomRow?.room_number || "?";
        const fmtDate = (d) => {
          if (!d) return "—";
          const dt = new Date(d);
          return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
        };
        const msg = [
          `*🏨 OTAQ REZERVASİYASI TƏSDİQLƏNDİ*`,
          ``,
          `Otaq: *${roomNumber}*`,
          `Qonaq: *${guest_name}*`,
          `Giriş: ${fmtDate(check_in)}`,
          `Çıxış: ${fmtDate(check_out)}`,
          adults ? `Böyüklər: ${adults}` : "",
          children ? `Uşaqlar: ${children}` : "",
          notes ? `Qeyd: ${notes}` : "",
          ``,
          `Zəhmət olmasa qeydiyyat zamanı vaxtında olun.`,
        ].filter(Boolean).join("\n");

        setImmediate(() => {
          sendBulkMessage(guest_phone, msg).catch((err) =>
            console.error("[HOTEL] WhatsApp auto-send xətası:", err.message)
          );
        });
      }

      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Create booking error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  /** Otaq foliosuna depozit (balans) əlavə et/yenilə */
  updateFolioBalance: async (req, res) => {
    try {
      const { roomId } = req.params;
      const { profile_id, balance } = req.body;

      const response = await apiPatch(`/folios/${roomId}`, {
        profile_id,
        balance: Number(balance) || 0,
      });

      res.json(response.data);
    } catch (error) {
      console.error("[HOTEL] Folio balance update error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  /** Manual WhatsApp göndərmə — booking məlumatlarını yenidən admin API-dən çəkir */
  sendBookingWhatsapp: async (req, res) => {
    try {
      const { id } = req.params;
      const { profile_id, custom_message, schedule_time, reminder_type } = req.body || {};

      // Booking-i admin API-dən çək
      let booking = null;
      if (profile_id) {
        const resp = await apiGet("/bookings", { profile_id });
        const bookings = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
        booking = bookings.find((b) => String(b.id) === String(id));
      }

      if (!booking) {
        return res.status(404).json({ error: "Rezervasiya tapılmadı" });
      }

      const { guest_name, guest_phone, room_id, check_in, check_out } = booking;
      if (!guest_phone || !guest_name) {
        return res.status(400).json({ error: "Qonaq telefon nömrəsi və ya adı yoxdur" });
      }

      const roomRow = await RoomModel.findByPk(room_id);
      const roomNumber = roomRow?.room_number || "?";
      const fmtDateTime = (d) => {
        if (!d) return "—";
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      };

      // Əgər custom_message göndərilibsə, ondan istifadə et
      let msg = custom_message;
      if (!msg) {
        // reminder_type-a görə mesaj şablonu seç
        const lines =
          reminder_type === "checkout_reminder"
            ? [
                `*🔔 ÇIXIŞ XATIRLATMASI 🔔*`,
                ``,
                `Hörmətli *${guest_name}*,`,
                `Otaq rezervasiyanızın çıxış vaxtı yaxınlaşır:`,
                ``,
                `Otaq: *${roomNumber}*`,
                `Çıxış: ${fmtDateTime(check_out)}`,
                ``,
                `Zəhmət olmasa vaxtında çıxış etməyinizi xahiş edirik.`,
                `Təşəkkür edirik!`,
              ]
            : [
                `*🔔 OTAQ XATIRLATMASI 🔔*`,
                ``,
                `Hörmətli *${guest_name}*,`,
                `Otaq rezervasiyanızın təfərrüatları:`,
                ``,
                `Otaq: *${roomNumber}*`,
                `Giriş: ${fmtDateTime(check_in)}`,
                `Çıxış: ${fmtDateTime(check_out)}`,
                ``,
                `Xoş gəlmisiniz!`,
              ];
        msg = lines.join("\n");
      }

      // schedule_time gəlibsə, göndərməni təxirə sal
      if (schedule_time) {
        const scheduledAt = new Date(schedule_time);
        if (isNaN(scheduledAt.getTime())) {
          return res.status(400).json({ error: "Yanlış vaxt formatı" });
        }

        await ScheduledMessageModel.create({
          phone: guest_phone,
          message: msg,
          profile_id: profile_id || null,
          booking_id: id,
          room_id: room_id || null,
          scheduled_at: scheduledAt,
          status: "pending",
          type: reminder_type || "info",
        });

        return res.json({
          message: "success",
          data: { scheduled: true, scheduled_at: schedule_time, to: guest_phone },
        });
      }

      // schedule_time yoxdursa, dərhal göndər
      await sendBulkMessage(guest_phone, msg);

      res.json({ message: "success", data: { sent: true, to: guest_phone } });
    } catch (error) {
      console.error("[HOTEL] WhatsApp send error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = HotelController;
