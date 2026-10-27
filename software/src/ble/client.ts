import { BleClient, type BleDevice } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import {
  canDiscover,
  isEncounter,
  type Encounter,
  type Profile,
} from "../domain";
import {
  DICTIONARY_VERSION,
  frameMessage,
  NOTIFY,
  Reassembler,
  SERVICE,
  WRITE,
} from "./protocol";

export function bluetoothAvailability(): { available: boolean; note: string } {
  if (Capacitor.isNativePlatform())
    return {
      available: true,
      note: "通过原生蓝牙连接 nRF52832。手机仅负责配置与同步。",
    };
  if (!window.isSecureContext)
    return { available: false, note: "网页蓝牙需要 HTTPS 或本机 localhost。" };
  if (!("bluetooth" in navigator))
    return {
      available: false,
      note: "当前浏览器不支持网页蓝牙。可使用支持 Web Bluetooth 的桌面 Chrome / Edge，或 Android、iOS 原生 App。",
    };
  return {
    available: true,
    note: "将打开浏览器的设备选择器。请让 nRF52832 进入配对模式。",
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export interface DeviceStatus {
  firmware: string;
  battery: number;
  dictionaryVersion: number;
  warning: string | null;
}
export interface EncounterPage {
  records: Encounter[];
  nextCursor: string;
  hasMore: boolean;
}

export class RadarBleClient {
  device: BleDevice | null = null;
  private sequence = 0;
  private assembler = new Reassembler();
  private waiting = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private busy = false;
  private closed = () => {
    this.device = null;
    this.assembler.reset();
    for (const pending of this.waiting.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("设备连接已断开，请重新连接后同步。"));
    }
    this.waiting.clear();
    this.onDisconnect?.();
  };
  constructor(private onDisconnect?: () => void) {}
  async connect(): Promise<{ name: string; id: string; status: DeviceStatus }> {
    if (!bluetoothAvailability().available)
      throw new Error(bluetoothAvailability().note);
    await BleClient.initialize({ androidNeverForLocation: true });
    const device = await BleClient.requestDevice({ services: [SERVICE] });
    try {
      await BleClient.connect(device.deviceId, this.closed);
      this.device = device;
      await BleClient.startNotifications(
        device.deviceId,
        SERVICE,
        NOTIFY,
        (frame) => {
          try {
            const result = this.assembler.accept(frame);
            if (!result) return;
            const pending = this.waiting.get(result.id);
            if (pending) {
              clearTimeout(pending.timer);
              this.waiting.delete(result.id);
              pending.resolve(result.value);
            }
          } catch (error) {
            for (const pending of this.waiting.values()) {
              clearTimeout(pending.timer);
              pending.reject(
                error instanceof Error ? error : new Error("协议解析失败。"),
              );
            }
            this.waiting.clear();
            this.assembler.reset();
          }
        },
      );
      const status = await this.status();
      return {
        id: device.deviceId,
        name: device.name ?? "University Radar",
        status,
      };
    } catch (error) {
      await BleClient.disconnect(device.deviceId).catch(() => {});
      this.closed();
      throw error;
    }
  }
  async disconnect() {
    const id = this.device?.deviceId;
    try {
      if (id) await BleClient.disconnect(id);
    } finally {
      this.closed();
    }
  }
  private async command(body: unknown): Promise<Record<string, unknown>> {
    if (!this.device) throw new Error("请先连接雷达设备。");
    if (this.busy) throw new Error("设备正在处理上一条指令，请稍候。");
    this.busy = true;
    const id = (this.sequence = (this.sequence % 65535) + 1);
    const deviceId = this.device.deviceId;
    let response: Promise<unknown> | undefined;
    try {
      const frames = frameMessage(id, body);
      response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.waiting.delete(id);
          reject(
            new Error(
              "设备响应超时。请确认固件实现了 University Radar v1 协议。",
            ),
          );
        }, 12000);
        this.waiting.set(id, { resolve, reject, timer });
      });
      // Register a rejection handler before asynchronous writes to avoid unhandled rejection on disconnect.
      void response.catch(() => {});
      for (const frame of frames)
        await BleClient.write(deviceId, SERVICE, WRITE, frame);
      const result = await response;
      if (!record(result) || result.ok !== true)
        throw new Error(
          record(result) && typeof result.error === "string"
            ? result.error
            : "设备拒绝了指令。",
        );
      return result;
    } finally {
      const pending = this.waiting.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        this.waiting.delete(id);
      }
      this.busy = false;
    }
  }
  async status(): Promise<DeviceStatus> {
    const data = await this.command({ cmd: "status", protocolVersion: 1 });
    if (
      data.protocolVersion !== 1 ||
      data.dictionaryVersion !== DICTIONARY_VERSION
    )
      throw new Error("设备协议或标签字典版本不兼容，请更新固件。");
    if (
      typeof data.firmware !== "string" ||
      data.firmware.length > 40 ||
      !Number.isInteger(data.battery) ||
      Number(data.battery) < 0 ||
      Number(data.battery) > 100
    )
      throw new Error("设备状态格式无效。");
    return {
      firmware: data.firmware,
      battery: Number(data.battery),
      dictionaryVersion: DICTIONARY_VERSION,
      warning:
        data.flashFault === true
          ? "设备报告 Flash 存储异常，请复查设备后重新同步。"
          : data.radioFault === true
            ? "设备广播或扫描未能启动，请检查设备并重试。"
            : data.clockReady === false
              ? "设备重启后需要校时，请同步设置以恢复有效期内的发现。"
              : null,
    };
  }
  async configure(profile: Profile, revision: number): Promise<void> {
    const active = canDiscover(profile);
    const data = await this.command({
      cmd: "configure",
      protocolVersion: 1,
      dictionaryVersion: DICTIONARY_VERSION,
      revision,
      config: {
        discovery: active,
        mode: profile.mode,
        schoolId: profile.schoolId,
        tags: active ? profile.tags : [],
        minSharedTags: profile.minSharedTags,
        requireSameSchool: profile.requireSameSchool,
        intentExpiresAt: Math.floor(profile.intentExpiresAt / 1000),
        time: Math.floor(Date.now() / 1000),
      },
    });
    if (data.appliedRevision !== revision)
      throw new Error("设备未确认配置版本；请重新同步。");
  }
  async encounters(cursor: string): Promise<EncounterPage> {
    const data = await this.command({ cmd: "encounters", cursor, limit: 8 });
    if (
      !Array.isArray(data.records) ||
      data.records.length > 8 ||
      typeof data.nextCursor !== "string" ||
      data.nextCursor.length > 80 ||
      typeof data.hasMore !== "boolean"
    )
      throw new Error("设备相遇记录格式无效。");
    const deviceId = this.device?.deviceId;
    if (!deviceId) throw new Error("设备已断开。");
    const records = data.records.map((item) => {
      if (!record(item) || typeof item.id !== "string" || item.id.length > 30)
        throw new Error("设备记录编号无效。");
      const encounter = {
        id: `${deviceId}:${item.id}`,
        peerId: item.peerId,
        mode: item.mode,
        schoolId: item.schoolId,
        tags: item.tags,
        day: item.day,
        period: item.period,
        context: item.context,
        source: "device",
        hidden: false,
        blocked: false,
        reported: false,
        connection: "none",
        sharedFields: [],
      };
      if (!isEncounter(encounter))
        throw new Error("设备相遇记录不符合 v1 协议。");
      return encounter;
    });
    return { records, nextCursor: data.nextCursor, hasMore: data.hasMore };
  }
}
