import html2canvas from "html2canvas";
import React from "react";
import ReactDOM from "react-dom/client";
import KitchenReceipt from "../components/Receipt/KitchenReceipt";
import { addNotification } from "./notificationService";
import axios from "axios";

export const processAndPrintOrders = async (items, orderData, menuDataWithCategories) => {
    const printerGroups = {};

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
            continue;
        }
        printers.forEach(p => {
            const pName = p.local_name || p.name;
            if (!printerGroups[pName]) {
                printerGroups[pName] = [];
            }
            printerGroups[pName].push({ ...item, printerName: pName });
        });
    }

    const printPromises = Object.keys(printerGroups).map(async (printerName) => {
        const groupItems = printerGroups[printerName];
        if (groupItems.length === 0) return;

        const container = document.createElement("div");
        container.style.position = "absolute";
        container.style.top = "-9999px";
        container.style.left = "-9999px";
        container.style.width = "80mm";
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

        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false
        });

        const imageData = canvas.toDataURL("image/png");
        root.unmount();
        document.body.removeChild(container);

        const logError = async (errorMsg) => {
            try {
                await axios.post(`http://localhost:55667/api/orders-items/${orderData.orderId}/logs`, {
                    action: "Mətbəx Çapı Xətası",
                    waiterName: orderData.waiter || "Sistem",
                    details: `${printerName} printerinə çap göndərilə bilmədi. Xəta: ${errorMsg}`,
                    time: new Date().toISOString()
                });
            } catch (e) {
                console.error("Error logging print failure:", e);
            }
        };

        if (window.electronAPI && window.electronAPI.printImage) {
            const result = await window.electronAPI.printImage({ image: imageData, printerName });
            if (!result || !result.success) {
                const errMsg = result?.error || 'Bilinməyən xəta';
                const displayId = orderData.checkData?.id || orderData.orderId;
                addNotification("Çap Xətası", `${printerName} printerinə çap göndərilmədi. Xəta: ${errMsg}`, displayId, printerName);
                await logError(errMsg);
            }
        } else {
            const errMsg = "Electron API tapılmadı";
            const displayId = orderData.checkData?.id || orderData.orderId;
            addNotification("Sistem Xətası", errMsg, displayId, printerName);
            await logError(errMsg);
        }
    });

    await Promise.all(printPromises);
};

// Import CustomerReceipt dynamically or at top if possible, but we'll import it here for the helper
import CustomerReceipt from "../components/Receipt/CustomerReceipt";

export const printCustomerReceipt = async (orderData, profileData) => {
    let printers = profileData?.data?.printers;

    // If printers are not in profileData, fetch them from API
    if (!printers || !Array.isArray(printers) || printers.length === 0) {
        try {
            const profileId = profileData?.data?.profile?.id;
            if (profileId) {
                const response = await axios.get(`http://localhost:55667/api/pos/printers/${profileId}`);
                if (response.data && Array.isArray(response.data.data)) {
                    printers = response.data.data;
                }
            }
        } catch (error) {
            console.error("Error fetching printers:", error);
        }
    }

    const printer = printers?.find(p => p.is_cashier === 1);
    // User specifically requested to prioritize local_name for cashier printer
    const printerName = printer?.local_name || printer?.name;

    const logError = async (action, details) => {
        try {
            if (orderData?.checkData?.uuid) {
                await axios.post(`http://localhost:55667/api/orders-items/${orderData.checkData.uuid}/logs`, {
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
        addNotification("Çap Xətası", "Kassa printeri təyin edilməyib", orderData?.checkData?.id || orderData?.orderId);
        await logError("Müştəri Çapı Xətası", "Kassa printeri təyin edilməyib");
        return { success: false, error: "Kassa printeri tapılmadı" };
    }

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.width = "80mm"; // Standard receipt width
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);

    // Prepare props
    const receiptProps = {
        orderedItems: orderData.items,
        checkData: orderData.checkData,
        profileData: profileData,
        tableName: orderData.tableName,
        hallName: orderData.hallName
    };

    await new Promise((resolve) => {
        root.render(<CustomerReceipt {...receiptProps} />);
        setTimeout(resolve, 500); // Wait for render and images
    });

    try {
        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
            useCORS: true // Important for external logos
        });

        const imageData = canvas.toDataURL("image/png");

        if (window.electronAPI && window.electronAPI.printImage) {
            const result = await window.electronAPI.printImage({
                image: imageData,
                printerName: printerName
            });

            if (!result || !result.success) {
                const errMsg = result?.error || 'Bilinməyən xəta';
                addNotification("Çap Xətası", `kassa printerinə çap göndərilmədi. Xəta: ${errMsg}`, orderData.checkData?.id);
                // Log error
                await logError("Müştəri Çapı Xətası", `Kassa çapı xətası: ${errMsg}`);
                return { success: false, error: errMsg };
            }
            return { success: true };
        } else {
            const errMsg = "Electron API mövcud deyil";
            addNotification("Sistem Xətası", errMsg, orderData.checkData?.id);
            await logError("Sistem Xətası", errMsg);
            return { success: false, error: errMsg };
        }

    } catch (error) {
        console.error("Print generation error:", error);
        addNotification("Çap Xətası", "Çek yaradılarkən xəta baş verdi", orderData.checkData?.id);
        await logError("Müştəri Çapı Xətası", `Çek yaradılarkən xəta: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        root.unmount();
        document.body.removeChild(container);
    }
};
