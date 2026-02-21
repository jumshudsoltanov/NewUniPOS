const { Server } = require("socket.io");
const dgram = require("dgram");
const os = require("os");

let io = null;
let broadcaster = null;
let isBroadcasting = false;

const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
};

const initMasterServer = (server) => {
    if (io) return;

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    console.log("✅ Master Socket.io Server Başladı");

    io.on("connection", (socket) => {
        console.log(`🔌 Yeni terminal qoşuldu: ${socket.id}`);
        socket.on("disconnect", () => {
            console.log(`❌ Terminal bağlantısı kəsildi: ${socket.id}`);
        });
    });

    startBroadcasting();
};

const startBroadcasting = () => {
    if (isBroadcasting) return;

    broadcaster = dgram.createSocket("udp4");

    broadcaster.on("listening", () => {
        broadcaster.setBroadcast(true);
        isBroadcasting = true;
    });

    broadcaster.bind(() => {
        setInterval(() => {
            const ip = getLocalIp();
            const message = Buffer.from(JSON.stringify({
                type: "master_pos",
                ip: ip,
                port: 55667
            }));

            broadcaster.send(message, 0, message.length, 44444, "255.255.255.255");
        }, 3000);
    });
};

const getIo = () => io;

module.exports = { initMasterServer, getIo };
