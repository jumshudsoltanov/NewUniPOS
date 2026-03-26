const PrintersModel = require("../model/PrintersModel");
const LoginModel = require("../model/LoginModel");

const getPrinters = async (req, res) => {
    const { profileId } = req.params;
    try {
        const printers = await PrintersModel.findAll({
            where: { profile_id: profileId },
        });
        res.status(200).json({ message: "success", data: printers });
    } catch (error) {
        console.error("getPrinters Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Network printer üçün Windows-a avtomatik "Generic/Text Only" driver ilə qur
const autoInstallWindowsPrinter = (printerName, ip, port) => {
    if (!printerName || !ip) return;
    const { exec } = require("child_process");
    const portName = `UNIPOS_${ip.replace(/\./g, '_')}`;
    const portNum = Number(port) || 9100;

    const lines = [
        `$pn='${portName}'; $pr='${printerName}'; $ip='${ip}'; $po=${portNum}`,
        `if(-not(Get-PrinterPort -Name $pn -EA SilentlyContinue)){Add-PrinterPort -Name $pn -PrinterHostAddress $ip -PortNumber $po}`,
        `if(-not(Get-Printer -Name $pr -EA SilentlyContinue)){`,
        `$dl=@('Generic / Text Only','MS Publisher Imagesetter','Generic IBM Graphics 9pin','Generic IBM Graphics 9pin wide')`,
        `$dr=$null`,
        `foreach($d in $dl){if(Get-PrinterDriver -Name $d -EA SilentlyContinue){$dr=$d;break}}`,
        `if(-not $dr){$dr=(Get-PrinterDriver|Select-Object -First 1).Name}`,
        `if($dr){Add-Printer -Name $pr -DriverName $dr -PortName $pn}}`,
    ];

    const cmd = `powershell -WindowStyle Hidden -Command "${lines.join('; ')}"`;
    exec(cmd, (err, stdout, stderr) => {
        if (err) console.error('[AutoInstallPrinter] Xəta:', err.message, stderr);
        else console.log(`[AutoInstallPrinter] Quruldu: ${printerName}`);
    });
};

const updatePrinter = async (req, res) => {
    const { id } = req.params;
    const { name, local_name, ip, port, is_cashier, type, connection_type, usb_name, paper_width, trailing_space, sound_notify, cash_drawer, fast_print, font_family, paper_size, cut_mode, rotate_180, encoding, copies, darkness, receipt_header, receipt_footer, bold_header, double_height_header, print_logo, open_drawer_without_print } = req.body;
    try {
        await PrintersModel.update(
            { name, local_name, ip, port, is_cashier, type, connection_type, usb_name, paper_width, trailing_space, sound_notify, cash_drawer, fast_print, font_family, paper_size, cut_mode, rotate_180, encoding, copies, darkness, receipt_header, receipt_footer, bold_header, double_height_header, print_logo, open_drawer_without_print },
            { where: { id } }
        );

        // Network printer saxlananda avtomatik Windows-a qur
        const ct = connection_type || 'network';
        const isNetwork = ct !== 'usb' && ct !== 'com';
        const userExplicitlyChoseRaster = req.body.hasOwnProperty('usb_name') && (usb_name === '' || usb_name === null);
        if (isNetwork && ip && !userExplicitlyChoseRaster) {
            const autoName = `UNIPOS_${String(ip).replace(/\./g, '_')}`;
            const needsAuto = !usb_name || usb_name === autoName;
            if (needsAuto) {
                autoInstallWindowsPrinter(autoName, ip, port);
                await PrintersModel.update({ usb_name: autoName }, { where: { id } });
            }
        }

        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

const toggleMasterPrinting = async (req, res) => {
    const { profileId, status, type } = req.body; // type: 'cashier' or 'product'
    try {
        const field = type === 'cashier' ? 'is_master_cashier_printing' : 'is_master_product_printing';
        await LoginModel.update({ [field]: status ? 1 : 0 }, { where: { id: profileId } });
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Toggle failed", error: error.message });
    }
};

const testPrint = async (req, res) => {
    const { printerName } = req.body;
    try {
        const { ipcMain } = require("electron");
        res.status(200).json({ message: "Test print command sent" });
    } catch (error) {
        res.status(500).json({ message: "Test print failed" });
    }
};

const updateCustomerDisplaySettings = async (req, res) => {
    const { profileId, isActive, screenId } = req.body;
    try {
        await LoginModel.update({
            is_customer_display_active: isActive ? 1 : 0,
            customer_display_screen_id: screenId
        }, { where: { id: profileId } });
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

const updateCustomerReceiptAutoPrint = async (req, res) => {
    const { profileId, isActive } = req.body;
    try {
        await LoginModel.update({
            is_customer_receipt_auto_print: isActive ? 1 : 0
        }, { where: { id: profileId } });
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

const updateSalesShiftRequired = async (req, res) => {
    const { profileId, isActive } = req.body;
    try {
        await LoginModel.update({
            is_sales_shift_required: isActive ? 1 : 0
        }, { where: { id: profileId } });
        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

module.exports = { getPrinters, updatePrinter, toggleMasterPrinting, testPrint, updateCustomerDisplaySettings, updateCustomerReceiptAutoPrint, updateSalesShiftRequired };
