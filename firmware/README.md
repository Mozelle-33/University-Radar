# nRF52832 固件 v0.1

目标为 NRF52832-QFAA（512KB Flash / 64KB RAM）裸 IC 自制板。使用 PlatformIO Nordic nRF52 10.12.0 中固定的 Zephyr 2.7.1 工具链，以取得可复现的首轮验证环境。后续量产应单独规划受维护 SDK 的迁移、依赖与安全审查。

`nrf52_dk` 仅作为同芯片的构建起点；`boards/radar.overlay` 和代码按用户板卡引脚覆盖，不要求使用 DK 或蓝牙模块。

## 板级配置

| 功能 | 芯片引脚 | 实现 |
|---|---|---|
| 红灯 LED_R | P0.25 | 低电平点亮；持久化／扫描故障短闪 |
| 绿灯 LED_G | P0.26 | 低电平点亮；成功保存同频相遇后亮300ms |
| 蓝灯 LED_B | P0.27 | 低电平点亮；首次绑定窗口每4秒短闪25ms |
| 电池采样 | P0.04 / AIN2 | 1MΩ＋1MΩ，内部0.6V参考／1⁄6增益，12bit，40µs采样 |
| TXD / RXD | P0.06 / P0.08 | 预留；首版不启动 UART，避免持续耗电 |
| RESET / SW1 | P0.21 | `CONFIG_GPIO_AS_PINRESET=y`，不当普通按键读取 |
| 高频／低频时钟 | 32MHz / 32.768kHz | 外部晶振；LF预算暂设50ppm，需按实物晶振全温规格调整 |
| 内部DC/DC | DCC / DEC4外围 | 启用；上电前核对电感与去耦连接 |
| USB-C | 供电 | 无USB数据或USB烧录支持 |

电池百分比按3.3–4.2V线性估计，没有测得的电芯曲线。没有连接 CHRG 状态到 GPIO，不能判断是否正在充电。没有控制振动器。

## 构建

本工作区已创建独立 `.venv` 工具环境，避免改动系统 Python 依赖。首次配置：

```powershell
cd C:\Users\29088\Desktop\ENT\firmware
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

```powershell
python ..\scripts\generate_protocol.py --check
.\.venv\Scripts\python.exe tools/build.py
```

输出位于 `build/nrf52832/zephyr/zephyr.hex`，完整日志在 `build/nrf52832/build.log`。工程从 Flash 地址0启动，使用 Zephyr 蓝牙协议栈，不依赖 S132、Arduino bootloader 或 Nordic DFU。**不要把本工程应用镜像与 S132 同时烧在地址0。**

构建脚本使用固定版本的 PlatformIO 工具包，调用 Zephyr 标准 CMake / Ninja 流程，并从 SDK 自带的 `west.yml` 只加载 CMSIS、Nordic HAL、TinyCrypt 三项固定提交。缺少模块时从 Zephyr 官方 GitHub 下载对应提交归档，不修改第三方 SDK 的 manifest。首轮下载安装耗时较长；工具和模块就绪后为增量编译。脚本当前针对 Windows 工具包。

保留的 `platformio.ini` 供 IDE 和烧录工具配置参考。直接 `platformio run` 会尝试安装 SDK 中许多未使用的模块；本轮该完整安装路径因 GitHub 连接失败中断，成功验证的构建入口为 `tools/build.py`。

当前 `upload_protocol = jlink` 是开发工具默认值，用户尚未确认烧录器。实际是 CMSIS-DAP 时须按对应工具修改。确认硬件、电源、SWD和探针后，用探针配套工具烧录上述构建生成的完整 HEX。本轮不自动擦写设备。

## 核心逻辑测试

测试文件 `tests/test_core.c` 直接运行固件使用的 `radar_core.c`、`wire.c`，不是另一语言重写算法。支持标准 C11 编译器：

```sh
cc -std=c11 -Wall -Wextra -Werror -Iinclude src/radar_core.c src/wire.c tests/test_core.c -o core_tests
./core_tests
```

本轮 Windows 使用虚拟环境中的 Zig 编译 C：

```powershell
.\.venv\Lib\site-packages\ziglang\zig.exe cc -std=c11 -Wall -Wextra -Werror -Iinclude src/radar_core.c src/wire.c tests/test_core.c -o tests/core_tests.exe
.\tests\core_tests.exe
```

## 运行与持久化

1. 上电读取 NVS 配置与64条循环记录；不信任断电前的 Unix 时间，等待手机同步校时。
2. 前60秒提供首次绑定窗口，蓝灯短闪。GATT要求加密，采用Just Works绑定。窗口过后只接受已绑定身份连接；没有绑定时仍可扫描响应，但不接受新连接。
3. 手机按 v1 协议写配置，Flash成功后才确认版本；不写入姓名或联系方式。
4. 设备在意向有效期间自行广播、扫描、比较双方规则；记录成功保存后绿灯提示。
5. 日志分页读取不删除原始记录。Flash满时覆盖最老相遇；NVS负责页管理。
6. 意向到期停止匹配广播与扫描；仍保留原手机配置连接能力。断电重启后需要重新校时。

临时代号每15分钟轮换；相同代号10分钟去重。首版没有跨临时代号的长期身份关联，因此代号轮换后可能再次提醒同一真实人。

详情与实测清单见 `../docs/BLE协议_v1.md`、`../docs/联调与验收.md`。配置、记录与绑定保存在片内Flash；电池寿命、射频、实际延迟、掉电写入和真机权限均需要实测。
