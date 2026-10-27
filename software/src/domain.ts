import contract from "../../shared/radar-v1.json";
export const TAGS = contract.tags;
export const INTENTS = [
  "寻找项目伙伴",
  "聊聊研究方向",
  "认识兴趣伙伴",
  "交流职业机会",
];
export const SCHOOLS = contract.schools;
export const tagName = (id: number) =>
  TAGS.find((t) => t.id === id)?.name ?? `未知标签 ${id}`;
export type Mode = "student" | "alumni";
export type Field = "name" | "major" | "contact";
export const FIELD_NAMES: Record<Field, string> = {
  name: "姓名",
  major: "专业",
  contact: "联系方式",
};
export interface Profile {
  name: string;
  major: string;
  contact: string;
  mode: Mode;
  schoolId: number;
  tags: number[];
  intent: string;
  intentExpiresAt: number;
  broadcastConsent: boolean;
  discovery: boolean;
  minSharedTags: number;
  requireSameSchool: boolean;
  revealFields: Field[];
}
export interface Encounter {
  id: string;
  peerId: string;
  mode: Mode;
  schoolId: number;
  tags: number[];
  day: string;
  period: "上午" | "下午" | "晚间";
  context: string;
  source: "demo" | "device";
  hidden: boolean;
  blocked: boolean;
  reported: boolean;
  connection: "none" | "outgoing" | "incoming" | "connected";
  sharedFields: Field[];
}
export interface AppState {
  version: 1;
  onboarded: boolean;
  source: "demo" | "device";
  profile: Profile;
  encounters: Encounter[];
  configRevision: number;
}
export function initialState(now = Date.now()): AppState {
  return {
    version: 1,
    onboarded: false,
    source: "device",
    configRevision: 1,
    encounters: [],
    profile: {
      name: "",
      major: "",
      contact: "",
      mode: "student",
      schoolId: 1,
      tags: [],
      intent: INTENTS[0],
      intentExpiresAt: now + 3 * 86400000,
      discovery: false,
      broadcastConsent: false,
      minSharedTags: 1,
      requireSameSchool: true,
      revealFields: [],
    },
  };
}
export function demoState(now = Date.now()): AppState {
  const state = initialState(now);
  state.onboarded = true;
  state.source = "demo";
  state.profile = {
    ...state.profile,
    name: "林同学（演示）",
    major: "电子与计算机工程",
    contact: "hello@example.com",
    discovery: true,
    broadcastConsent: true,
    tags: [1, 2, 5, 6],
    revealFields: [],
  };
  const day = new Date(now).toLocaleDateString("en-CA");
  state.encounters = [
    {
      id: "demo-1",
      peerId: "A7F2",
      tags: [1, 2, 4],
      context: "校园创客交流",
      period: "下午",
    },
    {
      id: "demo-2",
      peerId: "B3D8",
      tags: [5, 6, 7],
      context: "校园日常",
      period: "下午",
    },
    {
      id: "demo-3",
      peerId: "C9E1",
      tags: [2, 3],
      context: "研究分享会",
      period: "上午",
    },
  ].map((e) => ({
    ...e,
    day,
    mode: "student",
    schoolId: 1,
    source: "demo",
    hidden: false,
    blocked: false,
    reported: false,
    connection: "none",
    sharedFields: [],
    period: e.period as Encounter["period"],
  }));
  return state;
}
export function matchReasons(profile: Profile, encounter: Encounter): string[] {
  if (profile.mode !== encounter.mode || encounter.blocked || encounter.hidden)
    return [];
  if (
    profile.mode === "alumni" &&
    profile.requireSameSchool &&
    profile.schoolId !== encounter.schoolId
  )
    return [];
  const shared = [...new Set(profile.tags)].filter((id) =>
    encounter.tags.includes(id),
  );
  if (shared.length < profile.minSharedTags) return [];
  return [
    ...(profile.mode === "alumni" && profile.schoolId === encounter.schoolId
      ? ["同校校友"]
      : []),
    ...shared.map(tagName),
  ];
}
export function isIntentActive(profile: Profile, now = Date.now()) {
  return profile.intentExpiresAt > now;
}
export function canDiscover(profile: Profile, now = Date.now()) {
  return (
    profile.discovery &&
    profile.broadcastConsent &&
    profile.tags.length > 0 &&
    isIntentActive(profile, now)
  );
}
export function mergeEncounters(
  existing: Encounter[],
  incoming: Encounter[],
): Encounter[] {
  // Local hide/block/consent decisions survive a repeated device download.
  const known = new Set(existing.map((e) => e.id));
  return [
    ...existing,
    ...incoming.filter((e) => !known.has(e.id) && !!known.add(e.id)),
  ].slice(-1000);
}
export function canReveal(encounter: Encounter) {
  return (
    encounter.source === "demo" &&
    encounter.connection === "connected" &&
    !encounter.blocked
  );
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function shortString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function tags(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= TAGS.length &&
    new Set(value).size === value.length &&
    value.every((id) => TAGS.some((t) => t.id === id))
  );
}
function fields(value: unknown): value is Field[] {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    value.every((x) => ["name", "major", "contact"].includes(x))
  );
}
export function isEncounter(value: unknown): value is Encounter {
  if (!object(value)) return false;
  return (
    shortString(value.id, 100) &&
    value.id.length > 0 &&
    shortString(value.peerId, 32) &&
    /^[A-Za-z0-9-]{1,32}$/.test(value.peerId) &&
    ["student", "alumni"].includes(String(value.mode)) &&
    SCHOOLS.some((s) => s.id === value.schoolId) &&
    tags(value.tags) &&
    typeof value.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.day) &&
    ["上午", "下午", "晚间"].includes(String(value.period)) &&
    shortString(value.context, 40) &&
    ["demo", "device"].includes(String(value.source)) &&
    ["hidden", "blocked", "reported"].every(
      (k) => typeof value[k] === "boolean",
    ) &&
    ["none", "outgoing", "incoming", "connected"].includes(
      String(value.connection),
    ) &&
    fields(value.sharedFields)
  );
}
export function parseState(value: unknown): AppState | null {
  if (!object(value) || value.version !== 1 || !object(value.profile))
    return null;
  const p = value.profile;
  if (
    typeof value.onboarded !== "boolean" ||
    !["demo", "device"].includes(String(value.source)) ||
    !Number.isSafeInteger(value.configRevision) ||
    Number(value.configRevision) < 1 ||
    !Array.isArray(value.encounters) ||
    value.encounters.length > 1000 ||
    !value.encounters.every(isEncounter)
  )
    return null;
  if (
    !shortString(p.name, 30) ||
    !shortString(p.major, 60) ||
    !shortString(p.contact, 100) ||
    !["student", "alumni"].includes(String(p.mode)) ||
    !SCHOOLS.some((s) => s.id === p.schoolId) ||
    !tags(p.tags) ||
    !shortString(p.intent, 60) ||
    !Number.isFinite(p.intentExpiresAt) ||
    !["discovery", "broadcastConsent", "requireSameSchool"].every(
      (k) => typeof p[k] === "boolean",
    ) ||
    !Number.isInteger(p.minSharedTags) ||
    Number(p.minSharedTags) < 1 ||
    Number(p.minSharedTags) > 3 ||
    !fields(p.revealFields)
  )
    return null;
  // A local file is not proof of another person's consent. Native records remain anonymous.
  const state = value as unknown as AppState;
  return {
    ...state,
    encounters: state.encounters.map((e) =>
      e.source === "device"
        ? { ...e, connection: "none", sharedFields: [] }
        : e,
    ),
  };
}
