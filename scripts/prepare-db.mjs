// Prépare la base avant `dev` / `start` / `build` : crée .env si besoin, choisit SQLite ou Postgres
// selon DATABASE_URL, puis crée/met à jour les tables (prisma db push). Aucune étape manuelle.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const envFile = path.join(root, ".env");
const schemaFile = path.join(root, "prisma", "schema.prisma");

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
  const prev = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const next = /^\s*DATABASE_URL\s*=/m.test(prev)
    ? prev.replace(/^\s*DATABASE_URL\s*=.*$/m, 'DATABASE_URL="file:./dev.db"')
    : `${prev}${prev && !prev.endsWith("\n") ? "\n" : ""}DATABASE_URL="file:./dev.db"\n`;
  fs.writeFileSync(envFile, next);
  console.log("› .env : DATABASE_URL=file:./dev.db (SQLite local)");
}

const wanted = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL) ? "postgresql" : "sqlite";
const schema = fs.readFileSync(schemaFile, "utf8");
const current = /datasource db \{[^}]*provider\s*=\s*"(\w+)"/.exec(schema)?.[1];
let regenerate = process.argv.includes("--generate");
if (current !== wanted) {
  fs.writeFileSync(schemaFile, schema.replace(/(datasource db \{[^}]*provider\s*=\s*")\w+(")/, `$1${wanted}$2`));
  console.log(`› Base : ${wanted}`);
  regenerate = true;
}
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
if (regenerate) run("npx prisma generate");
run("npx prisma db push --skip-generate");
