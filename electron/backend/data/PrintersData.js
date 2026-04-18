const axios = require("axios");
const LoginModel = require("../model/LoginModel");
const PrintersModel = require("../model/PrintersModel");
const { Op } = require("sequelize");

const profileData = async () => {
    const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
    return profile ? profile.id : null;
};

const getPrinters = async (passedProfileId) => {
    try {
        const profile_id = passedProfileId || (await profileData());
        if (!profile_id) throw new Error("Profile ID tapılmadı");

        const response = await axios.get(
            `http://46.224.8.157:35627/api/pos/printers/${profile_id}`,
        );

        console.log("[PrintersData] Admin API raw response:", JSON.stringify(response.data, null, 2));

        if (response.data && Array.isArray(response.data.data)) {
            const apiPrinters = response.data.data.map((p) => {
                Object.keys(p).forEach((k) => {
                    if (p[k] === undefined) p[k] = null;
                });
                p.profile_id = profile_id;
                return p;
            });

            const apiIds = apiPrinters.map((p) => p.id);

            // Delete printers not in API response
            if (apiIds.length > 0) {
                await PrintersModel.destroy({ where: { id: { [Op.notIn]: apiIds }, profile_id } });
            } else {
                await PrintersModel.destroy({ where: { profile_id } });
            }

            // Insert / update — lokal ip, port, connection_type, usb_name saxla (admin serverdəki boş dəyərlərlə əzilməsin)
            if (apiPrinters.length > 0) {
                // Mövcud lokal dəyərləri götür
                const existing = await PrintersModel.findAll({ where: { profile_id }, raw: true });
                const existingMap = {};
                existing.forEach(e => { existingMap[e.id] = e; });

                const merged = apiPrinters.map(p => {
                    const local = existingMap[p.id];
                    if (local) {
                        p.ip = local.ip || p.ip || null;
                        p.port = local.port || p.port || null;
                        p.connection_type = local.connection_type || p.connection_type || 'network';
                        p.usb_name = local.usb_name || p.usb_name || null;
                        p.local_name = local.local_name || p.local_name || null;
                        p.paper_width = local.paper_width ?? p.paper_width ?? 48;
                        p.trailing_space = local.trailing_space ?? p.trailing_space ?? 0;
                        p.sound_notify = local.sound_notify ?? p.sound_notify ?? 0;
                        p.cash_drawer = local.cash_drawer ?? p.cash_drawer ?? 0;
                        p.fast_print = local.fast_print ?? p.fast_print ?? 0;
                        p.font_family = local.font_family || p.font_family || 'Arial';
                        p.paper_size = local.paper_size || p.paper_size || '80';
                        p.cut_mode = local.cut_mode || p.cut_mode || 'full';
                        p.rotate_180 = local.rotate_180 ?? p.rotate_180 ?? 0;
                        p.encoding = local.encoding || p.encoding || 'utf8';
                        p.copies = local.copies ?? p.copies ?? 1;
                        p.darkness = local.darkness ?? p.darkness ?? 5;
                        p.receipt_header = local.receipt_header ?? p.receipt_header ?? null;
                        p.receipt_footer = local.receipt_footer ?? p.receipt_footer ?? null;
                        p.bold_header = local.bold_header ?? p.bold_header ?? 0;
                        p.double_height_header = local.double_height_header ?? p.double_height_header ?? 0;
                        p.print_logo = local.print_logo ?? p.print_logo ?? 0;
                        p.open_drawer_without_print = local.open_drawer_without_print ?? p.open_drawer_without_print ?? 0;
                    }
                    return p;
                });

                const updateKeys = Object.keys(merged[0]).filter(
                    (key) => PrintersModel.rawAttributes[key],
                );
                await PrintersModel.bulkCreate(merged, {
                    updateOnDuplicate: updateKeys,
                });
            }

                console.log("[PrintersData] DB-yə yazılan merged printers:", JSON.stringify(merged ?? apiPrinters, null, 2));
            console.log("Printers DB sync olundu: insert/update + silindi");
        }

        // V3: Local admin (localhost:8089) printers — məhsullarda istifadə olunan printer ID-lərini sync et
        try {
            const v3Res = await axios.get(
                `http://localhost:8089/api/printers?profile_id=${profile_id}`,
                { timeout: 3000 }
            );
            const v3Printers = Array.isArray(v3Res.data) ? v3Res.data : (v3Res.data?.data || []);
            console.log(`[PrintersData] V3 local admin printers (${v3Printers.length}):`, v3Printers.map(p => `#${p.id} ${p.name}`));

            if (v3Printers.length > 0) {
                const existing = await PrintersModel.findAll({ where: { profile_id }, raw: true });
                const existingIds = existing.map(e => e.id);

                for (const p of v3Printers) {
                    if (!p.id || !p.name) continue;
                    const existingLocal = existing.find(e => e.id === p.id);
                    const record = {
                        id: p.id,
                        profile_id,
                        name: p.name,
                        local_name: existingLocal?.local_name || p.local_name || p.name,
                        ip: existingLocal?.ip || null,
                        port: existingLocal?.port || null,
                        connection_type: existingLocal?.connection_type || 'network',
                        usb_name: existingLocal?.usb_name || null,
                        paper_width: existingLocal?.paper_width ?? 48,
                        trailing_space: existingLocal?.trailing_space ?? 0,
                        sound_notify: existingLocal?.sound_notify ?? 0,
                        cash_drawer: existingLocal?.cash_drawer ?? 0,
                        fast_print: existingLocal?.fast_print ?? 0,
                        font_family: existingLocal?.font_family || 'Arial',
                        paper_size: existingLocal?.paper_size || '80',
                        cut_mode: existingLocal?.cut_mode || 'full',
                        rotate_180: existingLocal?.rotate_180 ?? 0,
                        encoding: existingLocal?.encoding || 'utf8',
                        copies: existingLocal?.copies ?? 1,
                        darkness: existingLocal?.darkness ?? 5,
                    };
                    const updateKeys = Object.keys(record).filter(k => PrintersModel.rawAttributes[k] && k !== 'id');
                    await PrintersModel.upsert(record, { fields: ['id', ...updateKeys] });
                    console.log(`[PrintersData] V3 printer upsert: #${p.id} "${p.name}"`);
                }
            }
        } catch (v3Err) {
            console.warn("[PrintersData] V3 local admin printers xətası (optional):", v3Err.message);
        }

    } catch (err) {
        console.error("Printers Data Error:", err.message);
    }
};

module.exports = { getPrinters };
