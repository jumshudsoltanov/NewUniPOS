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
