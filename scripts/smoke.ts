// Demo-path smoke run — grows with the pipeline. Re-run after every change.
// Today it verifies the lane contract folders and env wiring; each new demo
// step (prospect → generate → send → track) must add its check here.
import { existsSync } from "node:fs";

const CONTRACT_PATHS = ["data/prospects", "data/slides", "public/videos"];
const failures: string[] = [];

for (const path of CONTRACT_PATHS) {
  if (!existsSync(path)) failures.push(`missing lane-contract folder: ${path}`);
}

if (!existsSync(".env.local")) {
  console.warn("smoke: no .env.local — all adapters will run on mocks");
}

if (failures.length > 0) {
  console.error(`smoke: FAIL\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("smoke: OK (scaffold stage — no demo steps wired yet)");
