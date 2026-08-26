import { app, BrowserWindow } from "electron";

function createWindow(): void {
  new BrowserWindow({
    width: 800,
    height: 600,
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
