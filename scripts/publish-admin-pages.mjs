import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourceDir = resolve(root, "admin-dist");
const targetAssets = resolve(root, "assets");

await rm(targetAssets, { recursive: true, force: true });
await mkdir(targetAssets, { recursive: true });
await copyFile(resolve(sourceDir, "index.html"), resolve(root, "index.html"));
await cp(resolve(sourceDir, "assets"), targetAssets, { recursive: true });

console.log("GitHub Pages admin package written to index.html and assets/");
