export type Language = "zh" | "en";
const KEY = "university-radar:language";
let language: Language = "zh";
try {
  if (typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "en")
    language = "en";
} catch {
  /* language remains usable for this session */
}

export function getLanguage(): Language {
  return language;
}
export function setLanguage(next: Language): void {
  language = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* non-persistent session */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    document.title =
      next === "zh"
        ? "University Radar · 遇见同频"
        : "University Radar · Find common ground";
  }
}

const en: Record<string, string> = {
  雷达: "Radar",
  相遇: "Encounters",
  连接: "Connections",
  我的: "Profile",
  关闭对话框: "Close dialog",
  "告诉同频的人，你现在期待什么。意向到期后会停止发现，重新设置后可继续。":
    "Choose what you are looking for. Discovery pauses when your intent expires.",
  有效期: "Duration",
  "1 天": "1 day",
  "3 天": "3 days",
  "7 天": "7 days",
  "软件中的意向用于回顾和说明。首版设备广播只包含已授权标签与匹配设置，不广播姓名或联系方式。":
    "Your intent is used for context in the app. The device broadcasts only authorised tags and matching settings, not your name or contact details.",
  保存意向: "Save intent",
  让同频有迹可循: "Your matching profile",
  称呼: "Name",
  你希望如何被称呼: "What should we call you?",
  专业: "Subject",
  "例如：电子与计算机工程": "e.g. Electronic and Computer Engineering",
  联系方式: "Contact details",
  "可选，默认不分享": "Optional, not shared by default",
  当前阶段: "Stage",
  在校学生: "Student",
  毕业校友: "Alumni",
  学校: "University",
  我的标签: "My tags",
  选择希望用于同频匹配的方向: "Choose topics to use for matching",
  至少共同命中: "Minimum shared tags",
  "1 个标签": "1 tag",
  "2 个标签": "2 tags",
  "3 个标签": "3 tags",
  校友模式仅匹配同校: "Match alumni from the same university only",
  "允许设备广播所选标签摘要及学校／阶段编码，用于离线匹配。附近设备可能推断这些含义；摘要不是加密。":
    "Allow the device to broadcast selected tags and university and stage codes for offline matching. Nearby devices may infer their meaning; the summary is not encrypted.",
  保存资料与规则: "Save profile and rules",
  "本机存储失败，当前改动仅保留在本次会话，请导出备份。":
    "Local storage failed. Changes are only available in this session; export a backup.",
  演示设置已保存: "Demo settings saved",
  "设置已保存，请连接设备并同步后生效":
    "Settings saved. Connect and sync the device to apply them.",
  "设备连接已断开，请重新连接。": "Device disconnected. Reconnect to continue.",
  "设备已连接，点击同步写入设置":
    "Device connected. Sync to apply your settings.",
  "连接失败，请检查蓝牙权限。":
    "Connection failed. Check Bluetooth permissions.",
  "演示同步完成，未连接真实设备":
    "Demo sync complete; no physical device was connected.",
  "设备连接已断开，请重新连接后同步。":
    "Device disconnected. Reconnect and sync again.",
  "记录未能保存到本机，同步游标未前进。请释放存储空间后重试。":
    "Records could not be saved locally. The sync cursor has not advanced. Free storage and retry.",
  "本批记录已保存，点击同步继续读取":
    "This page was saved. Sync again for more records.",
  "配置已确认，相遇记录已同步":
    "Configuration confirmed and encounters synced.",
  同步失败: "Sync failed",
  "正在同步…": "Syncing…",
  继续同步: "Continue sync",
  同步设备: "Sync device",
  跳到主要内容: "Skip to content",
  你的同频空间: "Your space",
  主导航: "Main navigation",
  "好的连接，始于安心": "Connection with confidence",
  "匿名相遇，自主公开。": "Anonymous encounters, your choice to share.",
  "每一步，都由你决定。": "You decide at every step.",
  了解隐私设置: "Privacy settings",
  我的雷达: "My radar",
  "· 本机空间": "· Local space",
  本机空间: "Local space",
  我的空间: "My space",
  演示空间: "Demo space",
  设备空间: "Device space",
  了解隐私与使用说明: "Privacy and usage information",
  遇见同频的可能: "Find common ground",
  "每次相遇，都有来由": "Your encounters",
  "把相遇，变成连接": "From encounters to connections",
  定义你的频率: "Set your preferences",
  "带上雷达，回到生活。值得认识的人，留待你慢慢发现。":
    "Carry your radar and discover connections at your own pace.",
  "回顾设备留下的匿名记录，了解你们为什么同频。":
    "Review anonymous device records and see what you share.",
  "先了解共同点，再决定是否公开自己的信息。":
    "Explore shared interests before deciding what to share.",
  "兴趣、意向和公开范围，随时由你调整。":
    "Change your interests, intent and sharing choices at any time.",
  隐私与数据: "Privacy and data",
  我的设备: "My device",
  在校同频: "Student matching",
  校友同频: "Alumni matching",
  发现已开启: "Discovery on",
  发现已暂停: "Discovery paused",
  "相遇自有频率。": "Find common ground.",
  "连接由你决定。": "Connection is your choice.",
  "让共同的兴趣与方向，": "Shared interests and goals",
  "成为下一次对话的开始。": "can start a conversation.",
  回顾我的相遇: "Review encounters",
  "匿名记录 · 无实时定位": "Anonymous records · no live location",
  共同的热爱: "Shared interests",
  相似的方向: "Common goals",
  随身雷达: "Your radar",
  "Radar One · 演示设备": "Radar One · demo device",
  "连接你的 Radar One": "Connect your Radar One",
  模拟连接: "Simulated connection",
  已连接: "Connected",
  尚未连接真实设备: "No physical device connected",
  "设备编号：": "Device serial: ",
  旧版固件未提供: "Unavailable on older firmware",
  连接设备: "Connect device",
  上次同步: "Last synced",
  "演示数据，未进行真实蓝牙连接": "Demo data; no Bluetooth connection",
  设置与记录通过蓝牙同步: "Sync settings and records over Bluetooth",
  "记录的是相遇，不是附近人的实时位置。":
    "Records show encounters, not live locations.",
  了解工作方式: "How it works",
  "设置尚待设备确认。离线设备会继续使用上次同步的配置。":
    "Settings are awaiting device confirmation. The device continues using its last synced configuration.",
  去同步: "Sync now",
  值得回顾的相遇: "Recent encounters",
  "共同点，比一个分数更有意义": "Shared interests tell the story",
  查看全部: "View all",
  "同频的故事，等下一次出发": "No matches yet",
  "当前标签和规则下暂无同频记录，可在“我的”调整。":
    "No matches for the current tags and rules. Adjust them in Profile.",
  "设置你的标签，再连接设备同步相遇记录。":
    "Choose your tags, then connect your device to sync encounters.",
  设置我的频率: "Set preferences",
  当前意向: "Current intent",
  编辑当前意向: "Edit intent",
  还有: "Expires in",
  天到期: "days",
  "已到期 · 请重新设置": "Expired · choose a new intent",
  我的同频标签: "My matching tags",
  尚未设置: "Not set",
  "此刻，你想遇见谁？": "Who would you like to meet?",
  "先同频，再认识。": "Find common ground first.",
  "身份信息默认保留。双方同意后，": "Your identity stays private by default.",
  "才开启更多可能。": "Share only when both sides agree.",
  查看我的公开范围: "View sharing settings",
  筛选相遇: "Filter encounters",
  全部相遇: "All encounters",
  与我同频: "Matches",
  已隐藏: "Hidden",
  已屏蔽: "Blocked",
  搜索相遇记录: "Search encounters",
  搜索标签或相遇代号: "Search tags or encounter ID",
  "以下为虚构的概念测试记录，点击可体验授权流程。":
    "These fictional records demonstrate the consent flow.",
  "以下为设备同步的匿名记录。首版未接入身份服务，无法发起真实连接。":
    "These anonymous records came from the device. Real identity and messaging services are not yet available.",
  这里暂时没有相遇: "No encounters here yet",
  "试试其他筛选条件，或连接设备同步记录。":
    "Try a different filter or connect a device to sync records.",
  "本页演示双方授权流程。对方的动作由你明确模拟，不会向真实用户发送消息。":
    "This page simulates mutual consent. No messages are sent to real users.",
  "真实连接与跨用户授权服务尚未接入。设备记录保持匿名。":
    "Real connections and cross-user consent are not yet available. Device records remain anonymous.",
  连接请求: "Connection requests",
  同频者: "Match",
  "等待对方同意 · 演示": "Waiting for consent · demo",
  "对方希望与你连接 · 演示": "Incoming request · demo",
  查看: "View",
  让连接按自己的节奏发生: "Connect at your own pace",
  "从相遇卡片发起邀请，双方同意后才建立连接。":
    "Send an invitation from an encounter; both sides must agree.",
  回顾相遇: "Review encounters",
  我的连接: "My connections",
  演示伙伴: "Demo partner",
  "· 双方已同意": "· Both agreed",
  管理: "Manage",
  为值得的连接留一点空间: "Your connections will appear here",
  "你可以随时撤回分享或移除连接。":
    "You can stop sharing or remove a connection at any time.",
  意向有效中: "Intent active",
  意向已到期: "Intent expired",
  修改意向与有效期: "Edit intent and duration",
  允许发现: "Allow discovery",
  当前设置允许设备发现: "Current settings allow discovery",
  需授权标签及有效意向: "Authorised tags and an active intent are required",
  "设备需同步后才应用修改。现有记录和已建立连接会保留。":
    "Sync the device to apply changes. Existing records and connections remain.",
  设备与同步: "Device and sync",
  切换体验空间: "Switch space",
  让连接回归自然: "Connect naturally",
  虚构演示数据: "Fictional demo data",
  本机原型: "Local prototype",
  校园模式: "Campus mode",
  校友模式: "Alumni mode",
  移动端主导航: "Mobile navigation",
  "找到同频，": "Find common ground,",
  "也保有边界。": "on your terms.",
  欢迎来到你的同频空间: "Welcome to your space",
  从一次安心的: "Every connection",
  "相遇开始。": "starts with a choice.",
  匿名相遇: "Anonymous encounters",
  "记录共同点，不获取实时定位。":
    "Record shared interests without live location.",
  自主公开: "Choose what to share",
  "真实资料和广播授权默认关闭。":
    "Personal details and broadcast consent are off by default.",
  双方同意: "Mutual consent",
  "你决定分享哪些信息，以及何时撤回。":
    "You choose what to share and when to stop.",
  先体验演示: "Explore the demo",
  设置我的真实设备: "Set up my device",
  "演示使用虚构资料，仅保存在本机。当前版本无云端账号与真实消息服务。":
    "The demo uses fictional data stored locally. Cloud accounts and real messaging are not available.",
  "我的 nRF52832 雷达": "My nRF52832 radar",
  "当前为演示空间，设备状态与同步均为模拟。使用真实设备请先切换到设备空间。":
    "This is the demo space. Device status and sync are simulated. Switch to device space to use hardware.",
  尚未连接设备: "No device connected",
  "模拟电量 72% · 固件未连接": "Simulated battery 72% · no firmware connected",
  固件: "Firmware",
  "· 估算电量": "· Estimated battery",
  "请给设备通电，并让其进入配置窗口。":
    "Power on the device and open its pairing window.",
  设备编号: "Device serial",
  "旧版固件未提供，请升级固件":
    "Unavailable on older firmware; update the firmware",
  本机配置: "Local configuration",
  仅保存在演示空间: "Saved in the demo space only",
  待同步至设备: "Waiting to sync",
  设备已确认当前版本: "Device confirmed this version",
  版本: "Version",
  "手机连接用于配置和同步。离开手机后，nRF52832 继续使用已保存的规则。关闭手机蓝牙不会自动暂停设备发现。":
    "The phone configures and syncs the device. The nRF52832 continues using saved rules when disconnected. Turning off phone Bluetooth does not pause discovery.",
  "（模拟）": " (demo)",
  断开连接: "Disconnect",
  "正在连接…": "Connecting…",
  选择并连接设备: "Choose and connect device",
  "首版协议用于开发联调。真实板卡的供电、射频与固件仍需实测。":
    "This prototype protocol is for development. Hardware performance requires further testing.",
  "此刻，想遇见怎样的人？": "Who would you like to meet?",
  "隐私与数据，由你掌握": "Your privacy and data",
  身份资料默认不公开: "Identity details are private by default",
  "所选匹配标签的广播授权在“我的”单独设置。":
    "Broadcast consent for selected tags is configured separately in Profile.",
  "演示连接时，我愿意分享": "In demo connections, I choose to share",
  尚未填写: "Not provided",
  "仅影响之后发起的演示邀请。已建立连接的分享范围可在对应卡片撤回。真实身份交换服务尚未实现。":
    "Applies to future demo invitations. Revoke sharing on an existing connection's card. Real identity exchange is not implemented.",
  暂停发现: "Pause discovery",
  需同步至设备后生效: "Sync to apply on device",
  暂停: "Pause",
  开启: "Enable",
  "已导出 JSON，文件含本机资料，请妥善保管":
    "JSON exported. It contains local data; store it safely.",
  "导出失败，请重试": "Export failed. Try again.",
  导出本机数据: "Export local data",
  清除本机数据: "Clear local data",
  "数据保存在当前浏览器或 App 本机存储，尚未加密，也未上传服务器。清除本机数据不会擦除设备内记录；再次同步可能重新下载。":
    "Data is stored unencrypted in this browser or app and is not uploaded. Clearing local data does not erase device records; syncing may download them again.",
  "清除本机资料和记录？": "Clear local profile and records?",
  "此操作将删除本机资料、相遇记录和演示连接，无法恢复。硬件里的配置和记录会保留，若要暂停发现，请先返回并同步关闭配置。":
    "This deletes local profiles, encounters and demo connections. Device settings and records remain. To pause discovery, sync the disabled setting first.",
  确认清除本机数据: "Clear local data",
  保留数据: "Keep data",
  选择体验空间: "Choose a space",
  当前为: "Current space: ",
  "。切换会清除当前本机资料和记录；可先从隐私设置导出备份。真实设备不会被擦除或自动暂停。":
    ". Switching clears local data and records; export a backup first if needed. The device will not be erased or paused automatically.",
  清除当前数据并进入演示: "Clear local data and enter demo",
  清除当前数据并设置真实设备: "Clear local data and set up device",
  一次值得了解的相遇: "An encounter to explore",
  你们的共同点: "What you share",
  当前规则下暂无同频原因: "No shared reasons under current rules",
  "当前保留匿名代号与匹配摘要，不包含对方姓名、照片、联系方式或精确位置。":
    "Only an anonymous ID and matching summary are stored, without names, photos, contact details or precise location.",
  真实连接服务尚未接入: "Real connections are not available yet",
  "这条记录来自设备。目前仅支持回顾和管理匿名相遇，不能发送邀请或交换身份。":
    "This device record can be reviewed and managed anonymously. Invitations and identity exchange are not available.",
  演示双方已同意: "Both sides agreed · demo",
  "对方演示信息：演示专业 · peer@example.com":
    "Demo partner: example subject · peer@example.com",
  "你分享的字段：": "Fields you shared: ",
  未分享任何身份字段: "No identity fields shared",
  已移除演示连接并撤回分享: "Demo connection removed and sharing stopped",
  移除连接并撤回分享: "Remove connection and stop sharing",
  "撤回不能删除对方已经保存或截图的信息。":
    "Stopping sharing cannot remove information already saved or captured by the other person.",
  等待对方同意: "Waiting for consent",
  "这是本机演示邀请，没有真实用户收到消息。":
    "This is a local demo invitation. No real user received a message.",
  "已模拟对方同意，演示连接成立": "Consent simulated; demo connection created",
  "模拟对方同意（演示）": "Simulate consent (demo)",
  撤回邀请: "Withdraw invitation",
  "双方同意后，你将分享": "After mutual consent, you will share",
  "尚未选择公开字段。可前往隐私设置主动勾选。":
    "No sharing fields selected. Choose them in privacy settings.",
  "演示邀请已保存，等待模拟对方同意":
    "Demo invitation saved; awaiting simulated consent",
  发起演示连接: "Start demo connection",
  修改我的分享范围: "Change sharing settings",
  取消隐藏: "Unhide",
  隐藏记录: "Hide record",
  已取消本机屏蔽: "Local block removed",
  "已在本机屏蔽此代号；设备端屏蔽尚未实现":
    "Blocked locally; device-side blocking is not implemented",
  取消屏蔽: "Unblock",
  屏蔽此代号: "Block this ID",
  "已在本机标记，未发送举报；后台服务尚未接入":
    "Flagged locally; no report was sent because the service is not available",
  已本机标记: "Flagged locally",
  标记待举报: "Flag for reporting",
  演示: "Demo",
  设备记录: "Device record",
  已在本机屏蔽: "Blocked locally",
  暂无共同标签: "No shared tags",
  寻找项目伙伴: "Find project partners",
  聊聊研究方向: "Discuss research",
  认识兴趣伙伴: "Meet people with shared interests",
  交流职业机会: "Discuss career opportunities",
  嵌入式开发: "Embedded development",
  人工智能: "Artificial intelligence",
  产品设计: "Product design",
  机器人: "Robotics",
  摄影: "Photography",
  徒步: "Hiking",
  音乐: "Music",
  羽毛球: "Badminton",
  科技创业: "Technology entrepreneurship",
  科研合作: "Research collaboration",
  求职交流: "Career opportunities",
  行业分享: "Industry insights",
  研究: "Research",
  兴趣: "Interests",
  职业: "Career",
  西交利物浦大学: "Xi'an Jiaotong-Liverpool University",
  利物浦大学: "University of Liverpool",
  西安交通大学: "Xi'an Jiaotong University",
  姓名: "Name",
  同校校友: "Same university",
  上午: "Morning",
  下午: "Afternoon",
  晚间: "Evening",
  离线相遇: "Offline encounter",
  校园创客交流: "Campus maker event",
  校园日常: "Campus life",
  研究分享会: "Research event",
  "林同学（演示）": "Demo student",
  电子与计算机工程: "Electronic and Computer Engineering",
  "通过原生蓝牙连接 nRF52832。手机仅负责配置与同步。":
    "Connect to the nRF52832 via Bluetooth. The phone configures and syncs the device.",
  "网页蓝牙需要 HTTPS 或本机 localhost。":
    "Web Bluetooth requires HTTPS or localhost.",
  "当前浏览器不支持网页蓝牙。可使用支持 Web Bluetooth 的桌面 Chrome / Edge，或 Android、iOS 原生 App。":
    "This browser does not support Web Bluetooth. Use a compatible desktop Chrome or Edge, or the Android or iOS app.",
  "将打开浏览器的设备选择器。请让 nRF52832 进入配对模式。":
    "The browser will open a device picker. Put the nRF52832 into pairing mode.",
  "当前设备不支持低功耗蓝牙（BLE），无法连接雷达。请使用支持 BLE 的手机。":
    "This device does not support Bluetooth Low Energy (BLE). Use a phone with BLE to connect.",
  "协议解析失败。": "Protocol parsing failed.",
  "请先连接雷达设备。": "Connect a radar device first.",
  "设备正在处理上一条指令，请稍候。":
    "The device is processing another command. Please wait.",
  "设备响应超时。请确认固件实现了 University Radar v1 协议。":
    "Device response timed out. Check that the firmware supports University Radar v1.",
  "设备拒绝了指令。": "The device rejected the command.",
  "设备协议或标签字典版本不兼容，请更新固件。":
    "The device protocol or tag dictionary is incompatible. Update the firmware.",
  "设备状态格式无效。": "Invalid device status.",
  "设备报告 Flash 存储异常，请复查设备后重新同步。":
    "The device reports a Flash storage error. Check it and sync again.",
  "设备广播或扫描未能启动，请检查设备并重试。":
    "The device could not start advertising or scanning. Check it and retry.",
  "设备重启后需要校时，请同步设置以恢复有效期内的发现。":
    "The device needs its clock synced after restart. Sync settings to resume an active intent.",
  "设备未确认配置版本；请重新同步。":
    "The device did not confirm the configuration version. Sync again.",
  "设备相遇记录格式无效。": "Invalid device encounter page.",
  "设备已断开。": "Device disconnected.",
  "设备记录编号无效。": "Invalid device record ID.",
  "设备相遇记录不符合 v1 协议。":
    "The device encounter does not conform to protocol v1.",
  "本机数据格式无效，已打开空白会话。原数据未被覆盖。":
    "Local data is invalid. A blank session was opened without overwriting it.",
  "无法读取本机存储。请检查浏览器存储权限。":
    "Cannot read local storage. Check browser storage permissions.",
  保存或分享数据备份: "Save or share backup",
  "University Radar 本机数据": "University Radar local data",
};

/** Translate application-owned labels only; caller-provided content remains unchanged. */
export function t(value: string): string {
  return language === "en" && Object.prototype.hasOwnProperty.call(en, value)
    ? en[value]
    : value;
}
