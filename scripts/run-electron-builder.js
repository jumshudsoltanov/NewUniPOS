/**
 * CSC_IDENTITY_AUTO_DISCOVERY=false (OSS imza axtarışı).
 * NSIS: app-builder-lib wine.js patch — tam process.env + child_process.exec (cmd shell),
 * çünki execFile birbaşa stub .exe üçün "spawn UNKNOWN" verirdi.
 * patches/app-builder-lib+24.13.3.patch (patch-package, postinstall).
 */
if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === undefined) {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
}

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("İstifadə: node scripts/run-electron-builder.js --win --publish=never ...");
  process.exit(1);
}

const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";
const fullArgs = ["electron-builder", ...args];

const r = spawnSync(npx, fullArgs, {
  stdio: "inherit",
  shell: isWin,
  env: process.env,
  cwd: root,
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
