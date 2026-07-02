import { Menu, Tray, app, nativeImage } from "electron";
import { showMainWindow } from "./windows.js";

let tray: Tray | undefined;

export function setupTray(onToggleChecking: () => void, onCheckNow: () => void): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAYUlEQVR4nO2XQQrAIAwE8/9/tHtaIT3bCC2pMCA3y2ZEGGKDyM4JgG9E8HYHeCXwDkYFoBI4SRWASuAkVQAqgZNUBagETlIFoBI4SRWASuAkVQAqgZNUBagETlIFoBI4+QHHWwSIamWkFgAAAABJRU5ErkJggg==",
  );
  tray = new Tray(icon);
  tray.setToolTip("打卡提醒");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开", click: showMainWindow },
      { label: "开始/暂停检测", click: onToggleChecking },
      { label: "立即检测", click: onCheckNow },
      { type: "separator" },
      { label: "退出", click: () => app.quit() },
    ]),
  );
}
