# ST-LINK/V2 与 nRF52832 联调

2026-10-29 用户提供了 ST-LINK/V2 和自制 nRF52832 板的连接照片。本说明针对该探针，不使用只支持 J-Link 的 `nrfjprog` 路线。

## 接线与 Windows 驱动

- ST-LINK `SWDIO` 接板上 `DIO`，`SWCLK` 接 `CLK`，`GND` 接 `GND`。
- 照片所示外壳标注：2脚为SWDIO，6脚为SWCLK，3/4脚为GND，7/8脚为3.3V；以实物引脚和后续读数为准，不能仅凭线色判断。
- nRF52832 I/O 不接5V。电源接法应与板上USB／电池供电方案核对，不把探针3.3V输出默认当作所有探针都通用的电压参考输入。
- USB识别到 `VID_0483 / PID_3748` 只证明电脑看到了探针，不证明SWD连接正确。Windows问题代码28表示缺少驱动。
- 本轮使用 ST 官方 STSW-LINK009 包。驱动INF匹配上述VID/PID；版本为2021-04-01、2.02。安装程序的Microsoft签名和驱动catalog的STMicroelectronics签名均验证有效。
- 官方readme要求管理员安装。Windows权限弹窗需由用户确认；不关闭驱动签名验证，不自动升级探针固件。

[ST官方驱动页面](https://www.st.com/en/development-tools/stsw-link009.html)
· [OpenOCD Windows驱动说明](https://github.com/openocd-org/openocd/blob/master/README.Windows.md)

## 安装 OpenOCD

在项目的固件Python环境中：

```powershell
cd firmware
.\.venv\Scripts\python.exe -m platformio pkg install --global --tool "platformio/tool-openocd@3.1200.7"
```

本轮工具为xPack OpenOCD `0.12.0+dev-02228-ge5888bda3`。辅助脚本也接受 `--openocd`、`--scripts`，或 `OPENOCD` 环境变量。nRF52配置同时兼容新目录 `target/nordic/nrf52.cfg` 和旧目录 `target/nrf52.cfg`。

## 默认只读检查

```powershell
.\.venv\Scripts\python.exe tools/probe_stlink.py --check-config
.\.venv\Scripts\python.exe tools/probe_stlink.py
```

第一条只解析配置，**不初始化USB或芯片**。第二条通过100kHz SWD读取FICR中的型号、芯片变体、封装和RAM/Flash容量，并读取Flash几何信息；不执行编程、擦除或解锁。

现代ST-LINK默认使用原生DAP的 `swd` transport。如果工具明确报告探针固件过老、不支持DAP，可尝试：

```powershell
.\.venv\Scripts\python.exe tools/probe_stlink.py --hla
```

HLA不能通过CTRL-AP恢复锁定的nRF52。脚本不会自动升级ST-LINK固件，也不会调用 `nrf52_recover` 或其他整片擦除命令。

## 写入前保存备份

```powershell
.\.venv\Scripts\python.exe tools/probe_stlink.py --backup
```

只有读取到 nRF52832、64KiB RAM、512KiB Flash 才按本项目几何布局备份。备份操作会临时暂停CPU，保存512KiB Flash、4KiB UICR和4KiB FICR后恢复运行。结果带文件长度及SHA-256；只有全部读取完成才标记 `backup_complete=true`。遇到连接中断或外部终止时，应确认CPU已恢复，必要时重新上电。

原始日志、芯片信息和备份保存在已被Git忽略的 `firmware/build/hardware/<时间戳>/`。备份可能包含原固件、设备ID及绑定信息，不能上传到公开仓库；公开开发记录仅写脱敏后的测试范围与结果。

若芯片有APPROTECT读保护，停止并记录状态。解除保护通常涉及不可恢复的擦除，应另行取得明确授权；不能把“连接硬件”当作同意销毁原固件或绑定数据。

本辅助工具没有烧录入口。真正写入之前仍需核对电路、目标型号、已有备份及镜像。当前项目镜像从地址0开始，含Zephyr蓝牙栈，与S132/其他bootloader不能在地址0混烧。
