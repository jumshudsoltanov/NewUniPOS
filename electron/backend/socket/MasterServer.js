const { Server } = require("socket.io");
const dgram = require("dgram");
const os = require("os");

let io = null;
let broadcaster = null;
let probeListener = null;
let isBroadcasting = false;

// orderId -> Set<socketId>: hansı terminallar çekə açıqdır (Master-Slave: dinamik göstərmə + avtomatik silmə üçün)
const openChecksMap = new Map();

// Returns ALL active non-virtual IPv4 interfaces (LAN + WiFi, etc.)
const getAllNetworkInterfaces = () => {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = name
      .toLowerCase()
      .match(/(vmware|virtual|vbox|wsl|vethernet|loopback)/);
    if (isVirtual) continue;
    for (const iface of interfaces[name]) {
      if (
        iface.family === "IPv4" &&
        !iface.internal &&
        !iface.address.startsWith("169.254.")
      ) {
        results.push({ ip: iface.address, netmask: iface.netmask, name });
      }
    }
  }

  // Fallback: use APIPA if nothing real found
  if (results.length === 0) {
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          results.push({ ip: iface.address, netmask: iface.netmask, name });
        }
      }
    }
  }

  return results;
};

// Keep for backward compat (used elsewhere)
const getLocalNetworkInfo = () => {
  const all = getAllNetworkInterfaces();
  return (
    all.find((i) => i.ip.startsWith("192.168.")) ||
    all.find((i) => i.ip.startsWith("10.") || i.ip.startsWith("172.")) ||
    all[0] || { ip: "127.0.0.1", netmask: "255.0.0.0", name: "loopback" }
  );
};

const getBroadcastIp = (ip, netmask) => {
  const ipParts = ip.split(".").map(Number);
  const maskParts = netmask.split(".").map(Number);
  const broadcastParts = ipParts.map((part, i) => part | (~maskParts[i] & 255));
  return broadcastParts.join(".");
};

const { exec } = require("child_process");

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
};

