import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import KitchenReceipt from "../components/Receipt/KitchenReceipt";
import { addNotification } from "./notificationService";
import axios, { getSocket } from "./apiConfig";
import CustomerReceipt from "../components/Receipt/CustomerReceipt";
import { maybeBlockCustomerOnCustomerReceipt, maybeLockCheckAfterCustomerReceiptPrint } from "./customerReceiptBlock";

let _printersCache = { profileId: null, printers: null };
export const clearPrintersCache = () => { _printersCache = { profileId: null, printers: null }; };

const PRINTERS_LS_KEY = "unipos_printers_cache";

export const savePrintersToStorage = (profileId, printers) => {
    try {
        localStorage.setItem(PRINTERS_LS_KEY, JSON.stringify({ profileId, printers, savedAt: Date.now() }));
    } catch (e) { /* ignore */ }
};

const loadPrintersFromStorage = (profileId) => {
    try {
        const raw = localStorage.getItem(PRINTERS_LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.profileId === profileId && Array.isArray(parsed.printers) && parsed.printers.length > 0) {
            return parsed.printers;
        }
    } catch (e) { /* ignore */ }
    return null;
};

/** App.jsx işə düşəndə `sessionStorage`-a yazılır (Electron `--unipos-instance`) */
export function getUniposInstanceLabelForStorage() {
    try {
        return sessionStorage.getItem("unipos_instance_label") || "default";
    } catch {
        return "default";
    }
}

export function cashierPrinterPrefStorageKey() {
    return `unipos_preferred_cashier_printer_id_${getUniposInstanceLabelForStorage()}`;
}

/**
 * Bir neçə aktiv kassa printeri olanda: Cihazlar → bu terminal üçün seçim və ya "hamısı".
 * Boş = köhnə davranış — yalnız ilk `is_cashier` printeri.
 */
export function resolveCashierPrintersForPrint(printers) {
    const cashiers = (printers || []).filter((p) => Number(p.is_cashier) === 1);
    if (!cashiers.length) return [];
    let pref = "";
    try {
        pref = localStorage.getItem(cashierPrinterPrefStorageKey()) || "";
    } catch {
        pref = "";
    }
    if (pref === "all") return cashiers;
    if (pref) {
        const id = Number(pref);
        if (!Number.isNaN(id)) {
            const one = cashiers.find((p) => Number(p.id) === id);
            if (one) return [one];
        }
    }
    return [cashiers[0]];
}

const getProfileForPrinting = (profileData, orderProfile) => {
    try {
        const authStr = localStorage.getItem("authResult");
        const auth = authStr ? JSON.parse(authStr) : null;
        const authProfile = auth?.data?.profile || {};
        const authTerminal = auth?.data?.terminal || {};
        const fromProfile = profileData?.data?.profile || orderProfile || {};
        const storedProfile = (() => {
            try {
                return JSON.parse(localStorage.getItem("profile") || "{}");
            } catch {
                return {};
            }
        })();
        // Mərkəzi çap: DevicesModal-da dəyişiklik dərhal tətbiq olunsun – auth/stored üstünlük ver
        const isMasterProductPrinting = authProfile.is_master_product_printing ?? storedProfile.is_master_product_printing ?? fromProfile.is_master_product_printing;
        const isMasterCashierPrinting = authProfile.is_master_cashier_printing ?? storedProfile.is_master_cashier_printing ?? fromProfile.is_master_cashier_printing;
        return {
            ...authProfile,
            ...fromProfile,
            is_master: fromProfile.is_master ?? authTerminal.is_master ?? authProfile.is_master,
            is_master_slave_active: fromProfile.is_master_slave_active ?? authTerminal.is_master_slave_active ?? authProfile.is_master_slave_active,
            is_master_product_printing: isMasterProductPrinting,
            is_master_cashier_printing: isMasterCashierPrinting,
        };
    } catch {
        return orderProfile || profileData?.data?.profile || {};
    }
};

