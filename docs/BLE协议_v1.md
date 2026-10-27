# University Radar BLE v1

此协议已在 App 与固件源码两侧实现，仍需两台板卡和手机实测。协议版本及字典版本均为 1。

## 手机与设备 GATT

| 项 | UUID | 权限 |
|---|---|---|
| Service | `c0130001-9f39-4ae4-8fae-7d5a6b810001` | 主服务 |
| RX | `c0130002-9f39-4ae4-8fae-7d5a6b810001` | 手机 Write with response，需要加密 |
| TX | `c0130003-9f39-4ae4-8fae-7d5a6b810001` | 设备 Notify，CCC 需要加密 |

128 位服务 UUID 放在 scan response，供手机服务过滤。扫描连接仅在用户点击时开始。GATT 初始化、通知订阅、状态检查之后才允许写配置；连接失败不得自动切换演示数据。

首版固定兼容 ATT MTU 23，每次写入／通知最多 20 bytes。不要直接向特征写完整 JSON。

| byte | 定义 |
|---|---|
| 0 | 协议帧版本 = 1 |
| 1 | 类型：1 请求；2 响应 |
| 2–3 | request ID，uint16 little endian，范围 1–65535 |
| 4 | 分片序号，从 0 开始 |
| 5 | 总分片数，1–220 |
| 6–19 | UTF-8 JSON 原始字节，每片最多 14 bytes |

JSON 最大 3072 bytes。非末片必须恰好 14 bytes 负载，末片不能为空。先拼字节再解码 UTF-8；不能按字符切片。固件要求请求分片按序发送；App 对响应支持乱序与相同内容的重复片。未完成请求超时 15 秒；App 命令响应超时 12 秒。每次只执行一个命令。断线清空重组状态。

### status

```json
{"cmd":"status","protocolVersion":1}
```

```json
{"ok":true,"protocolVersion":1,"dictionaryVersion":1,"firmware":"0.1.0-zephyr","battery":72,"appliedRevision":3,"clockReady":true,"flashFault":false,"radioFault":false}
```

### configure

```json
{
  "cmd":"configure","protocolVersion":1,"dictionaryVersion":1,"revision":3,
  "config":{
    "discovery":true,"mode":"student","schoolId":1,"tags":[1,2],
    "minSharedTags":1,"requireSameSchool":true,
    "intentExpiresAt":1792944000,"time":1792684800
  }
}
```

- 字段全部必填；`mode` 只能是 `student` 或 `alumni`。标签 ID 取共享字典，不允许重复。
- `discovery` 为 App 授权、发现开关、非空标签和意向有效期的综合结果。关闭时发送空标签列表，固件停止匹配广播与扫描，但可保留配置连接能力。
- 不发送姓名、联系方式、专业文本或个人意向文本。专业相关同频在首版用已授权方向标签表达。
- `time` / `intentExpiresAt` 是 Unix seconds；固件接受 2023–2036 范围的校时，开启时有效期最多 8 天（UI 提供 1／3／7 天）。
- Flash 成功写入配置后才回复 `{"ok":true,"appliedRevision":3}`。失败回复 `{"ok":false,"error":"flash_write_failed"}`，不得显示同步成功。
- 设备重启不复用未经校时的 Unix 时间；需要再次 configure 恢复发现。

### encounters

```json
{"cmd":"encounters","cursor":"","limit":8}
```

```json
{
  "ok":true,
  "records":[{"id":"1","peerId":"4E2C9F1023AB678D","mode":"student","schoolId":1,"tags":[1,2],"day":"2026-10-22","period":"下午","context":"离线相遇"}],
  "nextCursor":"1","hasMore":false
}
```

设备不提供姓名、位置、距离或精确时间。日期与时段按 UTC+8 生成。`context` 固定为「离线相遇」，不从 RSSI 推断活动名称。

游标为空表示从最早保留记录开始，后续为递增记录序号。读记录不会删除 Flash 日志；App 成功保存记录后才能前移会话游标。重连可重放并按设备 ID + 记录序号去重。64 条记录装满后覆盖最老记录；这是有界存储，不保证无限期保留。

## 设备间广播

普通 legacy advertisement 最大 31 bytes，内容为 Flags + manufacturer data。厂商数据共 18 bytes：

| 偏移 | 字节数 | 含义 |
|---|---:|---|
| 0 | 2 | 测试 Company ID `0xffff`，little endian |
| 2 | 1 | 协议版本 1 |
| 3 | 1 | 标签字典版本 1 |
| 4 | 1 | 阶段：0 在校；1 校友 |
| 5 | 1 | 学校编码 1–3 |
| 6 | 1 | 共同标签门槛 1–3 |
| 7 | 1 | 校友同校要求 0／1 |
| 8 | 2 | 标签位图，ID n 对应 bit n−1，little endian |
| 10 | 8 | 随机临时代号，每 15 分钟轮换 |

字典版本不一致、未知位、非法字段或格式错误的广播直接忽略。不广播原始硬件序列号。蓝牙隐私启用可解析私有地址，须实测实际地址轮换行为；匿名代号并不等于不可追踪。

只有本机意向有效且授权发现时才发匹配摘要并扫描。两台阶段须一致；校友模式任一方要求同校时两者学校须一致；共同标签数须同时达到双方门槛。**双方各自在本机判断**，不需要上传后端。

初始实验参数：广播 250–300ms，发射 −4dBm，被动扫描窗口 30ms／间隔 200ms；RSSI 至少 −80dBm，同一代号在 5 秒连续窗口内至少持续出现 2 秒，才记录和绿灯提示 300ms。相同临时代号 10 分钟内去重；代号轮换会改变去重范围。参数是实验起点，不是已测的距离或续航保证。

## 连接与安全

开机前 60 秒可接受首次绑定；关闭窗口后仅绑定身份可连接。已有一条 GATT 连接时切换为不可连接的匹配广播，继续扫描；断开后恢复允许原手机连接的广播。三种无线角色的实际调度和功耗仍须实测。GATT 要求加密，采用无显示屏设备的 Just Works，**不提供 MITM 防护或应用层端到端身份认证**。

当前只保存一台手机绑定关系。维护时通过 SWD 擦除持久化区可解除，但会同时删除配置和相遇日志；不在 App 的「清除本机数据」里暗中执行硬件擦除。
