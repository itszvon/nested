/**
 * Fails when a release artifact is not Authenticode-signed.
 *
 * Unsigned builds are fine while the project is private, but once a signing
 * identity exists an unsigned artifact must never reach a release. Wire this
 * into the release job after `dist`.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const DEFAULT = [
  "Nested-Setup-0.1.2.exe",
  "Nested-Portable-0.1.2.exe",
];

const dir = process.env.NESTED_ARTIFACT_DIR ?? "C:/Users/itszvon/AppData/Local/nested-desktop-build";
const strict = process.argv.includes("--strict");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const files = args.length > 0 ? args : DEFAULT;

let failed = false;

for (const name of files) {
  const path = `${dir}/${name}`;
  if (!existsSync(path)) {
    console.log(`missing  ${name}`);
    failed = true;
    continue;
  }

  if (process.platform !== "win32") {
    console.log(`skip     ${name} (signature check is Windows-only)`);
    continue;
  }

  const out = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `(Get-AuthenticodeSignature -LiteralPath '${path}').Status -join ''`,
    ],
    { encoding: "utf8" },
  ).trim();

  const signed = out === "Valid";
  console.log(`${signed ? "signed  " : "UNSIGNED"} ${name}  (${out || "unknown"})`);
  if (!signed) failed = true;
}

if (failed) {
  const message = "One or more artifacts are not signed.";
  if (strict) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message} Re-run with --strict to fail the build.`);
}
