const db = require("./database/config");
const LoginModel = require("./model/LoginModel");

async function diagnose() {
    try {
        await db.sequelize.authenticate();
        const profile = await LoginModel.findOne();
        if (profile) {
            console.log(`VALUE_IS_MASTER: ${profile.is_master}`);
            console.log(`VALUE_MS_ACTIVE: ${profile.is_master_slave_active}`);
        } else {
            console.log("VALUE: NO_PROFILE");
        }
        process.exit(0);
    } catch (err) {
        console.error("DIAG_ERROR:", err.message);
        process.exit(1);
    }
}

diagnose();