const sendRemoteLog = async (orderData, action, details) => {
    try {
        if (orderData?.checkData?.uuid) {
            await axios.post(`/orders-items/${orderData.checkData.uuid}/logs`, {
                action: action,
                waiterName: orderData.waiterName || "Sistem",
                details: details,
                time: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error("Failed to save log:", e);
    }
};

export const processAndPrintOrders = async (items, orderData, menuDataWithCategories) => {
    const printerBatches = []; // Array of { printerName: [items] } pools

    const findCategoryPrinters = (categoryId) => {
        if (!menuDataWithCategories?.data) return [];
        for (const genCat of (menuDataWithCategories.data || [])) {
            if (genCat.is_general) {
                if (genCat.categories) {
                    const cat = genCat.categories.find(c => c.id === categoryId);
                    if (cat && cat.printer_details) return cat.printer_details;
                }
            } else {
                if (genCat.id === categoryId && genCat.printer_details) return genCat.printer_details;
            }
        }
        return [];
    };

    for (const item of items) {
        let printers = item.printer_details || [];
        const catPrinters = (printers.length === 0 && item.category_id) ? findCategoryPrinters(item.category_id) : [];
        if (printers.length === 0 && catPrinters.length > 0) printers = catPrinters;

        if (printers.length === 0) {
            console.warn(`❌ No printer found for item: ${item.name}`);
            const displayId = orderData.checkData?.id || orderData.orderId;
            addNotification("Printer Xətası", `${item.name} üçün printer təyin edilməyib`, { orderId: displayId, category: "system", type: "error" });
            continue;
        }

        // Support multi-copy: Instead of deduplicating, we assign to different batches
        // items with repeated printers will go to separate print jobs
        const itemPrinters = printers.map(p => typeof p === 'object' ? (p.local_name || p.name) : p).filter(Boolean);

        const printerOccurrence = {};
        itemPrinters.forEach(pName => {
            const count = (printerOccurrence[pName] || 0);
            printerOccurrence[pName] = count + 1;

            if (!printerBatches[count]) {
                printerBatches[count] = {};
            }
            if (!printerBatches[count][pName]) {
                printerBatches[count][pName] = [];
            }
            printerBatches[count][pName].push({ ...item, printerName: pName });
        });
    }

    // Iterate through all batches and print them
    for (let i = 0; i < printerBatches.length; i++) {
        const batch = printerBatches[i];
        if (!batch) continue;

        for (const printerName of Object.keys(batch)) {
            try {
                const groupItems = batch[printerName];
                if (!groupItems || groupItems.length === 0) continue;

                const container = document.createElement("div");
                container.style.position = "absolute";
                container.style.top = "0px";
                container.style.left = "-9999px";
                container.style.width = "330px";
                document.body.appendChild(container);

                const root = ReactDOM.createRoot(container);
                flushSync(() => {
                    root.render(
                        <KitchenReceipt
                            orderedItems={groupItems}
                            table={orderData.table}
                            waiter={orderData.waiter}
                            hallName={orderData.hallName}
                            orderId={orderData.orderId}
                            terminalInfo={orderData.terminalInfo}
                            typeName={orderData.typeName}
                            checkData={orderData.checkData}
                            isDecrease={orderData.isDecrease}
                        />
                    );
                });

                const html = container.innerHTML;
                root.unmount();
                document.body.removeChild(container);

                const profile = getProfileForPrinting(orderData.profileData, orderData.profileData?.data?.profile);
                const isMasterProductPrinting = profile.is_master_product_printing === 1;
                const isMaster = profile.is_master === 1;
                const isMasterSlaveActive = profile.is_master_slave_active === 1;

                // Mərkəzi printer Master-dadır: Slave mərkəzi açıq olduqda Master-a göndərir, Master özündə çap edir
                const socket = getSocket();
                const canDelegate = socket && socket.connected;
                const forceDelegate = !window.electronAPI;
                const isSlave = !isMaster && isMasterSlaveActive;

                if (canDelegate && (forceDelegate || (isMasterProductPrinting && isSlave))) {
                    const delegateProfilePrinters = orderData.profileData?.data?.printers || [];
                    let printerObj = groupItems[0]?.printer_details?.find(p => (p.local_name || p.name) === printerName);
                    if (!printerObj?.ip && !printerObj?.usb_name) {
                        const fromProfile = delegateProfilePrinters.find(p => (p.local_name || p.name) === printerName);
                        if (fromProfile) printerObj = fromProfile;
                    }
                    if (!printerObj?.ip && !printerObj?.usb_name) {
                        const detailPrinter = groupItems[0]?.printer_details?.[0];
                        if (detailPrinter?.id) {
                            const byId = delegateProfilePrinters.find(p => p.id === detailPrinter.id);
                            if (byId) printerObj = byId;
                        }
                    }
                    const _connType1 = printerObj?.connection_type;
                    const isNet = _connType1 === "network" || (_connType1 !== "usb" && _connType1 !== "com" && !!printerObj?.ip);
                    const hasUsb = !!(printerObj?.usb_name && printerObj.usb_name.trim() && printerObj.usb_name !== 'RASTER');
                    const delegatePayload = isNet && printerObj?.ip && !hasUsb
                        ? { html, printerName: "", printerIp: printerObj.ip, printerPort: printerObj.port || 9100 }
                        : { html, printerName: printerObj?.usb_name || printerName };
                    console.warn(`[PRINTER] Mərkəzi mətbəx çapı Slave-dən Master-a göndərilir`);
                    socket.emit("delegate_print", delegatePayload);
                    continue;
                } else if (forceDelegate && !canDelegate) {
                    const displayId = orderData.checkData?.id || orderData.orderId;
                    console.error(`[PRINTER] Delegation failed: Not connected to Master POS.`);
                    addNotification("Çap Xətası", "Master POS terminalına qoşulma yoxdur.", { orderId: displayId, category: "system", type: "error" });
                    continue; // Skip local print since it's mobile
                }

                // Local Print Logic — printer_details və ya profile printers-dan tam printer obyektini al
                const profilePrinters = orderData.profileData?.data?.printers || [];
                // 1. printer_details-dan adla tap
                let printerObj = groupItems[0]?.printer_details?.find(p => (p.local_name || p.name) === printerName);
                // 2. profile printers-dan adla tap (lokal ip/connection_type olan versiya)
                if (!printerObj?.ip && !printerObj?.usb_name) {
                    const fromProfile = profilePrinters.find(p => (p.local_name || p.name) === printerName);
                    if (fromProfile) printerObj = fromProfile;
                }
                // 3. id ilə tap (admin və lokal arasında ad fərqi varsa)
                if (!printerObj?.ip && !printerObj?.usb_name) {
                    const detailPrinter = groupItems[0]?.printer_details?.find(p => (p.local_name || p.name) === printerName) || groupItems[0]?.printer_details?.[0];
                    if (detailPrinter?.id) {
                        const byId = profilePrinters.find(p => p.id === detailPrinter.id);
                        if (byId) printerObj = byId;
                    }
                }
                // 4. Hələ tapılmadısa — is_cashier=0 olan ilk mətbəx printeri götür
                if (!printerObj?.ip && !printerObj?.usb_name && profilePrinters.length > 0) {
                    printerObj = profilePrinters.find(p => Number(p.is_cashier) === 0) || printerObj;
                }
                const _connType2 = printerObj?.connection_type;
                const isCom2 = _connType2 === 'com';
                const isNetwork = _connType2 === "network" || (_connType2 !== "usb" && _connType2 !== "com" && !!printerObj?.ip);
                const hasUsbName = !isCom2 && !!(printerObj?.usb_name && printerObj.usb_name.trim() && printerObj.usb_name !== 'RASTER');
                const targetPrinter = isCom2
                    ? (printerObj?.usb_name || "")
                    : ((printerObj?.usb_name && printerObj.usb_name !== 'RASTER') ? printerObj.usb_name : "");
                const printerSettings = printerObj ? {
                    encoding: printerObj.encoding || 'utf8',
                    copies: printerObj.copies || 1,
                    darkness: printerObj.darkness || 5,
                    cut_mode: printerObj.cut_mode || 'full',
                    trailing_space: printerObj.trailing_space || 0,
                    receipt_header: printerObj.receipt_header || null,
                    receipt_footer: printerObj.receipt_footer || null,
                    bold_header: printerObj.bold_header || 0,
                    double_height_header: printerObj.double_height_header || 0,
                    sound_notify: printerObj.sound_notify || 0,
                    cash_drawer: printerObj.cash_drawer || 0,
                    open_drawer_without_print: printerObj.open_drawer_without_print || 0,
                    paper_size: printerObj.paper_size || '80',
                    font_family: printerObj.font_family || 'Arial',
                    usb_name: isCom2 ? null : ((printerObj.usb_name && printerObj.usb_name !== 'RASTER') ? printerObj.usb_name : null),
                    fast_print: printerObj.fast_print ? 1 : 0,
                    print_logo: printerObj.print_logo != null ? Number(printerObj.print_logo) : 1,
                    rotate_180: printerObj.rotate_180 ? 1 : 0,
                    baud_rate: printerObj.baud_rate || '9600',
                    connection_type: _connType2 || null,
                    com_port: isCom2 ? (printerObj.usb_name || null) : null,
                } : {};
                const safeSettings = JSON.parse(JSON.stringify(printerSettings));

                if (!isNetwork && !targetPrinter) {
                    const errMsg = "Printer konfiqurasiyası natamamdır: local/USB printer adı tapılmadı";
                    const displayId = orderData.checkData?.id || orderData.orderId;
                    addNotification("Çap Xətası", `${printerName} üçün ${errMsg}`, {
                        orderId: displayId,
                        printerName,
                        category: "system",
                        type: "error"
                    });
                    await sendRemoteLog(orderData, "Mətbəx Çapı Xətası", `${printerName}: ${errMsg}`);
                    continue;
                }

                const printPayload = isNetwork && printerObj?.ip && !hasUsbName
                    ? { html, printerName: "", printerIp: String(printerObj.ip), printerPort: Number(printerObj.port) || 9100, printerSettings: safeSettings }
                    : { html, printerName: String(targetPrinter || ""), printerSettings: safeSettings };

                if (window.electronAPI && window.electronAPI.printReceipt) {
                    const printPromise = window.electronAPI.printReceipt(printPayload);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Çap vaxtı bitdi (Timeout)")), 15000)
                    );

                    const result = await Promise.race([printPromise, timeoutPromise]);

                    if (!result || !result.success) {
                        const errMsg = result?.error || 'Bilinməyən xəta';
                        const displayId = orderData.checkData?.id || orderData.orderId;
                        addNotification("Çap Xətası", `${printerName} printerinə çap göndərilmədi. Xəta: ${errMsg}`, { orderId: displayId, printerName, category: "system", type: "error" });
                        await sendRemoteLog(orderData, "Mətbəx Çapı Xətası", `${printerName}: ${errMsg}`);
                    }
                } else {
                    const errMsg = "Electron API tapılmadı";
                    const displayId = orderData.checkData?.id || orderData.orderId;
                    addNotification("Sistem Xətası", errMsg, { orderId: displayId, printerName, category: "system", type: "error" });
                    await sendRemoteLog(orderData, "Sistem Xətası", errMsg);
                }

                // Minimal delay between print jobs for speed while maintaining stability
                await new Promise(r => setTimeout(r, 50));
            } catch (loopError) {
                console.error(`[PRINTER] Unexpected error in printing loop for ${printerName}:`, loopError.message);
                addNotification("Sistem Xətası", `Çap zamanı gözlənilməz xəta: ${loopError.message}`, { category: "system", type: "error" });
            }
        }
    }
};


/**
 * @param {object} [options] — { dispatch, loginedWaiter, autoLockCheckAfterPrint } — aktiv çek ekranında ön çekdən sonra DB kilidi
 */
export const printCustomerReceipt = async (orderData, profileData, options = {}) => {
    let printers = profileData?.data?.printers;
    const profileId = profileData?.data?.profile?.id;

    if (!printers || !Array.isArray(printers) || printers.length === 0) {
        if (_printersCache.profileId === profileId && _printersCache.printers?.length) {
            printers = _printersCache.printers;
        } else {
            try {
                if (profileId) {
                    const response = await axios.get(`/pos/printers/${profileId}`);
                    if (response.data && Array.isArray(response.data.data)) {
                        printers = response.data.data;
                        _printersCache = { profileId, printers };
                        savePrintersToStorage(profileId, printers);
                    }
                }
            } catch (error) {
                console.error("Error fetching printers:", error);
                // DB-dən gəlmədisə localStorage-dan oxu
                const stored = loadPrintersFromStorage(profileId);
                if (stored) {
                    printers = stored;
                    _printersCache = { profileId, printers };
                    console.warn("[PRINTER] DB-dən printer yükləmə uğursuz, localStorage cache istifadə edilir");
                }
            }
        }
    } else if (profileId) {
        _printersCache = { profileId, printers };
        savePrintersToStorage(profileId, printers);
    }

    const cashierPrinters = resolveCashierPrintersForPrint(printers);

    if (!cashierPrinters.length) {
        addNotification("Çap Xətası", "Kassa printeri təyin edilməyib", { orderId: orderData?.checkData?.id || orderData?.orderId, category: "system", type: "error" });
        sendRemoteLog(orderData, "Müştəri Çapı Xətası", "Kassa printeri təyin edilməyib").catch(() => {});
        return { success: false, error: "Kassa printeri tapılmadı" };
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "0px";
    container.style.left = "-9999px";
    container.style.width = "330px";
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);

    const receiptProps = {
        orderedItems: orderData.items,
        checkData: orderData.checkData,
        profileData: profileData,
        tableName: orderData.tableName,
        hallName: orderData.hallName
    };

    flushSync(() => {
        root.render(<CustomerReceipt {...receiptProps} />);
    });

    try {
        const html = container.innerHTML;

        const profile = getProfileForPrinting(profileData, profileData?.data?.profile);
        const isMasterCashierPrinting = profile.is_master_cashier_printing === 1;
        const isMaster = profile.is_master === 1;
        const isMasterSlaveActive = profile.is_master_slave_active === 1;

        const socket = getSocket();
        const canDelegate = socket && socket.connected;
        const forceDelegate = !window.electronAPI;
        const isSlave = !isMaster && isMasterSlaveActive;

        const buildCashierPrintPayload = (printer) => {
            const printerName = printer?.local_name || printer?.name;
            const connType = printer?.connection_type;
            const isCom = connType === 'com';
            const isNetworkPrinter = connType === "network" || (connType !== "usb" && connType !== "com" && !!printer?.ip);
            const hasUsbName = !isCom && !!(printer?.usb_name && printer.usb_name.trim() && printer.usb_name !== 'RASTER');
            const printerSettings = printer ? {
                encoding: printer.encoding || 'utf8',
                copies: printer.copies || 1,
                darkness: printer.darkness || 5,
                cut_mode: printer.cut_mode || 'full',
                trailing_space: printer.trailing_space || 0,
                receipt_header: printer.receipt_header || null,
                receipt_footer: printer.receipt_footer || null,
                bold_header: printer.bold_header || 0,
                double_height_header: printer.double_height_header || 0,
                sound_notify: printer.sound_notify || 0,
                cash_drawer: printer.cash_drawer || 0,
                open_drawer_without_print: printer.open_drawer_without_print || 0,
                paper_size: printer.paper_size || '80',
                font_family: printer.font_family || 'Arial',
                usb_name: isCom ? null : ((printer.usb_name && printer.usb_name !== 'RASTER') ? printer.usb_name : null),
                fast_print: printer.fast_print ? 1 : 0,
                print_logo: printer.print_logo != null ? Number(printer.print_logo) : 1,
                rotate_180: printer.rotate_180 ? 1 : 0,
                baud_rate: printer.baud_rate || '9600',
                connection_type: connType || null,
                com_port: isCom ? (printer.usb_name || null) : null,
            } : {};
            const safeSettings = JSON.parse(JSON.stringify(printerSettings));
            if (isNetworkPrinter && printer?.ip && !hasUsbName) {
                return { html, printerName: "", printerIp: String(printer.ip), printerPort: Number(printer.port) || 9100, printerSettings: safeSettings };
            }
            // COM port: printerName kimi COM port adını göndər (usb_name = "COM3")
            const targetName = isCom ? (printer.usb_name || printerName || "") : (printer.usb_name || printerName || "");
            return { html, printerName: String(targetName), printerSettings: safeSettings };
        };

        if (forceDelegate && !canDelegate) {
            console.error(`[PRINTER] Customer Receipt Delegation failed. Not connected to Master.`);
            addNotification("Çap Xətası", "Master POS terminalına qoşulma yoxdur.", { orderId: orderData.checkData?.id, category: "system", type: "error" });
            return { success: false, error: "Master POS qoşulması yoxdur" };
        }

        if (canDelegate && (forceDelegate || (isMasterCashierPrinting && isSlave))) {
            console.warn(`[PRINTER] Mərkəzi kassa çapı Slave-dən Master-a (${cashierPrinters.length} printer)`);
            for (const printer of cashierPrinters) {
                const delegatePayload = buildCashierPrintPayload(printer);
                socket.emit("delegate_print", delegatePayload);
            }
            // Post-print operations in background — don't block UI
            maybeBlockCustomerOnCustomerReceipt(
                options?.dispatch,
                options?.loginedWaiter,
                orderData.checkData?.customer_id,
            ).catch(() => {});
            if (options?.autoLockCheckAfterPrint) {
                maybeLockCheckAfterCustomerReceiptPrint(
                    options.dispatch,
                    options.loginedWaiter,
                    orderData.checkData,
                    orderData.waiterName,
                ).catch(() => {});
            }
            return { success: true, delegated: true };
        }

        if (window.electronAPI && window.electronAPI.printReceipt) {
            let lastErr = null;
            let anyOk = false;
            // Send all print jobs in parallel for speed
            const printResults = await Promise.allSettled(
                cashierPrinters.map(async (printer) => {
                    const printPayload = buildCashierPrintPayload(printer);
                    const nm = printPayload.printerName || printPayload.printerIp;
                    if (!nm) throw new Error("Printer adı və ya IP yoxdur");
                    const result = await window.electronAPI.printReceipt(printPayload);
                    if (result && result.success) return true;
                    const pLabel = printer?.local_name || printer?.name || printPayload.printerIp;
                    addNotification("Çap Xətası", `${pLabel}: ${result?.error || "Bilinməyən xəta"}`, { orderId: orderData.checkData?.id, category: "system", type: "error" });
                    sendRemoteLog(orderData, "Müştəri Çapı Xətası", `Kassa çapı (${pLabel}): ${result?.error || "Bilinməyən xəta"}`).catch(() => {});
                    throw new Error(result?.error || "Bilinməyən xəta");
                })
            );
            anyOk = printResults.some(r => r.status === "fulfilled");
            if (!anyOk) {
                const failed = printResults.find(r => r.status === "rejected");
                lastErr = failed?.reason?.message || "Çap uğursuz";
            }
            if (anyOk) {
                // Post-print operations in background — don't block UI
                maybeBlockCustomerOnCustomerReceipt(
                    options?.dispatch,
                    options?.loginedWaiter,
                    orderData.checkData?.customer_id,
                ).catch(() => {});
                if (options?.autoLockCheckAfterPrint) {
                    maybeLockCheckAfterCustomerReceiptPrint(
                        options.dispatch,
                        options.loginedWaiter,
                        orderData.checkData,
                        orderData.waiterName,
                    ).catch(() => {});
                }
                return { success: true };
            }
            return { success: false, error: lastErr || "Çap uğursuz" };
        }

        const errMsg = "Electron API mövcud deyil";
        addNotification("Sistem Xətası", errMsg, { orderId: orderData.checkData?.id, category: "system", type: "error" });
        sendRemoteLog(orderData, "Sistem Xətası", errMsg).catch(() => {});
        return { success: false, error: errMsg };
    } catch (error) {
        console.error("Print generation error:", error);
        addNotification("Çap Xətası", "Çek yaradılarkən xəta baş verdi", { orderId: orderData.checkData?.id, category: "system", type: "error" });
        sendRemoteLog(orderData, "Müştəri Çapı Xətası", `Çek yaradılarkən xəta: ${error.message}`).catch(() => {});
        return { success: false, error: error.message };
    } finally {
        root.unmount();
        document.body.removeChild(container);
    }
};
