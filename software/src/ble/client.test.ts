import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  initialize: vi.fn(),
  requestDevice: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  startNotifications: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@capacitor-community/bluetooth-le", () => ({ BleClient: fake }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
import { RadarBleClient } from "./client";
import { frameMessage } from "./protocol";
import { demoState } from "../domain";

let notify: (data: DataView) => void;
let onDisconnect: () => void;
let fragments: Uint8Array[];
let requests: Record<string, unknown>[];
let reply: (request: Record<string, unknown>) => unknown;
beforeEach(() => {
  vi.clearAllMocks();
  fragments = [];
  requests = [];
  fake.initialize.mockResolvedValue(undefined);
  fake.requestDevice.mockResolvedValue({
    deviceId: "test-device",
    name: "UR-Radar",
  });
  fake.connect.mockImplementation(async (_id, callback) => {
    onDisconnect = callback;
  });
  fake.disconnect.mockImplementation(async () => {
    onDisconnect?.();
  });
  fake.startNotifications.mockImplementation(
    async (_id, _service, _characteristic, callback) => {
      notify = callback;
    },
  );
  reply = (request) =>
    request.cmd === "status"
      ? {
          ok: true,
          protocolVersion: 1,
          dictionaryVersion: 1,
          firmware: "test",
          battery: 72,
        }
      : request.cmd === "configure"
        ? { ok: true, appliedRevision: request.revision }
        : { ok: true, records: [], nextCursor: "", hasMore: false };
  fake.write.mockImplementation(
    async (_id, _service, _characteristic, frame: DataView) => {
      if (frame.getUint8(4) === 0) fragments = [];
      fragments.push(
        new Uint8Array(
          frame.buffer,
          frame.byteOffset + 6,
          frame.byteLength - 6,
        ),
      );
      if (frame.getUint8(4) + 1 === frame.getUint8(5)) {
        const bytes = new Uint8Array(
          fragments.reduce((n, f) => n + f.length, 0),
        );
        let offset = 0;
        for (const f of fragments) {
          bytes.set(f, offset);
          offset += f.length;
        }
        const request = JSON.parse(new TextDecoder().decode(bytes));
        requests.push(request);
        const response = reply(request);
        if (response !== undefined)
          for (const part of frameMessage(
            frame.getUint16(2, true),
            response,
            2,
          ))
            notify(part);
      }
    },
  );
});
afterEach(() => vi.useRealTimers());

describe("real BLE adapter contract", () => {
  it("surfaces firmware storage, radio and clock conditions", async () => {
    const client = new RadarBleClient();
    reply = () => ({
      ok: true,
      protocolVersion: 1,
      dictionaryVersion: 1,
      firmware: "test",
      battery: 72,
      clockReady: false,
    });
    expect((await client.connect()).status.warning).toContain("校时");
    reply = () => ({
      ok: true,
      protocolVersion: 1,
      dictionaryVersion: 1,
      firmware: "test",
      battery: 72,
      radioFault: true,
    });
    expect((await client.status()).warning).toContain("广播或扫描");
    reply = () => ({
      ok: true,
      protocolVersion: 1,
      dictionaryVersion: 1,
      firmware: "test",
      battery: 72,
      flashFault: true,
    });
    expect((await client.status()).warning).toContain("Flash");
  });
  it("uses encrypted-capable service operations and only sends authorized matching data", async () => {
    const client = new RadarBleClient();
    const device = await client.connect();
    expect(device.status.battery).toBe(72);
    const profile = demoState().profile;
    await client.configure(profile, 5);
    const request = requests.at(-1)!;
    expect(request.config).toMatchObject({
      discovery: true,
      tags: profile.tags,
    });
    expect(JSON.stringify(request)).not.toContain(profile.contact);
    expect(JSON.stringify(request)).not.toContain(profile.name);
    expect(
      fake.write.mock.calls.every(
        (call) => (call[3] as DataView).byteLength <= 20,
      ),
    ).toBe(true);
    await client.disconnect();
  });
  it("never confirms a revision without the matching firmware acknowledgement", async () => {
    const client = new RadarBleClient();
    await client.connect();
    reply = () => ({ ok: true, appliedRevision: 4 });
    await expect(client.configure(demoState().profile, 5)).rejects.toThrow(
      "未确认配置版本",
    );
    reply = () => ({ ok: false, error: "flash_write_failed" });
    await expect(client.configure(demoState().profile, 5)).rejects.toThrow(
      "flash_write_failed",
    );
  });
  it("sends disabled discovery and no tags when the intent has expired", async () => {
    const client = new RadarBleClient();
    await client.connect();
    await client.configure(demoState(1000).profile, 1);
    expect(requests.at(-1)?.config).toMatchObject({
      discovery: false,
      tags: [],
    });
  });
  it("rejects an incompatible dictionary and cleans up the connection", async () => {
    const client = new RadarBleClient();
    reply = () => ({
      ok: true,
      protocolVersion: 1,
      dictionaryVersion: 99,
      firmware: "bad",
      battery: 72,
    });
    await expect(client.connect()).rejects.toThrow("不兼容");
    expect(client.device).toBeNull();
    expect(fake.disconnect).toHaveBeenCalled();
  });
  it("ignores remote identity/consent claims and only admits valid anonymous records", async () => {
    const client = new RadarBleClient();
    await client.connect();
    const record = {
      id: "1",
      peerId: "ABCDEF12",
      mode: "student",
      schoolId: 1,
      tags: [1, 2],
      day: "2026-10-22",
      period: "下午",
      context: "离线相遇",
      name: "do not retain",
      contact: "private@example.com",
      source: "demo",
      connection: "connected",
    };
    reply = () => ({
      ok: true,
      records: [record],
      nextCursor: "1",
      hasMore: false,
    });
    const page = await client.encounters("");
    expect(page.records[0]).toMatchObject({
      id: "test-device:1",
      source: "device",
      connection: "none",
      sharedFields: [],
    });
    expect(page.records[0]).not.toHaveProperty("name");
    expect(page.records[0]).not.toHaveProperty("contact");
    record.tags = [999];
    await expect(client.encounters("")).rejects.toThrow("不符合");
  });
  it("times out without advancing anything and allows a later retry", async () => {
    vi.useFakeTimers();
    const client = new RadarBleClient();
    await client.connect();
    reply = () => undefined;
    const pending = client.encounters("");
    const assertion = expect(pending).rejects.toThrow("响应超时");
    await vi.advanceTimersByTimeAsync(12001);
    await assertion;
    reply = () => ({ ok: true, records: [], nextCursor: "", hasMore: false });
    await expect(client.encounters("")).resolves.toMatchObject({ records: [] });
  });
  it("rejects a pending command immediately on disconnect", async () => {
    const client = new RadarBleClient();
    await client.connect();
    reply = () => undefined;
    const pending = client.encounters("");
    const assertion = expect(pending).rejects.toThrow("连接已断开");
    onDisconnect();
    await assertion;
    expect(client.device).toBeNull();
  });
});
