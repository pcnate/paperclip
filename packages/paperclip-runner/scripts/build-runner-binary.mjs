import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Builds and stages paperclip-runnerd. On Windows the Rust toolchain is
 * optional for local development: without cargo the binary is skipped and
 * `paperclip_runner` adapter agents report `paperclip_runner_binary_missing`.
 * Every other platform still requires cargo.
 */
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return spawnSync(command, args, { cwd: packageRoot, stdio: "inherit" });
}

const probe = spawnSync("cargo", ["--version"], { stdio: "ignore" });
if (probe.error?.code === "ENOENT" && process.platform === "win32") {
  console.warn(
    "[paperclip-runner] cargo not found; skipping paperclip-runnerd.exe. " +
      "Install Rust (https://rustup.rs) to enable the paperclip_runner adapter.",
  );
  process.exit(0);
}

const cargo = run("cargo", [
  "build",
  "--release",
  "--manifest-path",
  "runner/Cargo.toml",
  "--locked",
  "-p",
  "paperclip-runner-core",
  "--bin",
  "paperclip-runnerd",
]);
if (cargo.error) throw cargo.error;
if (cargo.status !== 0) process.exit(cargo.status ?? 1);

const stage = run(process.execPath, ["scripts/stage-runner-binary.mjs"]);
process.exit(stage.status ?? 1);