const initMasterServer = (server, isBroadcastingActive = true) => {
  if (io) {
    console.log("⚠️ Master Socket.io Server artıq aktivdir.");
    return;
  }

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"], // Alignment with Slave side
    pingTimeout: 120000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100 MB payload limit for large data
  });

  console.log("✅ Master Socket.io Server Başladı");

  io.on("connection", (socket) => {
    console.log(`🔌 Yeni terminal qoşuldu: ${socket.id}`);

    // Customer Display event handling
    // Use io.emit (not socket.broadcast.emit) so the Customer Display window
    // on the SAME machine (slave or master) also receives the update
    socket.on("broadcast_customer_display", (data) => {
      io.emit("customer_display_update", data);
    });

    socket.on("delegate_print", (data) => {
      console.log("🖨️ Çap delegasiyası qəbul edildi:", data.printerName);
      // Göndərənə (Slave) yox, digərlərə (Master) göndər
      socket.broadcast.emit("print_delegated", data);
    });

    // When any terminal deletes or closes a check, broadcast to all others
    socket.on("order_deleted", (data) => {
      console.log(
        `🗑️ Çek silindi, bütün terminallara bildiriş: orderId=${data?.orderId}`,
      );
      socket.broadcast.emit("order_deleted", data);
    });

    socket.on("order_closed", (data) => {
      console.log(
        `✅ Çek bağlandı, bütün terminallara bildiriş: orderId=${data?.orderId}`,
      );
      socket.broadcast.emit("order_closed", data);
    });

    // Master-Slave: çekə giriş — hər iki terminal girə bilər, məhsullar table_updated ilə dinamik yenilənir
    socket.on("check_opened", (data) => {
      const orderId = data?.orderId;
      if (!orderId) return;
      let set = openChecksMap.get(orderId);
      if (!set) {
        set = new Set();
        openChecksMap.set(orderId, set);
      }
      set.add(socket.id);
    });

    socket.on("check_closed", (data) => {
      const orderId = data?.orderId;
      if (!orderId) return;
      const set = openChecksMap.get(orderId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) openChecksMap.delete(orderId);
      }
    });

    // Avtomatik silmə: yalnız başqa terminal bu çekə açıq deyilsə silinə bilər
    socket.on("check_can_delete", (data, cb) => {
      const orderId = data?.orderId;
      if (!orderId || typeof cb !== "function") return cb?.(false);
      const set = openChecksMap.get(orderId);
      if (!set || set.size === 0) return cb(true);
      if (set.size === 1 && set.has(socket.id)) return cb(true);
      cb(false);
    });

    // Başqa terminal bu çeki açıqdırmı yoxlama (Tables.jsx-dən giriş bloku üçün)
    socket.on("check_is_open_by_other", (data, cb) => {
      const orderId = data?.orderId;
      if (!orderId || typeof cb !== "function") return cb?.(false);
      const set = openChecksMap.get(orderId);
      if (!set || set.size === 0) return cb(false);
      // Yalnız bu socket-dən başqa biri açıqdırsa true qaytar
      const othersHaveIt = [...set].some((sid) => sid !== socket.id);
      cb(othersHaveIt);
    });

    // Pin yeniləmə: bir terminal yeniləyəndə digər terminallara (Slave) bildir
    socket.on("pin_refresh", (data) => {
      const profileId = data?.profileId;
      if (profileId) {
        console.log(`🔄 Pin yeniləmə broadcast: profileId=${profileId}`);
        socket.broadcast.emit("pin_refresh", { profileId });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Terminal bağlantısı kəsildi (${reason}): ${socket.id}`);
      for (const [oid, set] of openChecksMap.entries()) {
        set.delete(socket.id);
        if (set.size === 0) openChecksMap.delete(oid);
      }
    });
  });

  // Always open firewall ports — master needs port 55667 accessible for slaves
  // regardless of whether master-slave broadcasting is active
  openFirewallPorts();

  if (isBroadcastingActive) {
    startBroadcasting();
  } else {
    console.log(
      "ℹ️ Local Socket Server started (Master/Slave broadcasting is disabled)",
    );
  }
};

let broadcastInterval = null;

const startBroadcasting = () => {
  if (isBroadcasting) return;

  // Clean up if somehow called again
  if (broadcaster) {
    try {
      broadcaster.close();
    } catch (e) {}
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
    try {
      broadcaster.close();
    } catch (e) {}
  });

  // Slave "kim var?" sorğusuna cavab üçün listener (44444)
  probeListener = dgram.createSocket("udp4");
  probeListener.on("message", (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "slave_probe") {
        const primary =
          getAllNetworkInterfaces().find((i) => i.ip.startsWith("192.168.")) ||
          getAllNetworkInterfaces().find(
            (i) => i.ip.startsWith("10.") || i.ip.startsWith("172."),
          ) ||
          getAllNetworkInterfaces()[0];
        if (primary) {
          const reply = Buffer.from(
            JSON.stringify({ type: "master_pos", ip: primary.ip, port: 55667 }),
          );
          // Diqqət: rinfo.port slave-in probe GÖNDƏRƏN soketinin təsadüfi
          // (ephemeral) portudur — slave orada dinləmir, öz cavab
          // listener-ini sabit 44444 portunda açıb. Cavabı rinfo.port-a
          // göndərsək heç kim eşitmir və slave "avto tapmır" — sabit
          // 44444-ə göndəririk ki, slave-in əsl listener-i qəbul etsin.
          probeListener.send(
            reply,
            0,
            reply.length,
            44444,
            rinfo.address,
            (err) => {
              if (!err)
                console.log(
                  `[MASTER UDP] Slave sorğusuna cavab: ${rinfo.address} -> ${primary.ip}`,
                );
            },
          );
        }
      }
    } catch (e) {}
  });
  probeListener.on("error", () => {});
  try {
    probeListener.bind(44444, "0.0.0.0");
  } catch (e) {
    console.warn("[MASTER UDP] Probe listener bind xətası:", e.message);
  }

  broadcaster.bind(() => {
    let logCounter = 0;
    if (broadcastInterval) clearInterval(broadcastInterval);

    broadcastInterval = setInterval(() => {
      const allInterfaces = getAllNetworkInterfaces();
      if (allInterfaces.length === 0) return;

      // Use the primary IP as the advertised IP (best interface)
      const primary =
        allInterfaces.find((i) => i.ip.startsWith("192.168.")) ||
        allInterfaces.find(
          (i) => i.ip.startsWith("10.") || i.ip.startsWith("172."),
        ) ||
        allInterfaces[0];

      if (logCounter === 0) {
        console.log(
          `[MASTER UDP] Broadcast göndərilir: ${allInterfaces.map((i) => i.ip).join(", ")}`,
        );
      }
      logCounter = (logCounter + 1) % 10;

      // Send broadcast on EVERY active interface so LAN + WiFi slaves all hear it
      const message = Buffer.from(
        JSON.stringify({
          type: "master_pos",
          ip: primary.ip,
          port: 55667,
        }),
      );

      allInterfaces.forEach((netInfo) => {
        const netmask = netInfo.netmask || "255.255.255.0";
        const broadcastAddress = getBroadcastIp(netInfo.ip, netmask);
        if (isBroadcasting && broadcaster) {
          broadcaster.send(
            message,
            0,
            message.length,
            44444,
            broadcastAddress,
            (err) => {
              if (err && logCounter === 0)
                console.error(
                  `[MASTER UDP] Send Error (${netInfo.name}):`,
                  err.message,
                );
            },
          );
        }
      });

      // Ümumi broadcast (bəzi şəbəkələrdə subnet broadcast işləməyə bilər)
      if (isBroadcasting && broadcaster) {
        broadcaster.send(
          message,
          0,
          message.length,
          44444,
          "255.255.255.255",
          (err) => {
            if (err && logCounter === 0)
              console.error(`[MASTER UDP] 255.255.255.255 Error:`, err.message);
          },
        );
      }

      // Multicast (SSDP-style) — bəzi şəbəkələrdə broadcast bloklanır, multicast işləyir
      if (isBroadcasting && broadcaster) {
        try {
          broadcaster.setMulticastTTL(1);
          broadcaster.send(
            message,
            0,
            message.length,
            44444,
            "239.255.255.250",
            (err) => {
              if (err && logCounter === 0)
                console.error(`[MASTER UDP] Multicast Error:`, err.message);
            },
          );
        } catch (e) {
          /* ignore */
        }
      }
    }, 3000);
  });
};

const getIo = () => io;

module.exports = { initMasterServer, getIo };
