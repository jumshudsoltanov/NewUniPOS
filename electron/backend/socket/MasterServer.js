const { Server } = require("socket.io");
const dgram = require("dgram");
const os = require("os");

let io = null;
let broadcaster = null;
let isBroadcasting = false;

const getLocalNetworkInfo = () => {
    const interfaces = os.networkInterfaces();
    let best = null; // 192.168.*
    let alt1 = null; // 10.* or 172.*
    let fallback = null;

    for (const name of Object.keys(interfaces)) {
        const isVirtual = name.toLowerCase().match(/(vmware|virtual|vbox|wsl|vethernet|loopback)/);
        if (isVirtual) continue;

        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                const ip = iface.address;
                const info = { ip: ip, netmask: iface.netmask, name };

                if (ip.startsWith('192.168.')) {
                    best = info;
                } else if (ip.startsWith('10.') || ip.startsWith('172.')) {
                    if (!alt1) alt1 = info;
                } else if (!ip.startsWith('169.254.')) {
                    if (!fallback) fallback = info;
                }
            }
        }
    }

    // As a last-last resort, pick any APIPA if no real IPs are found
    if (!best && !alt1 && !fallback) {
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === "IPv4" && !iface.internal && iface.address.startsWith("169.254.")) {
                    return { ip: iface.address, netmask: iface.netmask, name };
                }
            }
        }
    }

    return best || alt1 || fallback || { ip: "127.0.0.1", netmask: "255.0.0.0", name: "loopback" };
};

const getBroadcastIp = (ip, netmask) => {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const broadcastParts = ipParts.map((part, i) => part | (~maskParts[i] & 255));
    return broadcastParts.join('.');
};

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const openFirewallPorts = () => {
    const tcpCommand = `netsh advfirewall firewall show rule name="UniPOS_Master_TCP" >nul || netsh advfirewall firewall add rule name="UniPOS_Master_TCP" dir=in action=allow protocol=TCP localport=55667 profile=any`;
    const udpCommand = `netsh advfirewall firewall show rule name="UniPOS_Master_UDP" >nul || netsh advfirewall firewall add rule name="UniPOS_Master_UDP" dir=in action=allow protocol=UDP localport=44444 profile=any`;

    // Try silently first
    exec(tcpCommand, (err) => {
        if (!err) console.log("✅ Windows Firewall TCP Rule verified");
    });
    exec(udpCommand, (err) => {
        if (!err) console.log("✅ Windows Firewall UDP Rule verified");
    });

    // Create a .bat file on Desktop for manual elevation just in case they are blocked cross-machine
    try {
        const desktopPath = path.join(os.homedir(), "Desktop", "Sistem_Sebekesini_Ac.bat");
        const batContent = `@echo off
echo ===================================================
echo UniPOS Sebeke Icareleri (Firewall)
echo ===================================================
echo Xahis edirik bu fayli "Run as Administrator" kimi acin!
echo Master qurguya TCP:55667 ve Slave qurguya UDP:44444 icazesi verilir...
netsh advfirewall firewall add rule name="UniPOS_Master_TCP" dir=in action=allow protocol=TCP localport=55667 profile=any
netsh advfirewall firewall add rule name="UniPOS_Master_UDP" dir=in action=allow protocol=UDP localport=44444 profile=any
netsh advfirewall firewall add rule name="UniPOS_Master_TCP_Out" dir=out action=allow protocol=TCP localport=55667 profile=any
echo ===================================================
echo TAMAMLANDI! Indi Slave ekranlar Master-i gore bilecek.
pause`;
        fs.writeFileSync(desktopPath, batContent, 'utf-8');
    } catch (e) {
        console.error("Could not write Firewall BAT to desktop", e);
    }
};

const initMasterServer = (server, isBroadcastingActive = true) => {
    if (io) {
        console.log("⚠️ Master Socket.io Server artıq aktivdir.");
        return;
    }

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'], // Alignment with Slave side
        pingTimeout: 60000,
        pingInterval: 25000
    });

    console.log("✅ Master Socket.io Server Başladı");

    io.on("connection", (socket) => {
        console.log(`🔌 Yeni terminal qoşuldu: ${socket.id}`);

        // Customer Display event handling
        socket.on("broadcast_customer_display", (data) => {
            socket.broadcast.emit("customer_display_update", data);
        });

        socket.on("delegate_print", (data) => {
            console.log("🖨️ Çap delegasiyası qəbul edildi:", data.printerName);
            // Broadcast to all (Master's frontend will pick this up)
            io.emit("print_delegated", data);
        });

        socket.on("disconnect", (reason) => {
            console.log(`❌ Terminal bağlantısı kəsildi (${reason}): ${socket.id}`);
        });
    });

    if (isBroadcastingActive) {
        startBroadcasting();
        openFirewallPorts();
    } else {
        console.log("ℹ️ Local Socket Server started (Master/Slave broadcasting is disabled)");
    }
};

let broadcastInterval = null;

const startBroadcasting = () => {
    if (isBroadcasting) return;

    // Clean up if somehow called again
    if (broadcaster) {
        try { broadcaster.close(); } catch (e) { }
    }

    broadcaster = dgram.createSocket("udp4");

    broadcaster.on("listening", () => {
        broadcaster.setBroadcast(true);
        isBroadcasting = true;
        console.log("📡 UDP Yayımı (Discovery) başladı...");
    });

    broadcaster.on("error", (err) => {
        console.error("❌ UDP Broadcaster Error:", err);
        isBroadcasting = false;
        try { broadcaster.close(); } catch (e) { }
    });

    broadcaster.bind(() => {
        let logCounter = 0;
        if (broadcastInterval) clearInterval(broadcastInterval);

        broadcastInterval = setInterval(() => {
            const netInfo = getLocalNetworkInfo();
            const broadcastAddress = getBroadcastIp(netInfo.ip, netInfo.netmask);

            const message = Buffer.from(JSON.stringify({
                type: "master_pos",
                ip: netInfo.ip,
                port: 55667
            }));

            if (logCounter === 0) {
                console.log(`[MASTER UDP] IP Seçildi: ${netInfo.ip} | Netmask: ${netInfo.netmask} | Adapter: ${netInfo.name}`);
                console.log(`[MASTER UDP] Yayım IP'si (Broadcast Address): ${broadcastAddress}`);
            }
            logCounter = (logCounter + 1) % 10;

            // Direct the broadcast to the specific subnet
            if (isBroadcasting && broadcaster) {
                broadcaster.send(message, 0, message.length, 44444, broadcastAddress, (err) => {
                    if (err) console.error("[MASTER UDP] Send Error:", err.message);
                });
            }
        }, 3000);
    });
};

const getIo = () => io;

module.exports = { initMasterServer, getIo };
