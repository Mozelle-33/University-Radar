import { initialState, parseState, type AppState } from "./domain";
import { Capacitor } from "@capacitor/core";
export const STORAGE_KEY = "university-radar:v1";
export function loadState(): { state: AppState; warning: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: initialState(), warning: null };
    const state = parseState(JSON.parse(raw));
    return state
      ? { state, warning: null }
      : {
          state: initialState(),
          warning: "本机数据格式无效，已打开空白会话。原数据未被覆盖。",
        };
  } catch {
    return {
      state: initialState(),
      warning: "无法读取本机存储。请检查浏览器存储权限。",
    };
  }
}
export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export async function downloadState(state: AppState) {
  const data = JSON.stringify(
    { exportedAt: new Date().toISOString(), ...state },
    null,
    2,
  );
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const file = await Filesystem.writeFile({
      path: "university-radar-export.json",
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "University Radar 本机数据",
      files: [file.uri],
      dialogTitle: "保存或分享数据备份",
    });
    return;
  }
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "university-radar-export.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
