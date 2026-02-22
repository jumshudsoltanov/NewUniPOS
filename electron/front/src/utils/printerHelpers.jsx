import React from "react";
import ReactDOM from "react-dom/client";
import KitchenReceipt from "../components/Receipt/KitchenReceipt";
import { addNotification } from "./notificationService";
import axios from "./apiConfig";
import CustomerReceipt from "../components/Receipt/CustomerReceipt";

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
        if (printers.length === 0 && item.category_id) {
            printers = findCategoryPrinters(item.category_id);
        }
        if (printers.length === 0) {
            console.warn(`No printer found for item: ${item.name}`);
            const displayId = orderData.checkData?.id || orderData.orderId;
            addNotification("Printer Xətası", `${item.name} üçün printer təyin edilməyib`, { orderId: displayId, category: "system", type: "error" });
            continue;
        }

        // Support multi-copy: Instead of deduplicating, we assign to different batches
        // items with repeated printers will go to separate print jobs
        const itemPrinters = printers.map(p => typeof p === 'object' ? (p.local_name || p.name) : p).filter(Boolean);
        console.log(`[PRINTER DEBUG] Processing item '${item.name}' with assigned printers:`, itemPrinters);

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
        console.log(`[PRINTER] Processing batch ${i + 1}/${printerBatches.length}`);

        for (const printerName of Object.keys(batch)) {
            try {
                console.log(`[PRINTER] Starting print job for: ${printerName} (Batch ${i + 1})`);
                const groupItems = batch[printerName];
                if (!groupItems || groupItems.length === 0) continue;

                const container = document.createElement("div");
                container.style.position = "absolute";
                container.style.top = "0px";
                container.style.left = "-9999px";
                container.style.width = "272px";
                document.body.appendChild(container);

                const root = ReactDOM.createRoot(container);
                await new Promise((resolve) => {
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
                    setTimeout(resolve, 100);
                });

                const html = container.innerHTML;
                root.unmount();
                document.body.removeChild(container);

                const logError = async (errorMsg) => {
                    try {
                        await axios.post(`/orders-items/${orderData.orderId}/logs`, {
                            action: "Mətbəx Çapı Xətası",
                            waiterName: orderData.waiter || "Sistem",
                            details: `${printerName} printerinə çap göndərilə bilmədi. Xəta: ${errorMsg}`,
                            time: new Date().toISOString()
                        });
                    } catch (e) {
                        console.error("Error logging print failure:", e);
                    }
                };

                if (window.electronAPI && window.electronAPI.printReceipt) {
                    const result = await window.electronAPI.printReceipt({ html, printerName });
                    if (!result || !result.success) {
                        const errMsg = result?.error || 'Bilinməyən xəta';
                        const displayId = orderData.checkData?.id || orderData.orderId;
                        console.error(`[PRINTER] Print failed for ${printerName}:`, errMsg);
                        addNotification("Çap Xətası", `${printerName} printerinə çap göndərilmədi. Xəta: ${errMsg}`, { orderId: displayId, printerName, category: "system", type: "error" });
                        await logError(errMsg);
                    } else {
                        console.log(`[PRINTER] Print succeeded for: ${printerName}`);
                    }
                } else {
                    const errMsg = "Electron API tapılmadı";
                    const displayId = orderData.checkData?.id || orderData.orderId;
                    addNotification("Sistem Xətası", errMsg, { orderId: displayId, printerName, category: "system", type: "error" });
                    await logError(errMsg);
                }

                // Minimal delay between print jobs for speed while maintaining stability
                await new Promise(r => setTimeout(r, 20));
            } catch (loopError) {
                console.error(`[PRINTER] Unexpected error in printing loop for ${printerName}:`, loopError);
            }
        }
    }
};


export const printCustomerReceipt = async (orderData, profileData) => {
    let printers = profileData?.data?.printers;

    if (!printers || !Array.isArray(printers) || printers.length === 0) {
        try {
            const profileId = profileData?.data?.profile?.id;
            if (profileId) {
                const response = await axios.get(`/pos/printers/${profileId}`);
                if (response.data && Array.isArray(response.data.data)) {
                    printers = response.data.data;
                }
            }
        } catch (error) {
            console.error("Error fetching printers:", error);
        }
    }

    const printer = printers?.find(p => p.is_cashier === 1);
    const printerName = printer?.local_name || printer?.name;

    const logError = async (action, details) => {
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

    if (!printerName) {
        addNotification("Çap Xətası", "Kassa printeri təyin edilməyib", { orderId: orderData?.checkData?.id || orderData?.orderId, category: "system", type: "error" });
        await logError("Müştəri Çapı Xətası", "Kassa printeri təyin edilməyib");
        return { success: false, error: "Kassa printeri tapılmadı" };
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "0px";
    container.style.left = "-9999px";
    container.style.width = "272px";
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);

    const receiptProps = {
        orderedItems: orderData.items,
        checkData: orderData.checkData,
        profileData: profileData,
        tableName: orderData.tableName,
        hallName: orderData.hallName
    };

    await new Promise((resolve) => {
        root.render(<CustomerReceipt {...receiptProps} />);
        setTimeout(resolve, 500);
    });

    try {
        const html = container.innerHTML;

        if (window.electronAPI && window.electronAPI.printReceipt) {
            const result = await window.electronAPI.printReceipt({
                html,
                printerName: printerName
            });

            if (!result || !result.success) {
                const errMsg = result?.error || 'Bilinməyən xəta';
                addNotification("Çap Xətası", `kassa printerinə çap göndərilmədi. Xəta: ${errMsg}`, { orderId: orderData.checkData?.id, category: "system", type: "error" });
                await logError("Müştəri Çapı Xətası", `Kassa çapı xətası: ${errMsg}`);
                return { success: false, error: errMsg };
            }
            return { success: true };
        } else {
            const errMsg = "Electron API mövcud deyil";
            addNotification("Sistem Xətası", errMsg, { orderId: orderData.checkData?.id, category: "system", type: "error" });
            await logError("Sistem Xətası", errMsg);
            return { success: false, error: errMsg };
        }
    } catch (error) {
        console.error("Print generation error:", error);
        addNotification("Çap Xətası", "Çek yaradılarkən xəta baş verdi", { orderId: orderData.checkData?.id, category: "system", type: "error" });
        await logError("Müştəri Çapı Xətası", `Çek yaradılarkən xəta: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        root.unmount();
        document.body.removeChild(container);
    }
};
