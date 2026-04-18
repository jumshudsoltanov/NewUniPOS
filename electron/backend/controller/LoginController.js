const axios = require("axios");
const LoginModel = require("../model/LoginModel");

const parseDateOnly = (dateStr) => {
  if (!dateStr) return null;
  try {
    const str = String(dateStr).split("T")[0].trim();
    const parts = str.split(/[-/.]/).map((p) => parseInt(p, 10));
    if (parts.length >= 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
};

const isPaymentExpired = (nextPaymentDate) => {
  if (!nextPaymentDate) return false;
  const payDate = parseDateOnly(nextPaymentDate);
  if (!payDate || isNaN(payDate.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return payDate < now;
};

const isPosBlocked = (val) =>
  val === 1 || val === "1" || val === true || Number(val) === 1;
const { getWaitersList } = require("../data/WaitersData");
const { getTableGroups, getTables } = require("../data/TablesData");
const {
  getGeneralCategories,
  getCategories,
  getProducts,
} = require("../data/ProductsData");
const { getPrinters } = require("../data/PrintersData");
const { getTags } = require("../data/TagsData");
const { getPaymentMethods } = require("../data/PaymentMethodsData");
const { getSalesTypes } = require("../data/SalesTypesData");
let token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9maWxlX2lkIjoxNCwidGVybWluYWxfaWQiOjYwMTUyNzM1LCJ0ZXJtaW5hbF9ncm91cF9pZCI6MjExLCJpc19tYXN0ZXIiOjEsInVzZXJuYW1lIjoidW5pcG9zIiwicmVzdGF1cmFudF9uYW1lIjoiVW5pUE9TIFRlY2hub2xvZ2llcyBSZXN0b3JhbiAiLCJpYXQiOjE3Njk0NDYwMDMsImV4cCI6MTgwMDk4MjAwM30.5xADfX7YasOcKKC9oP-w-949SAxbM_fUq_p13zSf4_8";

const getLogin = async (req, res) => {
  try {
    const { username, terminalId, password } = req.body;

    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await axios.post(
          "http://46.224.8.157:35627/api/terminal/login",
          {
            username: username,
            terminal_id: terminalId,
            terminal_password: password,
          },
          { timeout: 15000 },
        );
        break;
      } catch (apiErr) {
        if (apiErr.response?.status === 429 && attempts < maxAttempts - 1) {
          const retryAfter = parseInt(
            apiErr.response.headers["retry-after"] || "30",
            10,
          );
          const waitTime = Math.min(retryAfter, 60) * 1000;
          console.log(`[LOGIN] 429 - retrying after ${waitTime / 1000}s`);
          await new Promise((r) => setTimeout(r, waitTime));
          attempts++;
        } else {
          throw apiErr;
        }
      }
    }

    const profile = response.data?.data?.profile;
    const terminal = response.data?.data?.terminal;

    if (!profile) {
      return res.status(400).json({ message: "Profile tapılmadı" });
    }

    const isMaster = terminal?.is_master == 1;
    const isMasterSlaveActive = terminal?.is_master_slave_active == 1;

    // CRITICAL FIX: Only update the Master terminal's local database if the login
    // coming in is actually for a Master terminal. Mobile (slave) logins MUST NOT
    // overwrite the Master's local profile or change global.isMasterNode.
    if (isMaster) {
      console.log(
        `[LOGIN] Master Terminal (${terminalId}) detected. Updating local database...`,
      );
      global.isMasterNode = true;

      try {
        await LoginModel.destroy({ where: {} });
        const allowedFields = Object.keys(LoginModel.rawAttributes);
        const filteredProfile = {};
        Object.keys(profile).forEach((key) => {
          if (allowedFields.includes(key)) {
            filteredProfile[key] = profile[key];
          }
        });

        await LoginModel.upsert({
          ...filteredProfile,
          id: profile.id, // Primary Key map
          is_master: 1,
          is_master_slave_active: isMasterSlaveActive ? 1 : 0,
          kitchen_receipt:
            terminal?.kitchen_receipt !== undefined
              ? terminal.kitchen_receipt
              : filteredProfile.kitchen_receipt,
          customer_receipt:
            terminal?.customer_receipt !== undefined
              ? terminal.customer_receipt
              : filteredProfile.customer_receipt,
        });

        if (global.httpServer) {
          const { initMasterServer } = require("../socket/MasterServer");
          initMasterServer(global.httpServer);
        }

        // Trigger background sync for Master without blocking the response
        setImmediate(async () => {
          try {
            console.log("[SYNC] Starting background data update...");
            await getWaitersList(profile.id);
            await getTableGroups(profile.id);
            await getTables(profile.id);
            await getGeneralCategories(profile.id);
            await getCategories(profile.id);
            await getProducts(profile.id);
            await getPrinters(profile.id);
            await getTags(profile.id);
            await getPaymentMethods(profile.id);
            await getSalesTypes(profile.id);
            console.log("[SYNC] Background update completed successfully.");
            // Menu cache-ni yeniləmək üçün bütün terminallara pin_refresh göndər
            try {
              const { getIo } = require("../socket/MasterServer");
              const io = getIo();
              if (io) io.emit("pin_refresh", { profileId: profile.id });
            } catch (_) {}
          } catch (syncErr) {
            console.error("[SYNC] Background update error:", syncErr.message);
          }
        });
      } catch (dbErr) {
        console.error("[LOGIN] Database Update Error:", dbErr.message);
      }
    } else {
      console.log(
        `[LOGIN] Slave/Mobile terminal (${terminalId}) logged in. Ensuring local profile record exists for settings...`,
      );
      try {
        const allowedFields = Object.keys(LoginModel.rawAttributes);
        const filteredProfile = {};
        Object.keys(profile).forEach((key) => {
          if (allowedFields.includes(key)) {
            filteredProfile[key] = profile[key];
          }
        });

        // Upsert profile record but keep is_master=0 to prevent slave from becoming master
        await LoginModel.upsert({
          ...filteredProfile,
          id: profile.id,
          is_master: 0,
          is_master_slave_active: 0, // Slaves don't run master-slave logic
        });
      } catch (dbErr) {
        console.error(
          "[LOGIN] Local Profile Sync Error (Slave):",
          dbErr.message,
        );
      }
    }

    // Merge local metadata (logo və s.) — is_pos_block və next_payment_date üçün ən məhdudiyyətli dəyər (Master və Slave eyni blok qaydalarına tabe)
    try {
      const storedProfile = await LoginModel.findOne({
        where: { id: profile.id },
      });
      if (
        storedProfile &&
        response.data &&
        response.data.data &&
        response.data.data.profile
      ) {
        const cloudProfile = response.data.data.profile;
        const stored = storedProfile.toJSON();
        const {
          is_pos_block: _sb,
          next_payment_date: _npd,
          ...storedRest
        } = stored;
        const blockFromCloud = isPosBlocked(cloudProfile.is_pos_block);
        const blockFromStored = isPosBlocked(stored.is_pos_block);
        const cloudDate = parseDateOnly(cloudProfile.next_payment_date);
        const storedDate = parseDateOnly(stored.next_payment_date);
        const earlierDate =
          cloudDate && storedDate && cloudDate < storedDate
            ? cloudProfile.next_payment_date
            : (stored.next_payment_date ?? cloudProfile.next_payment_date);
        response.data.data.profile = {
          ...cloudProfile,
          ...storedRest,
          is_pos_block:
            blockFromCloud || blockFromStored
              ? 1
              : (cloudProfile.is_pos_block ?? stored.is_pos_block),
          next_payment_date:
            earlierDate ??
            cloudProfile.next_payment_date ??
            stored.next_payment_date,
        };
      }
    } catch (dbError) {
      // Non-fatal
    }

    const finalProfile = response.data?.data?.profile;
    const shouldBlock =
      isPosBlocked(finalProfile?.is_pos_block) ||
      isPaymentExpired(finalProfile?.next_payment_date);
    if (shouldBlock) {
      const blockedProfile = { ...finalProfile, is_pos_block: 1 };
      try {
        const allowedFields = Object.keys(LoginModel.rawAttributes);
        const toSave = {};
        Object.keys(blockedProfile).forEach((key) => {
          if (allowedFields.includes(key)) toSave[key] = blockedProfile[key];
        });
        await LoginModel.upsert({ ...toSave, id: blockedProfile.id });
      } catch (e) {
        console.error("[LOGIN] Block state save error:", e.message);
      }
      return res.status(403).json({
        message: "Müəssisə bloklanıb",
        isBlocked: true,
        data: { profile: blockedProfile },
      });
    }

    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;

    // Offline block check for Master-Slave
    try {
      if (global.isMasterNode || terminalId) {
        const storedProfile = await LoginModel.findOne();
        if (storedProfile) {
          const p = storedProfile.toJSON();
          let isExpired = false;
          if (p.next_payment_date) {
            isExpired = isPaymentExpired(p.next_payment_date);
          }

          if (isPosBlocked(p.is_pos_block) || isExpired) {
            console.log(
              `[LOGIN] Master is locally blocked. Rejecting login for terminal ${terminalId}`,
            );
            return res.status(403).json({
              message: "Müəssisə bloklanıb",
              isBlocked: true,
              data: { profile: { ...p, is_pos_block: 1 } },
            });
          }
        }
      }
    } catch (e) {
      console.error("[LOGIN] Offline block check error:", e.message);
    }

    const message =
      status === 429
        ? "Server çox yüklənib. Bir neçə dəqiqə gözləyib yenidən cəhd edin."
        : "Login zamanı xəta baş verdi";
    console.error(`[LOGIN] Final Error: ${status} - ${error.message}`);
    res.status(status).json({
      message,
      error: error.response?.data || error.message,
    });
  }
};

module.exports = { getLogin };
