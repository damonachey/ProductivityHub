import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import url from "node:url";
import windowStateKeeper from "electron-window-state";
import { listMyRepos } from "@productivityhub/github";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

function createWindow(): void {
  const windowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 800,
  });

  const window = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    webPreferences: {
      preload: path.join(dirname, "preload.cjs"),
    },
  });

  windowState.manage(window);

  window.loadFile(path.join(dirname, "renderer", "index.html"));
}

ipcMain.handle("github:list-repos", () => listMyRepos());

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
