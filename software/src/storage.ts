import { initialState, parseState, type AppState } from "./domain";
import { Capacitor } from "@capacitor/core";
import { t } from "./i18n";
import { storageKeyFor } from "./study";
export const STORAGE_KEY = storageKeyFor(
  typeof window === "undefined" ? "" : window.location.search,
);
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
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous !== null) {
      try {
        if (!parseState(JSON.parse(previous))) return false;
      } catch {
        return false;
      }
    }
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
  await downloadFile(
    "university-radar-export.json",
    data,
    "application/json",
    t("University Radar 本机数据"),
  );
}

export async function downloadFile(
  name: string,
  data: string,
  mime: string,
  title: string,
) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const file = await Filesystem.writeFile({
      path: name,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title,
      files: [file.uri],
      dialogTitle: t("保存或分享数据备份"),
    });
    return;
  }
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
