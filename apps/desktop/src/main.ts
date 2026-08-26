import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import url from "node:url";
import { listMyRepos } from "@productivityhub/github";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

function createWindow(): void {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(dirname, "preload.cjs"),
    },
  });

  window.loadFile(path.join(dirname, "renderer", "index.html"));
}

ipcMain.handle("github:list-repos", () => listMyRepos());

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
