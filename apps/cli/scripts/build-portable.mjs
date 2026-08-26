// Builds standalone "ph" executables for win/macos/linux using Node's
// Single Executable Application (SEA) feature: esbuild bundles the CLI to
// one CJS file, `node --experimental-sea-config` turns that into a blob,
// and postject injects the blob into a copy of the Node binary for each
// target platform. The win-x64 binary reuses the locally installed Node
// (same version, no download); the other platforms are downloaded from
// nodejs.org and can be built here but not executed/verified on Windows.

import { build as esbuildBuild } from "esbuild";
import { inject as postjectInject } from "postject";
import * as tar from "tar";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, copyFile, rm, chmod } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";
import url from "node:url";

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const buildDir = path.join(appDir, "build");
const releaseDir = path.join(appDir, "release");
const cacheDir = path.join(os.tmpdir(), "productivityhub-node-cache");

const nodeVersion = process.version; // e.g. "v26.7.0"

const targets = [
  { outName: "ph-win-x64.exe", local: true },
  {
    outName: "ph-macos-x64",
    platform: "darwin",
    arch: "x64",
    archiveExt: "tar.gz",
    binPathInArchive: "bin/node",
    macho: true,
  },
  {
    outName: "ph-macos-arm64",
    platform: "darwin",
    arch: "arm64",
    archiveExt: "tar.gz",
    binPathInArchive: "bin/node",
    macho: true,
  },
  {
    outName: "ph-linux-x64",
    platform: "linux",
    arch: "x64",
    archiveExt: "tar.gz",
    binPathInArchive: "bin/node",
    macho: false,
  },
];

async function bundle() {
  await esbuildBuild({
    entryPoints: [path.join(appDir, "src", "index.ts")],
    outfile: path.join(buildDir, "bundle.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
  });
}

async function generateBlob() {
  execFileSync(
    process.execPath,
    ["--experimental-sea-config", "sea-config.json"],
    { cwd: appDir, stdio: "inherit" },
  );
}

async function downloadArchive(archiveName) {
  await mkdir(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, archiveName);
  if (existsSync(cachePath)) return cachePath;

  const downloadUrl = `https://nodejs.org/dist/${nodeVersion}/${archiveName}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${downloadUrl}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(cachePath));
  return cachePath;
}

async function getBaseBinary(target) {
  if (target.local) {
    return process.execPath;
  }

  const archiveName = `node-${nodeVersion}-${target.platform}-${target.arch}.${target.archiveExt}`;
  const archivePath = await downloadArchive(archiveName);

  const extractDir = path.join(cacheDir, `extracted-${nodeVersion}-${target.platform}-${target.arch}`);
  if (!existsSync(extractDir)) {
    await mkdir(extractDir, { recursive: true });
    await tar.x({ file: archivePath, cwd: extractDir });
  }

  const dirName = `node-${nodeVersion}-${target.platform}-${target.arch}`;
  return path.join(extractDir, dirName, target.binPathInArchive);
}

async function buildTarget(target, blobPath) {
  const baseBinary = await getBaseBinary(target);
  const outPath = path.join(releaseDir, target.outName);
  await copyFile(baseBinary, outPath);

  await postjectInject(outPath, "NODE_SEA_BLOB", await readFile(blobPath), {
    sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    machoSegmentName: target.macho ? "NODE_SEA" : undefined,
    overwrite: true,
  });

  if (!target.outName.endsWith(".exe")) {
    await chmod(outPath, 0o755);
  }

  return outPath;
}

async function main() {
  await rm(buildDir, { recursive: true, force: true });
  await rm(releaseDir, { recursive: true, force: true });
  await mkdir(releaseDir, { recursive: true });

  console.log("Bundling CLI with esbuild...");
  await bundle();

  console.log("Generating SEA blob...");
  await generateBlob();

  const blobPath = path.join(buildDir, "sea-prep.blob");
  const results = [];

  for (const target of targets) {
    try {
      const outPath = await buildTarget(target, blobPath);
      console.log(`Built ${path.relative(appDir, outPath)}`);
      results.push({ target: target.outName, ok: true });
    } catch (err) {
      console.error(`Failed ${target.outName}: ${err.message}`);
      results.push({ target: target.outName, ok: false, error: err.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`${failed.length} target(s) failed.`);
    process.exitCode = 1;
  }
}

main();
