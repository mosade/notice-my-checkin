import { access, mkdir, stat, writeFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export async function validateBrowserConfig(browser) {
  if (browser.executablePath) {
    try {
      const executable = await stat(browser.executablePath);
      if (!executable.isFile()) {
        return error("BROWSER_NOT_FILE", "浏览器路径不是文件");
      }
      await access(browser.executablePath, constants.R_OK);
    } catch {
      return error("BROWSER_NOT_FOUND", "浏览器路径不存在或不可读取");
    }
  }

  if (browser.userDataDir) {
    try {
      try {
        const existing = await stat(browser.userDataDir);
        if (!existing.isDirectory()) {
          return error("USER_DATA_DIR_NOT_DIRECTORY", "用户数据目录不是文件夹");
        }
      } catch (caught) {
        if (caught?.code !== "ENOENT") {
          throw caught;
        }
        await mkdir(browser.userDataDir, { recursive: true });
      }
      const profile = await stat(browser.userDataDir);
      if (!profile.isDirectory()) {
        return error("USER_DATA_DIR_NOT_DIRECTORY", "用户数据目录不是文件夹");
      }
      const probe = join(browser.userDataDir, ".write-test");
      await writeFile(probe, "ok");
      await rm(probe, { force: true });
    } catch {
      return error("USER_DATA_DIR_NOT_WRITABLE", "用户数据目录不可写");
    }
  }

  return {
    ok: true,
    checkedIn: false,
    checkedAt: new Date().toISOString(),
  };
}

function error(code, message) {
  return {
    ok: false,
    checkedIn: false,
    checkedAt: new Date().toISOString(),
    error: {
      code,
      message,
    },
  };
}
