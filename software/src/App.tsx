import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Battery,
  Bluetooth,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  Fingerprint,
  GraduationCap,
  Handshake,
  Layers3,
  Link2,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  canDiscover,
  canReveal,
  demoState,
  FIELD_NAMES,
  initialState,
  INTENTS,
  isIntentActive,
  matchReasons,
  mergeEncounters,
  SCHOOLS,
  TAGS,
  tagName,
  type AppState,
  type Encounter,
  type Field,
  type Profile,
} from "./domain";
import { downloadState, loadState, saveState, STORAGE_KEY } from "./storage";
import { getLanguage, setLanguage, t } from "./i18n";
import {
  bluetoothAvailability,
  RadarBleClient,
  type DeviceStatus,
} from "./ble/client";

type Tab = "radar" | "encounters" | "network" | "profile";
type Dialog = "device" | "intent" | "privacy" | "reset" | "source" | null;
const NAV = [
  { id: "radar", label: "雷达", icon: Radar },
  { id: "encounters", label: "相遇", icon: Layers3 },
  { id: "network", label: "连接", icon: UsersRound },
  { id: "profile", label: "我的", icon: UserRound },
] as const;
const FIELD_LIST: Field[] = ["name", "major", "contact"];

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex="0"]',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = focusables(),
          first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={root}
      >
        <header>
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label={t("关闭对话框")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function Pill({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return <span className={`pill ${muted ? "muted" : ""}`}>{children}</span>;
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Radio size={30} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function IntentEditor({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (p: Partial<Profile>) => void;
}) {
  const [intent, setIntent] = useState(profile.intent),
    [days, setDays] = useState("3");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          intent,
          intentExpiresAt: Date.now() + Number(days) * 86400000,
        });
      }}
    >
      <p className="subtle">
        {t(
          "告诉同频的人，你现在期待什么。意向到期后会停止发现，重新设置后可继续。",
        )}
      </p>
      <div className="intent-options">
        {INTENTS.map((value, i) => (
          <button
            type="button"
            className={`intent-option ${intent === value ? "selected" : ""}`}
            key={value}
            onClick={() => setIntent(value)}
          >
            <span>0{i + 1}</span>
            {t(value)}
            {intent === value && <Check size={16} />}
          </button>
        ))}
      </div>
      <label className="form-field">
        {t("有效期")}
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="1">{t("1 天")}</option>
          <option value="3">{t("3 天")}</option>
          <option value="7">{t("7 天")}</option>
        </select>
      </label>
      <div className="note">
        <Eye size={16} />
        <span>
          {t(
            "软件中的意向用于回顾和说明。首版设备广播只包含已授权标签与匹配设置，不广播姓名或联系方式。",
          )}
        </span>
      </div>
      <button className="primary full" type="submit">
        {t("保存意向")}
        <Check size={16} />
      </button>
    </form>
  );
}
function ProfileEditor({
  profile,
  onSave,
  isDemo,
}: {
  profile: Profile;
  onSave: (p: Partial<Profile>) => void;
  isDemo: boolean;
}) {
  const [draft, setDraft] = useState(profile);
  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(draft);
  }
  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR FREQUENCY</p>
          <h2>{t("让同频有迹可循")}</h2>
        </div>
        <GraduationCap size={24} />
      </div>
      <div className="form-grid">
        <label className="form-field">
          {t("称呼")}
          <input
            maxLength={30}
            placeholder={t("你希望如何被称呼")}
            value={
              isDemo && draft.name === "林同学（演示）"
                ? t(draft.name)
                : draft.name
            }
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="form-field">
          {t("专业")}
          <input
            maxLength={60}
            placeholder={t("例如：电子与计算机工程")}
            value={
              isDemo && draft.major === "电子与计算机工程"
                ? t(draft.major)
                : draft.major
            }
            onChange={(e) => setDraft({ ...draft, major: e.target.value })}
          />
        </label>
      </div>
      <label className="form-field">
        {t("联系方式")}
        <input
          maxLength={100}
          placeholder={t("可选，默认不分享")}
          value={draft.contact}
          onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="form-field">
          {t("当前阶段")}
          <select
            value={draft.mode}
            onChange={(e) =>
              setDraft({ ...draft, mode: e.target.value as Profile["mode"] })
            }
          >
            <option value="student">{t("在校学生")}</option>
            <option value="alumni">{t("毕业校友")}</option>
          </select>
        </label>
        <label className="form-field">
          {t("学校")}
          <select
            value={draft.schoolId}
            onChange={(e) =>
              setDraft({ ...draft, schoolId: Number(e.target.value) })
            }
          >
            {SCHOOLS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>
          {t("我的标签")}
          <small>{t("选择希望用于同频匹配的方向")}</small>
        </legend>
        <div className="tag-picker">
          {TAGS.map((tag) => (
            <button
              type="button"
              aria-pressed={draft.tags.includes(tag.id)}
              className={draft.tags.includes(tag.id) ? "picked" : ""}
              key={tag.id}
              onClick={() =>
                setDraft({
                  ...draft,
                  tags: draft.tags.includes(tag.id)
                    ? draft.tags.filter((id) => id !== tag.id)
                    : [...draft.tags, tag.id],
                })
              }
            >
              {draft.tags.includes(tag.id) ? (
                <Check size={13} />
              ) : (
                <Plus size={13} />
              )}
              {t(tag.name)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <label className="form-field">
          {t("至少共同命中")}
          <select
            value={draft.minSharedTags}
            onChange={(e) =>
              setDraft({ ...draft, minSharedTags: Number(e.target.value) })
            }
          >
            <option value={1}>{t("1 个标签")}</option>
            <option value={2}>{t("2 个标签")}</option>
            <option value={3}>{t("3 个标签")}</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.requireSameSchool}
            onChange={(e) =>
              setDraft({ ...draft, requireSameSchool: e.target.checked })
            }
          />
          {t("校友模式仅匹配同校")}
        </label>
      </div>
      <label className="check-row consent-check">
        <input
          type="checkbox"
          checked={draft.broadcastConsent}
          onChange={(e) =>
            setDraft({ ...draft, broadcastConsent: e.target.checked })
          }
        />
        <span>
          {t(
            "允许设备广播所选标签摘要及学校／阶段编码，用于离线匹配。附近设备可能推断这些含义；摘要不是加密。",
          )}
        </span>
      </label>
      <button className="primary" type="submit">
        {t("保存资料与规则")}
        <Check size={16} />
      </button>
    </form>
  );
}

export default function App() {
  const [language, setUiLanguage] = useState(getLanguage);
  useEffect(() => {
    setLanguage(language);
  }, [language]);
  const [loaded] = useState(loadState);
  const [state, setState] = useState<AppState>(loaded.state);
  const latestState = useRef(state);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [tab, setTab] = useState<Tab>("radar");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "matched" | "hidden" | "blocked"
  >("all");
  const [device, setDevice] = useState<{
    name: string;
    id: string;
    status: DeviceStatus;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [syncedRevision, setSyncedRevision] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [hasMore, setHasMore] = useState(false);
  const cursors = useRef<Record<string, string>>({});
  const client = useRef<RadarBleClient | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  if (!client.current)
    client.current = new RadarBleClient(() => {
      setDevice(null);
      setSyncedRevision(0);
      setLastSync(null);
      setHasMore(false);
    });
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      void client.current?.disconnect();
    },
    [],
  );
  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  function commit(next: AppState) {
    const saved = saveState(next);
    latestState.current = next;
    setState(next);
    setNow(Date.now());
    setStorageWarning(
      saved ? null : t("本机存储失败，当前改动仅保留在本次会话，请导出备份。"),
    );
    return saved;
  }
  function updateProfile(patch: Partial<Profile>) {
    const current = latestState.current;
    commit({
      ...current,
      profile: { ...current.profile, ...patch },
      configRevision: current.configRevision + 1,
    });
    notify(
      state.source === "demo"
        ? t("演示设置已保存")
        : t("设置已保存，请连接设备并同步后生效"),
    );
  }
  function updateEncounter(id: string, patch: Partial<Encounter>) {
    const current = latestState.current;
    commit({
      ...current,
      encounters: current.encounters.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  }
  const profile = state.profile,
    isDemo = state.source === "demo";
  const active = canDiscover(profile, now);
  const visible = state.encounters.filter(
    (e) => !e.hidden && !e.blocked && e.source === state.source,
  );
  const matches = visible.filter((e) => matchReasons(profile, e).length > 0);
  const connections = visible.filter((e) => canReveal(e));
  const requests = visible.filter((e) =>
    ["outgoing", "incoming"].includes(e.connection),
  );
  const selected = state.encounters.find((e) => e.id === selectedId);
  const filtered = state.encounters
    .filter(
      (e) =>
        e.source === state.source &&
        (filter === "blocked"
          ? e.blocked
          : filter === "hidden"
            ? e.hidden && !e.blocked
            : !e.hidden && !e.blocked),
    )
    .filter((e) => filter !== "matched" || matchReasons(profile, e).length > 0)
    .filter((e) =>
      [
        e.peerId,
        e.context,
        t(e.context),
        ...e.tags.flatMap((id) => [tagName(id), t(tagName(id))]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const dirty = !isDemo && (!device || syncedRevision !== state.configRevision);
  async function connect() {
    setBusy(true);
    setDeviceError("");
    try {
      const result = await client.current!.connect();
      if (client.current?.device?.deviceId !== result.id)
        throw new Error(t("设备连接已断开，请重新连接。"));
      setDevice(result);
      setSyncedRevision(0);
      setLastSync(null);
      setHasMore(false);
      notify(t("设备已连接，点击同步写入设置"));
    } catch (e) {
      setDeviceError(
        e instanceof Error ? e.message : t("连接失败，请检查蓝牙权限。"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    setDeviceError("");
    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        setLastSync(Date.now());
        notify(t("演示同步完成，未连接真实设备"));
        return;
      }
      if (!device) {
        setDialog("device");
        return;
      }
      const revision = state.configRevision;
      const ensureConnected = () => {
        if (client.current?.device?.deviceId !== device.id)
          throw new Error(t("设备连接已断开，请重新连接后同步。"));
      };
      await client.current!.configure(profile, revision);
      ensureConnected();
      setSyncedRevision(revision);
      const page = await client.current!.encounters(
        cursors.current[device.id] ?? "",
      );
      ensureConnected();
      const current = latestState.current;
      const next = {
        ...current,
        encounters: mergeEncounters(current.encounters, page.records),
      };
      if (!commit(next))
        throw new Error(
          t("记录未能保存到本机，同步游标未前进。请释放存储空间后重试。"),
        );
      cursors.current[device.id] = page.nextCursor;
      setHasMore(page.hasMore);
      const status = await client.current!.status();
      ensureConnected();
      setDevice({ ...device, status });
      setLastSync(Date.now());
      notify(
        page.hasMore
          ? t("本批记录已保存，点击同步继续读取")
          : t("配置已确认，相遇记录已同步"),
      );
    } catch (e) {
      setDeviceError(e instanceof Error ? e.message : t("同步失败"));
      setDialog("device");
    } finally {
      setBusy(false);
    }
  }
  async function reset(next: AppState) {
    await client.current!.disconnect().catch(() => {});
    cursors.current = {};
    setLastSync(null);
    setHasMore(false);
    setDeviceError("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* commit reports unavailable storage */
    }
    commit(next);
    setDialog(null);
    setSelectedId(null);
    setTab("radar");
  }
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeEncounter = useCallback(() => setSelectedId(null), []);
  const syncLabel = busy
    ? t("正在同步…")
    : hasMore
      ? t("继续同步")
      : t("同步设备");
  const languageControl = (
    <button
      className={`language-switch${state.onboarded ? "" : " welcome-language"}`}
      type="button"
      aria-label={language === "zh" ? "Switch to English" : "Switch to Chinese"}
      onClick={() => {
        const next = language === "zh" ? "en" : "zh";
        setLanguage(next);
        setUiLanguage(next);
      }}
    >
      {language === "zh" ? "EN" : "中文"}
    </button>
  );

  return (
    <div className="app-shell">
      {!state.onboarded && languageControl}
      <a className="skip-link" href="#main">
        {t("跳到主要内容")}
      </a>
      <aside className="sidebar" inert={!state.onboarded || undefined}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("radar");
          }}
        >
          <span className="brand-mark">
            <Radar size={27} strokeWidth={1.5} />
          </span>
          <span>
            University
            <span className="brand-second">
              Radar<span className="brand-dot">.</span>
            </span>
          </span>
        </a>
        <div className="workspace-label">
          {t("你的同频空间")}
          <span>01</span>
        </div>
        <nav aria-label={t("主导航")}>
          {NAV.map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? "page" : undefined}
              className={tab === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={20} />
              <span>{t(item.label)}</span>
              {item.id === "encounters" && visible.length > 0 && (
                <b>{visible.length}</b>
              )}
              {tab === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <span className="small-orbit">
              <ShieldCheck size={19} />
            </span>
            <h3>{t("好的连接，始于安心")}</h3>
            <p>
              {t("匿名相遇，自主公开。")}
              <br />
              {t("每一步，都由你决定。")}
            </p>
            <button onClick={() => setDialog("privacy")}>
              {t("了解隐私设置")}
              <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="sidebar-profile" onClick={() => setTab("profile")}>
            <span className="avatar mine">
              <UserRound size={19} />
            </span>
            <span>
              <strong>
                {isDemo && profile.name === "林同学（演示）"
                  ? t(profile.name)
                  : profile.name || t("我的雷达")}
              </strong>
              <small>
                {profile.mode === "student" ? t("在校学生") : t("毕业校友")}{" "}
                {t("· 本机空间")}
              </small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="app-body" inert={!state.onboarded || undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <Radar size={20} /> UR
            </span>
            <span className="desktop-only">{t("我的空间")}</span>
            <ChevronRight size={13} />
            <strong>{t(NAV.find((n) => n.id === tab)?.label ?? "")}</strong>
          </div>
          <div className="top-actions">
            {state.onboarded && languageControl}
            <button
              className={`mode-badge ${isDemo ? "" : "real"}`}
              onClick={() => setDialog("source")}
            >
              <span />
              {isDemo ? t("演示空间") : t("设备空间")}
              <ChevronRight size={12} />
            </button>
            <button
              className="help-button"
              onClick={() => setDialog("privacy")}
              aria-label={t("了解隐私与使用说明")}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main">
          {storageWarning && (
            <div role="alert" className="warning-banner">
              {t(storageWarning)}
            </div>
          )}
          {!isDemo && device?.status.warning && (
            <div role="alert" className="warning-banner">
              {t(device.status.warning)}
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === "radar"
                  ? "A LITTLE CLOSER, AT YOUR PACE"
                  : tab === "encounters"
                    ? "MOMENTS WORTH REMEMBERING"
                    : tab === "network"
                      ? "CONNECTIONS WITH CONSENT"
                      : "YOUR SPACE, YOUR RULES"}
              </p>
              <h1>
                {tab === "radar"
                  ? t("遇见同频的可能")
                  : tab === "encounters"
                    ? t("每次相遇，都有来由")
                    : tab === "network"
                      ? t("把相遇，变成连接")
                      : t("定义你的频率")}
              </h1>
              <p>
                {tab === "radar"
                  ? t("带上雷达，回到生活。值得认识的人，留待你慢慢发现。")
                  : tab === "encounters"
                    ? t("回顾设备留下的匿名记录，了解你们为什么同频。")
                    : tab === "network"
                      ? t("先了解共同点，再决定是否公开自己的信息。")
                      : t("兴趣、意向和公开范围，随时由你调整。")}
              </p>
            </div>
            <button
              className="outline compact"
              onClick={() =>
                setDialog(tab === "profile" ? "privacy" : "device")
              }
            >
              {tab === "profile" ? (
                <ShieldCheck size={16} />
              ) : (
                <Bluetooth size={16} />
              )}
              {tab === "profile" ? t("隐私与数据") : t("我的设备")}
            </button>
          </div>

          {tab === "radar" && (
            <>
              <div className="dashboard-grid">
                <section className="hero-card">
                  <div className="hero-copy">
                    <Pill>
                      <span className="status-dot" />
                      {profile.mode === "student"
                        ? t("在校同频")
                        : t("校友同频")}{" "}
                      · {active ? t("发现已开启") : t("发现已暂停")}
                    </Pill>
                    <h2>
                      {t("相遇自有频率。")}
                      <br />
                      <span>{t("连接由你决定。")}</span>
                    </h2>
                    <p>
                      {t("让共同的兴趣与方向，")}
                      <br />
                      {t("成为下一次对话的开始。")}
                    </p>
                    <button
                      className="light-button"
                      onClick={() => setTab("encounters")}
                    >
                      {t("回顾我的相遇")}
                      <ArrowUpRight size={17} />
                    </button>
                    <div className="hero-caption">
                      <LockKeyhole size={12} /> {t("匿名记录 · 无实时定位")}
                    </div>
                  </div>
                  <div className="frequency-art" aria-hidden="true">
                    <div className="orbit orbit-1" />
                    <div className="orbit orbit-2" />
                    <div className="orbit orbit-3" />
                    <div className="orbit-line" />
                    <span className="orbit-point p1" />
                    <span className="orbit-point p2" />
                    <span className="orbit-point p3" />
                    <div className="orbit-core">
                      <Fingerprint size={47} strokeWidth={1} />
                    </div>
                    <span className="orbit-tag t1">{t("共同的热爱")}</span>
                    <span className="orbit-tag t2">{t("相似的方向")}</span>
                    <span className="orbit-label">FIND YOUR FREQUENCY</span>
                  </div>
                </section>
                <section className="device-card">
                  <div className="section-top">
                    <h2>{t("随身雷达")}</h2>
                    <Bluetooth size={17} />
                  </div>
                  <div className="radar-device" aria-hidden="true">
                    <div className="device-notch" />
                    <span>
                      UNIVERSITY
                      <br />
                      <b>RADAR.</b>
                    </span>
                    <Radar size={37} strokeWidth={0.8} />
                    <i />
                    <small>nRF52832</small>
                  </div>
                  <div className="device-info">
                    <strong>
                      {isDemo
                        ? t("Radar One · 演示设备")
                        : (device?.name ?? t("连接你的 Radar One"))}
                    </strong>
                    <span className="device-state">
                      {isDemo ? (
                        <>
                          <span className="status-dot" />
                          {t("模拟连接")}
                          <Battery size={15} />
                          72%
                        </>
                      ) : device ? (
                        <>
                          <span className="status-dot" />
                          {t("已连接")}
                          <Battery size={15} />
                          {device.status.battery}%
                        </>
                      ) : (
                        t("尚未连接真实设备")
                      )}
                    </span>
                  </div>
                  {!isDemo && device && (
                    <p className="device-serial">
                      {t("设备编号：")}
                      {device.status.serialNumber ?? t("旧版固件未提供")}
                    </p>
                  )}
                  <button
                    className="outline full"
                    disabled={busy}
                    onClick={() =>
                      isDemo || device ? void sync() : setDialog("device")
                    }
                  >
                    <RefreshCw size={15} className={busy ? "spinning" : ""} />
                    {isDemo || device ? syncLabel : t("连接设备")}
                  </button>
                  <small className="device-foot">
                    {lastSync
                      ? `${t("上次同步")} ${new Date(lastSync).toLocaleTimeString(language === "zh" ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit" })}`
                      : isDemo
                        ? t("演示数据，未进行真实蓝牙连接")
                        : t("设置与记录通过蓝牙同步")}
                  </small>
                </section>
              </div>
              <div className="under-hero">
                <span>
                  <ShieldCheck size={15} />
                  {t("记录的是相遇，不是附近人的实时位置。")}
                </span>
                <button onClick={() => setDialog("privacy")}>
                  {t("了解工作方式")}
                  <ArrowRight size={14} />
                </button>
              </div>
              {dirty && (
                <div className="inline-notice">
                  <Bluetooth size={16} />
                  <span>
                    {t("设置尚待设备确认。离线设备会继续使用上次同步的配置。")}
                  </span>
                  <button onClick={() => setDialog("device")}>
                    {t("去同步")}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              <div className="content-grid">
                <section className="encounters-section">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {t("值得回顾的相遇")}{" "}
                        <span className="count">
                          {matches.length.toString().padStart(2, "0")}
                        </span>
                      </h2>
                      <p>{t("共同点，比一个分数更有意义")}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setFilter("all");
                        setTab("encounters");
                      }}
                    >
                      {t("查看全部")}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="encounter-list">
                    {matches.slice(0, 3).map((e, index) => (
                      <EncounterCard
                        key={e.id}
                        encounter={e}
                        profile={profile}
                        index={index}
                        onOpen={() => setSelectedId(e.id)}
                      />
                    ))}
                    {matches.length === 0 && (
                      <Empty
                        title={t("同频的故事，等下一次出发")}
                        detail={
                          visible.length > 0
                            ? t(
                                "当前标签和规则下暂无同频记录，可在“我的”调整。",
                              )
                            : t("设置你的标签，再连接设备同步相遇记录。")
                        }
                        action={
                          <button
                            className="outline"
                            onClick={() => setTab("profile")}
                          >
                            {t("设置我的频率")}
                            <ArrowRight size={15} />
                          </button>
                        }
                      />
                    )}
                  </div>
                </section>
                <aside className="right-column">
                  <section className="intent-card">
                    <div className="section-top">
                      <span>
                        <Sparkles size={16} />
                        {t("当前意向")}
                      </span>
                      <button
                        aria-label={t("编辑当前意向")}
                        className="icon-button"
                        onClick={() => setDialog("intent")}
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                    </div>
                    <h3>{t(profile.intent)}</h3>
                    <p>
                      {isIntentActive(profile, now)
                        ? `${t("还有")} ${Math.max(1, Math.ceil((profile.intentExpiresAt - now) / 86400000))} ${t("天到期")}`
                        : t("已到期 · 请重新设置")}
                    </p>
                    <div className="intent-divider" />
                    <span className="tiny-label">{t("我的同频标签")}</span>
                    <div className="tags">
                      {profile.tags.length ? (
                        profile.tags
                          .slice(0, 4)
                          .map((id) => <span key={id}>{t(tagName(id))}</span>)
                      ) : (
                        <span>{t("尚未设置")}</span>
                      )}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setDialog("intent")}
                    >
                      {t("此刻，你想遇见谁？")}
                      <ArrowUpRight size={14} />
                    </button>
                  </section>
                  <section className="principle-card">
                    <span className="principle-icon">
                      <Handshake size={24} strokeWidth={1.3} />
                    </span>
                    <h3>{t("先同频，再认识。")}</h3>
                    <p>
                      {t("身份信息默认保留。双方同意后，")}
                      <br />
                      {t("才开启更多可能。")}
                    </p>
                    <button onClick={() => setDialog("privacy")}>
                      {t("查看我的公开范围")}
                      <ArrowRight size={14} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}

          {tab === "encounters" && (
            <>
              <div className="list-toolbar">
                <div className="filter-tabs" aria-label={t("筛选相遇")}>
                  {(
                    [
                      { id: "all", label: t("全部相遇") },
                      { id: "matched", label: t("与我同频") },
                      { id: "hidden", label: t("已隐藏") },
                      { id: "blocked", label: t("已屏蔽") },
                    ] as const
                  ).map((f) => (
                    <button
                      aria-pressed={filter === f.id}
                      className={filter === f.id ? "selected" : ""}
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label={t("搜索相遇记录")}
                    placeholder={t("搜索标签或相遇代号")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="note">
                <LockKeyhole size={16} />
                <span>
                  {isDemo
                    ? t("以下为虚构的概念测试记录，点击可体验授权流程。")
                    : t(
                        "以下为设备同步的匿名记录。首版未接入身份服务，无法发起真实连接。",
                      )}
                </span>
              </div>
              <div className="encounter-grid">
                {filtered.map((e, i) => (
                  <EncounterCard
                    encounter={e}
                    profile={profile}
                    index={i}
                    key={e.id}
                    onOpen={() => setSelectedId(e.id)}
                  />
                ))}
              </div>
              {!filtered.length && (
                <Empty
                  title={t("这里暂时没有相遇")}
                  detail={t("试试其他筛选条件，或连接设备同步记录。")}
                />
              )}
            </>
          )}

          {tab === "network" && (
            <>
              <div className="note">
                <ShieldCheck size={16} />
                <span>
                  {isDemo
                    ? t(
                        "本页演示双方授权流程。对方的动作由你明确模拟，不会向真实用户发送消息。",
                      )
                    : t("真实连接与跨用户授权服务尚未接入。设备记录保持匿名。")}
                </span>
              </div>
              <div className="network-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>
                      {t("连接请求")}
                      <span className="count">{requests.length}</span>
                    </h2>
                  </div>
                  {requests.length ? (
                    requests.map((e) => (
                      <div className="request-row" key={e.id}>
                        <span className="avatar">{e.peerId.slice(0, 2)}</span>
                        <div>
                          <strong>
                            {t("同频者")} {e.peerId}
                          </strong>
                          <p>
                            {e.connection === "outgoing"
                              ? t("等待对方同意 · 演示")
                              : t("对方希望与你连接 · 演示")}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setSelectedId(e.id)}
                        >
                          {t("查看")}
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title={t("让连接按自己的节奏发生")}
                      detail={t("从相遇卡片发起邀请，双方同意后才建立连接。")}
                      action={
                        <button
                          className="outline"
                          onClick={() => setTab("encounters")}
                        >
                          {t("回顾相遇")}
                          <ArrowRight size={14} />
                        </button>
                      }
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>
                      {t("我的连接")}{" "}
                      <span className="count">{connections.length}</span>
                    </h2>
                  </div>
                  {connections.length ? (
                    connections.map((e) => (
                      <div className="request-row" key={e.id}>
                        <span className="avatar warm">
                          <Handshake size={20} />
                        </span>
                        <div>
                          <strong>
                            {t("演示伙伴")} {e.peerId}
                          </strong>
                          <p>
                            {t(e.context)} {t("· 双方已同意")}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setSelectedId(e.id)}
                        >
                          {t("管理")}
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title={t("为值得的连接留一点空间")}
                      detail={t("你可以随时撤回分享或移除连接。")}
                    />
                  )}
                </section>
              </div>
            </>
          )}

          {tab === "profile" && (
            <div className="profile-layout">
              <section className="panel">
                <ProfileEditor
                  key={state.configRevision}
                  profile={profile}
                  onSave={updateProfile}
                  isDemo={isDemo}
                />
              </section>
              <aside className="right-column">
                <section className="intent-card">
                  <div className="section-top">
                    <span>
                      <Sparkles size={16} />
                      {t("当前意向")}
                    </span>
                  </div>
                  <h3>{t(profile.intent)}</h3>
                  <p>
                    {isIntentActive(profile, now)
                      ? t("意向有效中")
                      : t("意向已到期")}
                  </p>
                  <button
                    className="outline full"
                    onClick={() => setDialog("intent")}
                  >
                    {t("修改意向与有效期")}
                    <ArrowRight size={15} />
                  </button>
                </section>
                <section className="panel compact-panel">
                  <div className="setting-row">
                    <div>
                      <strong>{t("允许发现")}</strong>
                      <p>
                        {active
                          ? t("当前设置允许设备发现")
                          : t("需授权标签及有效意向")}
                      </p>
                    </div>
                    <Toggle
                      label={t("允许发现")}
                      checked={profile.discovery}
                      onChange={() =>
                        updateProfile({ discovery: !profile.discovery })
                      }
                    />
                  </div>
                  <p className="small-print">
                    {t("设备需同步后才应用修改。现有记录和已建立连接会保留。")}
                  </p>
                  <button
                    className="setting-link"
                    onClick={() => setDialog("device")}
                  >
                    <Bluetooth size={17} />
                    {t("设备与同步")}
                    <ChevronRight size={15} />
                  </button>
                  <button
                    className="setting-link"
                    onClick={() => setDialog("privacy")}
                  >
                    <ShieldCheck size={17} />
                    {t("隐私与数据")}
                    <ChevronRight size={15} />
                  </button>
                  <button
                    className="setting-link"
                    onClick={() => setDialog("source")}
                  >
                    <Menu size={17} />
                    {t("切换体验空间")}
                    <ChevronRight size={15} />
                  </button>
                </section>
              </aside>
            </div>
          )}

          <footer className="page-footer">
            <span>
              <Radar size={14} /> UNIVERSITY RADAR{" "}
              <span className="footer-dot">/</span> {t("让连接回归自然")}
            </span>
            <span>
              V0.1 · {isDemo ? t("虚构演示数据") : t("本机原型")}{" "}
              <span className="footer-dot">·</span>{" "}
              {profile.mode === "student" ? t("校园模式") : t("校友模式")}
            </span>
          </footer>
        </main>
      </div>
      <nav
        className="mobile-nav"
        inert={!state.onboarded || undefined}
        aria-label={t("移动端主导航")}
      >
        {NAV.map((n) => (
          <button
            key={n.id}
            aria-current={tab === n.id ? "page" : undefined}
            className={tab === n.id ? "active" : ""}
            onClick={() => setTab(n.id)}
          >
            <n.icon size={21} />
            <span>{t(n.label)}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {t(toast)}
        </div>
      )}

      {!state.onboarded && (
        <div className="welcome-backdrop">
          <section
            className="welcome"
            aria-labelledby="welcome-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="welcome-art">
              <Radar size={62} strokeWidth={0.8} />
              <p>UNIVERSITY RADAR</p>
              <h2>
                {t("找到同频，")}
                <br />
                {t("也保有边界。")}
              </h2>
              <span>
                AN OPEN WORLD.
                <br />
                AT YOUR OWN PACE.
              </span>
            </div>
            <div className="welcome-copy">
              <Pill>{t("欢迎来到你的同频空间")}</Pill>
              <h1 id="welcome-title">
                {t("从一次安心的")}
                <br />
                {t("相遇开始。")}
              </h1>
              <div className="welcome-point">
                <ShieldCheck size={20} />
                <div>
                  <strong>{t("匿名相遇")}</strong>
                  <p>{t("记录共同点，不获取实时定位。")}</p>
                </div>
              </div>
              <div className="welcome-point">
                <Eye size={20} />
                <div>
                  <strong>{t("自主公开")}</strong>
                  <p>{t("真实资料和广播授权默认关闭。")}</p>
                </div>
              </div>
              <div className="welcome-point">
                <Handshake size={20} />
                <div>
                  <strong>{t("双方同意")}</strong>
                  <p>{t("你决定分享哪些信息，以及何时撤回。")}</p>
                </div>
              </div>
              <button
                className="primary full"
                onClick={() => commit(demoState())}
              >
                {t("先体验演示")}
                <ArrowRight size={17} />
              </button>
              <button
                className="outline full"
                onClick={() => {
                  commit({ ...initialState(), onboarded: true });
                  setTab("profile");
                }}
              >
                {t("设置我的真实设备")}
                <Bluetooth size={16} />
              </button>
              <small>
                {t(
                  "演示使用虚构资料，仅保存在本机。当前版本无云端账号与真实消息服务。",
                )}
              </small>
            </div>
          </section>
        </div>
      )}

      {dialog === "device" && (
        <Modal title={t("我的 nRF52832 雷达")} onClose={closeDialog}>
          <div className="note">
            <Bluetooth size={18} />
            <span>
              {isDemo
                ? t(
                    "当前为演示空间，设备状态与同步均为模拟。使用真实设备请先切换到设备空间。",
                  )
                : t(bluetoothAvailability().note)}
            </span>
          </div>
          <div className="device-summary">
            <span className="device-summary-icon">
              <Radio size={32} />
            </span>
            <div>
              <h3>
                {isDemo
                  ? t("Radar One · 演示设备")
                  : (device?.name ?? t("尚未连接设备"))}
              </h3>
              <p>
                {isDemo
                  ? t("模拟电量 72% · 固件未连接")
                  : device
                    ? `${t("固件")} ${device.status.firmware} ${t("· 估算电量")} ${device.status.battery}%`
                    : t("请给设备通电，并让其进入配置窗口。")}
              </p>
            </div>
          </div>
          {!isDemo && device && (
            <div className="setting-row">
              <div>
                <strong>{t("设备编号")}</strong>
                <p className="device-serial">
                  {device.status.serialNumber ??
                    t("旧版固件未提供，请升级固件")}
                </p>
              </div>
            </div>
          )}
          {deviceError && (
            <div role="alert" className="error-message">
              {t(deviceError)}
            </div>
          )}
          <div className="setting-row">
            <div>
              <strong>{t("本机配置")}</strong>
              <p>
                {isDemo
                  ? t("仅保存在演示空间")
                  : dirty
                    ? t("待同步至设备")
                    : t("设备已确认当前版本")}
              </p>
            </div>
            <Pill muted>
              {t("版本")} {state.configRevision}
            </Pill>
          </div>
          <p className="subtle">
            {t(
              "手机连接用于配置和同步。离开手机后，nRF52832 继续使用已保存的规则。关闭手机蓝牙不会自动暂停设备发现。",
            )}
          </p>
          {isDemo ? (
            <button
              className="primary full"
              disabled={busy}
              onClick={() => void sync()}
            >
              <RefreshCw size={16} />
              {syncLabel}
              {t("（模拟）")}
            </button>
          ) : device ? (
            <>
              <button
                disabled={busy}
                className="primary full"
                onClick={() => void sync()}
              >
                <RefreshCw size={16} />
                {syncLabel}
              </button>
              <button
                disabled={busy}
                className="outline full"
                onClick={() => void client.current!.disconnect()}
              >
                {t("断开连接")}
              </button>
            </>
          ) : (
            <button
              disabled={busy || !bluetoothAvailability().available}
              className="primary full"
              onClick={() => void connect()}
            >
              <Bluetooth size={16} />
              {busy ? t("正在连接…") : t("选择并连接设备")}
            </button>
          )}
          <div className="small-print">
            {t("首版协议用于开发联调。真实板卡的供电、射频与固件仍需实测。")}
          </div>
        </Modal>
      )}
      {dialog === "intent" && (
        <Modal title={t("此刻，想遇见怎样的人？")} onClose={closeDialog}>
          <IntentEditor
            profile={profile}
            onSave={(p) => {
              updateProfile(p);
              setDialog(null);
            }}
          />
        </Modal>
      )}
      {dialog === "privacy" && (
        <Modal title={t("隐私与数据，由你掌握")} onClose={closeDialog}>
          <div className="privacy-heading">
            <ShieldCheck size={29} />
            <div>
              <h3>{t("身份资料默认不公开")}</h3>
              <p>{t("所选匹配标签的广播授权在“我的”单独设置。")}</p>
            </div>
          </div>
          <p className="form-label">{t("演示连接时，我愿意分享")}</p>
          <div className="share-fields">
            {FIELD_LIST.map((field) => (
              <label className="check-row" key={field}>
                <input
                  type="checkbox"
                  checked={profile.revealFields.includes(field)}
                  onChange={() =>
                    updateProfile({
                      revealFields: profile.revealFields.includes(field)
                        ? profile.revealFields.filter((f) => f !== field)
                        : [...profile.revealFields, field],
                    })
                  }
                />
                {t(FIELD_NAMES[field])}
                <small>{profile[field] || t("尚未填写")}</small>
              </label>
            ))}
          </div>
          <p className="small-print">
            {t(
              "仅影响之后发起的演示邀请。已建立连接的分享范围可在对应卡片撤回。真实身份交换服务尚未实现。",
            )}
          </p>
          <div className="setting-row">
            <div>
              <strong>{t("暂停发现")}</strong>
              <p>{t("需同步至设备后生效")}</p>
            </div>
            <button
              className="outline compact"
              onClick={() => updateProfile({ discovery: !profile.discovery })}
            >
              {profile.discovery ? <Pause size={14} /> : <Play size={14} />}
              {profile.discovery ? t("暂停") : t("开启")}
            </button>
          </div>
          <button
            className="setting-link"
            onClick={() => {
              void downloadState(state)
                .then(() =>
                  notify(t("已导出 JSON，文件含本机资料，请妥善保管")),
                )
                .catch((e) =>
                  notify(
                    e instanceof Error ? e.message : t("导出失败，请重试"),
                  ),
                );
            }}
          >
            <ArrowDownToLine size={17} />
            {t("导出本机数据")}
            <ArrowUpRight size={15} />
          </button>
          <button
            className="setting-link danger-text"
            onClick={() => setDialog("reset")}
          >
            <Trash2 size={17} />
            {t("清除本机数据")}
            <ChevronRight size={15} />
          </button>
          <p className="small-print">
            {t(
              "数据保存在当前浏览器或 App 本机存储，尚未加密，也未上传服务器。清除本机数据不会擦除设备内记录；再次同步可能重新下载。",
            )}
          </p>
        </Modal>
      )}
      {dialog === "reset" && (
        <Modal title={t("清除本机资料和记录？")} onClose={closeDialog}>
          <p className="subtle">
            {t(
              "此操作将删除本机资料、相遇记录和演示连接，无法恢复。硬件里的配置和记录会保留，若要暂停发现，请先返回并同步关闭配置。",
            )}
          </p>
          <button
            disabled={busy}
            className="danger full"
            onClick={() => void reset(initialState())}
          >
            {t("确认清除本机数据")}
          </button>
          <button className="outline full" onClick={closeDialog}>
            {t("保留数据")}
          </button>
        </Modal>
      )}
      {dialog === "source" && (
        <Modal title={t("选择体验空间")} onClose={closeDialog}>
          <p className="subtle">
            {t("当前为")}
            {isDemo ? t("演示空间") : t("设备空间")}
            {t(
              "。切换会清除当前本机资料和记录；可先从隐私设置导出备份。真实设备不会被擦除或自动暂停。",
            )}
          </p>
          <button
            disabled={busy}
            className="primary full"
            onClick={() => void reset(demoState())}
          >
            {t("清除当前数据并进入演示")}
            <Sparkles size={16} />
          </button>
          <button
            disabled={busy}
            className="outline full"
            onClick={() => void reset({ ...initialState(), onboarded: true })}
          >
            {t("清除当前数据并设置真实设备")}
            <Bluetooth size={16} />
          </button>
        </Modal>
      )}

      {selected && (
        <Modal
          title={`${t("同频者")} ${selected.peerId}`}
          onClose={closeEncounter}
        >
          <div className="encounter-detail-top">
            <span className="avatar large">{selected.peerId.slice(0, 2)}</span>
            <div>
              <h3>{t("一次值得了解的相遇")}</h3>
              <p>
                {t(selected.context)} · {selected.day} {t(selected.period)}
              </p>
            </div>
          </div>
          <p className="form-label">{t("你们的共同点")}</p>
          <div className="tags large-tags">
            {matchReasons(profile, {
              ...selected,
              hidden: false,
              blocked: false,
            }).length ? (
              matchReasons(profile, {
                ...selected,
                hidden: false,
                blocked: false,
              }).map((reason) => (
                <span key={reason}>
                  <Check size={13} />
                  {t(reason)}
                </span>
              ))
            ) : (
              <span>{t("当前规则下暂无同频原因")}</span>
            )}
          </div>
          <div className="note">
            <LockKeyhole size={16} />
            <span>
              {t(
                "当前保留匿名代号与匹配摘要，不包含对方姓名、照片、联系方式或精确位置。",
              )}
            </span>
          </div>
          {selected.source === "device" ? (
            <div className="pending-box">
              <h3>{t("真实连接服务尚未接入")}</h3>
              <p>
                {t(
                  "这条记录来自设备。目前仅支持回顾和管理匿名相遇，不能发送邀请或交换身份。",
                )}
              </p>
            </div>
          ) : selected.connection === "connected" ? (
            <div className="pending-box">
              <Pill>
                <Check size={13} />
                {t("演示双方已同意")}
              </Pill>
              <h3>
                {t("演示伙伴")} {selected.peerId}
              </h3>
              <p>{t("对方演示信息：演示专业 · peer@example.com")}</p>
              <p>
                {t("你分享的字段：")}
                {selected.sharedFields
                  .map((f) => t(FIELD_NAMES[f]))
                  .join(language === "zh" ? "、" : ", ") ||
                  t("未分享任何身份字段")}
              </p>
              <button
                className="outline full"
                onClick={() => {
                  updateEncounter(selected.id, {
                    connection: "none",
                    sharedFields: [],
                  });
                  notify(t("已移除演示连接并撤回分享"));
                }}
              >
                {t("移除连接并撤回分享")}
              </button>
              <p className="small-print">
                {t("撤回不能删除对方已经保存或截图的信息。")}
              </p>
            </div>
          ) : selected.connection === "outgoing" ? (
            <div className="pending-box">
              <h3>{t("等待对方同意")}</h3>
              <p>{t("这是本机演示邀请，没有真实用户收到消息。")}</p>
              <button
                className="primary full"
                onClick={() => {
                  updateEncounter(selected.id, { connection: "connected" });
                  notify(t("已模拟对方同意，演示连接成立"));
                }}
              >
                {t("模拟对方同意（演示）")}
                <Handshake size={16} />
              </button>
              <button
                className="outline full"
                onClick={() =>
                  updateEncounter(selected.id, {
                    connection: "none",
                    sharedFields: [],
                  })
                }
              >
                {t("撤回邀请")}
              </button>
            </div>
          ) : (
            <>
              <p className="form-label">{t("双方同意后，你将分享")}</p>
              <div className="reveal-preview">
                {profile.revealFields.length ? (
                  profile.revealFields.map((f) => (
                    <div key={f}>
                      <span>{t(FIELD_NAMES[f])}</span>
                      <strong>{profile[f] || t("尚未填写")}</strong>
                    </div>
                  ))
                ) : (
                  <p>{t("尚未选择公开字段。可前往隐私设置主动勾选。")}</p>
                )}
              </div>
              <button
                className="primary full"
                disabled={
                  selected.blocked ||
                  selected.hidden ||
                  !profile.revealFields.length
                }
                onClick={() => {
                  updateEncounter(selected.id, {
                    connection: "outgoing",
                    sharedFields: [...profile.revealFields],
                  });
                  notify(t("演示邀请已保存，等待模拟对方同意"));
                }}
              >
                {t("发起演示连接")}
                <ArrowUpRight size={16} />
              </button>
              <button
                className="text-button full"
                onClick={() => {
                  setSelectedId(null);
                  setDialog("privacy");
                }}
              >
                {t("修改我的分享范围")}
                <Settings2 size={14} />
              </button>
            </>
          )}
          <div className="detail-actions">
            <button
              onClick={() => {
                updateEncounter(selected.id, { hidden: !selected.hidden });
                setSelectedId(null);
              }}
            >
              {selected.hidden ? t("取消隐藏") : t("隐藏记录")}
            </button>
            <button
              onClick={() => {
                updateEncounter(selected.id, {
                  blocked: !selected.blocked,
                  connection: "none",
                  sharedFields: [],
                });
                setSelectedId(null);
                notify(
                  selected.blocked
                    ? t("已取消本机屏蔽")
                    : t("已在本机屏蔽此代号；设备端屏蔽尚未实现"),
                );
              }}
            >
              {selected.blocked ? t("取消屏蔽") : t("屏蔽此代号")}
            </button>
            <button
              disabled={selected.reported}
              onClick={() => {
                updateEncounter(selected.id, { reported: true });
                notify(t("已在本机标记，未发送举报；后台服务尚未接入"));
              }}
            >
              {selected.reported ? t("已本机标记") : t("标记待举报")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EncounterCard({
  encounter: e,
  profile,
  index,
  onOpen,
}: {
  encounter: Encounter;
  profile: Profile;
  index: number;
  onOpen: () => void;
}) {
  const reasons = matchReasons(profile, e);
  return (
    <button className="encounter-card" onClick={onOpen}>
      <span className={`avatar peer color-${index % 3}`}>
        {e.peerId.slice(0, 2)}
        <span className="avatar-status">
          <Link2 size={9} />
        </span>
      </span>
      <span className="encounter-main">
        <span className="encounter-title">
          <strong>
            {t("同频者")} {e.peerId}
          </strong>
          <span className="mini-label">
            {e.source === "demo" ? t("演示") : t("设备记录")}
          </span>
          {e.connection === "connected" && (
            <span className="mini-label connected-label">{t("已连接")}</span>
          )}
        </span>
        <span className="encounter-meta">
          {t(e.context)}
          <span>·</span>
          {e.day} {t(e.period)}
        </span>
        <span className="reason-line">
          <Sparkles size={12} />
          {reasons.length
            ? reasons.slice(0, 3).map(t).join(" · ")
            : e.blocked
              ? t("已在本机屏蔽")
              : e.hidden
                ? t("已隐藏")
                : t("暂无共同标签")}
        </span>
      </span>
      <span className="encounter-arrow">
        <ArrowUpRight size={18} />
      </span>
    </button>
  );
}
