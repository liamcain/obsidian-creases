import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const vault = process.env.OBSIDIAN_VAULT_PATH;
if (!vault) {
  console.error("OBSIDIAN_VAULT_PATH is not set.");
  console.error("Copy .env.example to .env and set it to your vault path.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const dest = join(vault, ".obsidian", "plugins", manifest.id);

console.log(`Building ${manifest.id} v${manifest.version}…`);
execSync("pnpm run build", { stdio: "inherit" });

mkdirSync(dest, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(file, join(dest, file));
}

console.log(`\nInstalled to ${dest}`);
console.log("Reload the plugin in Obsidian to pick up changes.");
