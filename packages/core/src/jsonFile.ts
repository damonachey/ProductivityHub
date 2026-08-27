import fs from "node:fs";
import path from "node:path";

export function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(filePath: string, data: T): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Read-modify-write in one synchronous step (no `await` between the read and
// the write) so two calls in quick succession can't interleave and clobber
// each other's section of a multi-section file.
export function updateJson<T>(filePath: string, fallback: T, mutate: (current: T) => void): void {
  const current = readJson(filePath, fallback);
  mutate(current);
  writeJson(filePath, current);
}
