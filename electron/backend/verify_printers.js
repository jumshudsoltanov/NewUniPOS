const db = require("./database/config");
const { getPrinters } = require("./data/PrintersData");
const PrintersModel = require("./model/PrintersModel");
const LoginModel = require("./model/LoginModel");

(async () => {
    try {
        await db.connect();
        console.log("DB Connected");

        // Sync tables to ensure they exist
        await db.sequelize.sync({ alter: true });
        console.log("DB Synced");

        // Try to get existing profile or use dummy
        let profileId = null;
        try {
            const profile = await LoginModel.findOne({ attributes: ["id"], raw: true });
            profileId = profile ? profile.id : 12345; // Fallback to a dummy ID if no login
            console.log("Using Profile ID:", profileId);
        } catch (e) {
            console.log("Error fetching profile, using dummy ID 12345");
            profileId = 12345;
        }

        console.log("Starting Sync for printers...");
        await getPrinters(profileId);
        console.log("Sync Check Completed");

        const printers = await PrintersModel.findAll();
        console.log(`Found ${printers.length} printers in DB.`);
        if (printers.length > 0) {
            console.log("First printer:", JSON.stringify(printers[0], null, 2));
        } else {
            console.log("No printers found.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Verification Error:", error);
        process.exit(1);
    }
})();
