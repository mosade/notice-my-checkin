import { Menu, Tray, app, nativeImage } from "electron";
import { showMainWindow } from "./windows.js";

let tray: Tray | undefined;

export function setupTray(onToggleChecking: () => void, onCheckNow: () => void): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAYUlEQVR4nO2XQQrAIAwE8/9/tHtaIT3bCC2pMCA3y2ZEGGKDyM4JgG9E8HYHeCXwDkYFoBI4SRWASuAkVQAqgZNUBagETlIFoBI4SRWASuAkVQAqgZNUBagETlIFoBI4+QHHWwSIamWkFgAAAABJRU5ErkJggg==",
  );
  tray = new Tray(icon);
  tray.setToolTip("Check-in Reminder");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open", click: showMainWindow },
      { label: "Start/Pause Checks", click: onToggleChecking },
      { label: "Check Now", click: onCheckNow },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}
