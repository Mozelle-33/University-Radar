# Week 6 development record

This initial record describes the Week 6 implementation and its 27 October
recheck. Later one-board work is recorded separately in
[HARDWARE_BRINGUP.md](HARDWARE_BRINGUP.md); its results do not move the original
implementation evidence to a different course week.

## Provenance and dates

- Implementation session: **22 October 2026**, course **Semester 1 Week 6**.
- Source development conversation: **开发雷达软件多端支持**.
- Independent local recheck and preview preparation: **27 October 2026**.
- Scope: source implementation, host tests, build outputs and UI checks.
  This record is not participant-research evidence or proof of hardware operation.

## Implemented prototype

The web client has four core views, student/alumni mode, selectable matching tags,
same-school alumni gating, expiring discovery intent, local records and export.
Sharing is explicit; real-device records remain anonymous. The demo separately
labels invitations, simulated peer consent and withdrawal.

The BLE adapter implements version checks, 20-byte framing, configuration
acknowledgements, eight-record pagination, disconnect cancellation and merge
behaviour preserving local hide/block choices. Android and iOS project shells
are synchronised with the built web assets and BLE/FileSystem/Share plugins.

The bare-IC nRF52832 firmware implements local two-sided matching, sustained
presence gating, rotating tokens, short LED feedback, a 64-record Flash ring,
GATT transport encryption and an initial bonding window. Hardware reset, ADC and
LED definitions follow the supplied custom-board schematic rather than DK pinout.

## Recheck on 27 October

| Area | Executed check | Result |
| --- | --- | --- |
| App and BLE contracts | `npm test` | 18/18 passed, 3 files |
| Build and native sync | `npm run native:sync` | TypeScript, Vite and both project syncs passed |
| Shared constants | `python scripts/generate_protocol.py --check` | Passed |
| Firmware core | C11 compilation with `-Wall -Wextra -Werror`, then actual C assertions | Passed |
| ARM image | `firmware/tools/build.py` in the project tool environment | Full compile/link passed |
| Firmware artefacts | `python scripts/verify_artifacts.py` | 9,807 HEX records valid; BIN equal; image below NVS |
| Native files | Android manifest, iOS plist/privacy file and Xcode parser checks | Passed as metadata only |
| Dependency audit | `npm audit` after dependency repair | 0 known vulnerabilities |
| Browser | Default private fields, explicit demo invitation/acceptance, withdrawal and mobile search | Passed; fictional data only |

The image uses 156,732 bytes of Flash (31.36% of 488 KiB application space) and
36,510 bytes static SRAM (55.71% of 64 KiB). Those are build figures, not runtime
power measurements. The upper NVS region begins at `0x7a000` and is not overwritten
by the checked image.

## Changes made during release preparation

The audit identified development-tool advisories. Vitest was updated to the
patched 4.1.12 line, and the Xcode parser's indirect UUID dependency was pinned to
11.1.1 using an npm override. Unit tests, builds, native sync, Xcode project parsing
and UUID v4 generation were rechecked afterward. The lockfile records the versions.

The first Linux CI run also caught a signed/unsigned comparison warning in the
C test harness. Its frame-count comparison now uses `size_t` explicitly; the
assertion and production algorithm remain unchanged. The C checks were rerun
after this portability correction.

Advisories: [Vitest mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8),
[Vitest Windows path bypass](https://github.com/advisories/GHSA-xp26-3454-mjgp),
[UUID buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Unverified and unimplemented scope as of 27 October

- No real board was programmed or used for RF, NVS power-loss, LED, ADC or runtime testing.
- Android APK and iOS IPA builds/signing were not run in this Windows environment.
- No Android/iPhone permissions, background BLE or native share-panel test was performed.
- No measured one-week battery life, calibrated battery curve or validated radio range.
- No cloud accounts, school/alumni verification, real messaging/consent exchange or reporting backend.

Acceptance procedures remain in [联调与验收.md](联调与验收.md). Further human review
and hardware/phone acceptance are required before calling this a fully verified product.

## AI assistance

The project lead supplied product scope and custom-board references. Codex assisted
with source implementation, tests, review, dependency repair, build execution and
this evidence record. Automated check results are recorded separately from human
review and participant feedback; this document does not assert human sign-off.

## Hardware follow-up, 29 October / 1 November

ST-LINK/V2 is now the confirmed probe. A read-only OpenOCD helper was added for
chip geometry and local Flash/UICR/FICR backups; it has no programming, recovery
or erase entry point. The IDE probe reference was changed from J-Link to ST-LINK.

Firmware v0.1.1 puts the service UUID and name directly in the primary setup
advertisement when discovery is inactive. This addressed the observed missing
name/service in the Windows scan. The active matching packet and matching rules
were preserved. A compile-time guard keeps the setup packet within 31 bytes.

On 29 October the original non-empty firmware was backed up, and v0.1.1 was
programmed and read-back verified on one nRF52832-QFAA. Windows received its
advertised name and service UUID. On 1 November the SWD identity was read again,
but Windows pairing still failed. A later cold-start check was followed by a
failed SWD reconnection; power/contact checks remain pending. No GATT status,
configuration sync, two-board matching or phone test is claimed as passing.

Validation rerun on 1 November:

- `npm test`: 18/18 passed (Vitest 4.1.12).
- Actual C core assertions: C11 with `-Wall -Wextra -Werror`, all passed.
- `probe_stlink.py --check-config`, HLA configuration check, Python syntax: passed
  without claiming a USB/target connection from those checks.
- Shared dictionary check and full ARM build: passed.
- `scripts/verify_artifacts.py`: 9,810 HEX records valid, BIN equality and NVS
  boundary passed. Image: 156,780 bytes; static SRAM: 36,510 bytes.
- The artifact verifier now labels its scope explicitly as build/metadata only;
  physical results are kept in [HARDWARE_BRINGUP.md](HARDWARE_BRINGUP.md).

Raw logs, device addresses, unique IDs, pairing information and original firmware
backups remain local and ignored by Git. Source-only publication does not include
the course evidence directories or change their Week 6 attribution.

### CI dependency repair on 1 November

The first follow-up CI run passed tests/build/native sync but failed its existing
dependency audit. New advisories affected `glob` <=14.0.1 and `minimatch` <11.0.1
through Capacitor CLI's `rimraf` dependency. A targeted `glob` 14.0.3 override
selects the patched dependency chain while retaining Capacitor 8 and the existing
Xcode UUID override. The audit threshold was not relaxed.

`npm ci`, all 18 tests, `npm run native:sync` and
`npm audit --audit-level=moderate` were rerun locally and passed; audit reports
zero known vulnerabilities at this check. This dependency-only repair does not
change the firmware image or establish a physical BLE connection.

References: [glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).

### Additional physical-test limits on 1 November

The dependency repair passed the complete Linux CI. An isolated build of the
official Zephyr Device Information Service peripheral sample was prepared as a
GATT baseline after a phone scan result could not be obtained. SWD initialization
failed before programming that sample. A subsequent three-attempt 50 kHz
read-only check also failed. No baseline was written, no chip recovery/erase was
performed and no new pairing/GATT success is claimed. Stable wiring and actual
board-supply measurements are required before further device writes; see the
dated hardware record for the exact tested scope.

### Resumed after physical reset, 21:00 on 1 November

RST restored SWD access. The official DIS peripheral baseline was programmed,
connected on Windows and returned `Zephyr Model`; the project image was then
restored and read-back verified. After a temporary RAM-only commissioning
compatibility step on this already-enumerated computer, encrypted project GATT
commands passed: status, confirmed configuration writes, time sync, an empty
encounter page, and enabling/pausing discovery.

A normal reset restored project parameters and retained the binding/config.
The diagnostic client recovered one Database Out Of Sync response by reading
the GATT database hash before resubscribing. Later, the user manually granted
the Edge page access to UR-Radar; the actual web client connected and received
its configuration acknowledgement, clearing the time-sync warning.

These results apply to one board on this computer, with the documented setup
history. A pristine first-time pairing path on a new computer is not proven.
The device remains bound to this PC and discovery is paused; there are no real
two-board encounter records. Android/iPhone, long-duration power, battery
calibration and two-device acceptance remain pending. See HARDWARE_BRINGUP.md.

The Windows launcher now uses port 5174 to preserve the origin used for the
successful browser permission grant. No production firmware algorithm,
encryption setting or permanent identity-address policy changed in this resumed
test; temporary diagnostic parameters were removed by normal reset.

### Board 2 programmed on 5 November

After the user physically reconnected the ST-LINK in a different USB port,
the target was read as nRF52832-QFAA AAE1/E1, 512 KiB Flash and 64 KiB RAM.
Its FICR identity differs from board 1. Complete original Flash, UICR and FICR
backups passed length and SHA-256 checks and remain local and ignored.

The existing v0.1.1 image was programmed without source changes. OpenOCD
verification passed, and a full pre-boot read-back confirmed all 156,780
application bytes, erased page padding, unchanged data at/above 0x27000,
unchanged UICR and unchanged FICR. The target was reset to run. Requested SWD
speed was 1000 kHz; the probe selected 950 kHz. Earlier intermittent failures
remain a limitation, not evidence of long-term electrical stability.

The artifact verifier and shared protocol generator check passed again.
No new bonding, BLE/GATT acceptance, second-board configuration or two-board
encounter test was performed. No application or firmware source changed, so
the existing unit-test/build results were not relabelled as new executions.
See HARDWARE_BRINGUP.md for the dated scope; original course attribution is
unchanged.

### Stable maintenance serials added on 5 November

Firmware v0.1.2 derives a stable `UR-` plus 16-hex-digit serial from SHA-256
of a domain prefix and the chip's eight-byte hardware ID. Encrypted status
adds `serialNumber`; setup advertisements use an eight-character `UR` plus
six-digit suffix so flags, the service UUID and name still fit 31 bytes.
Active matching retains its rotating token and generic scan-response name.
The shared web/native BLE client validates the optional field, handles old
firmware explicitly and uses the live serial instead of an OS-cached name.
The device card and device dialog expose the full number.

`npm ci`, 26 client/domain/protocol tests, TypeScript/Vite build and native
resource sync passed. The actual C11 core assertions, full ARM build, protocol
dictionary check and artifact verification passed. Image size is 158,128 bytes,
static RAM is 36,542 bytes. After another full backup, board 2 was upgraded and
read-back verified; UICR and data beyond the programmed pages were unchanged
before boot. Runtime serial/name bytes matched an independent Python SHA-256
derivation before and after reset, without storage/radio fault flags; a Windows
scan found the expected numbered setup advertisement. Board 1 remains on v0.1.1.

Computer Use stopped UI verification because it could not establish the current
browser URL; no further UI automation was performed. Encrypted serial-status
receipt, actual connected UI display, phone runs and two-board matching remain
unverified. Raw identifiers, backups and the local inventory stay out of Git.

### Board 1 upgraded with retained storage on 5 November

The user reconnected board 1. Its AAE0/E0 geometry and FICR identity matched
the original backup. A fresh full Flash/UICR/FICR backup passed size/hash checks
before the existing v0.1.2 image was programmed. Application read-back and
OpenOCD verification passed; bytes at/above 0x27000, including NVS, plus UICR
and FICR remained unchanged before first boot.

Runtime serial/name values matched the independent derivation before and after
reset; storage/radio fault flags were false. Windows scanning found the numbered
setup advertisement. Using the existing PC bond with `pair=False`, encrypted
status returned the correct v0.1.2 serial and revision 1; the first encounter
page was empty. No new binding or configuration write was requested. The clock
remains unsynchronised after reset, as designed, and discovery was not enabled.

Both boards now run v0.1.2. The artifact and shared dictionary checks passed
again; no firmware or web source changed in this follow-up. Board 2 encrypted
serial receipt, actual web display, phone and dual-board matching acceptance
remain pending. The local inventory was updated without publishing device IDs,
backups or raw logs.

### Connection state cleanup on 5 November

The shared web and native UI now clears the previous device's last-sync time
and pagination indicator when a connection closes or a different connection
starts. After asynchronous connect and status operations, it confirms that the
same transport connection still exists before showing a connected device;
this prevents a late response from restoring a stale connected display.

The 26 existing client, domain and protocol tests passed. The TypeScript/Vite
production build, Capacitor Android/iOS resource sync, dependency audit and
shared protocol check passed. This is a UI state fix: no firmware was changed
or reflashed. Real disconnect timing, switching two boards and mobile device
acceptance remain to be exercised on hardware.

The same connection check also runs after configuration acknowledgement and
after each encounter-page response, before updating confirmation, storage or
pagination state. This closes the case where the disconnect callback runs just
before a pending response resumes. The existing tests and native sync passed
again after this adjustment.

### MuMu Android debug build on 5 November

The locally installed MuMu instance ran Android 15 / API 35 and connected over
ADB. A local JDK 21 and Android SDK 36 toolchain was prepared under the ignored
build directory; Android SDK licenses were accepted locally, including eight SDK
license categories, some unrelated to this build. Gradle 8.14.3 built the debug
APK successfully. Android's package manager accepted it and the app launched.

The four demo navigation screens and the device dialog were inspected in MuMu,
with a portrait layout check. Android's UI hierarchy dump exited with code 139
on one attempt while the app remained running; screenshot-based inspection was
used for the subsequent navigation checks. Bluetooth permission was granted in
the emulator for this test. MuMu exposed `android.hardware.bluetooth` but not
`android.hardware.bluetooth_le`, and plugin initialization returned `BLE is not
supported`. The client now translates that specific native error into an
actionable Chinese message while preserving other errors. The rebuilt APK was
reinstalled and that message was verified on the emulator.

At startup, the Capacitor SystemBars plugin logged two `Error injecting safe area
CSS` messages because `document.documentElement` was null when it tried to set
styles. The screens appeared usable in the inspected emulator layouts, but those
logs are not a passing safe-area test; startup and display-cutout/keyboard insets
need further investigation on real Android devices. Chromium also emitted MuMu
EGL shared-image diagnostics during rendering. These observations are recorded
separately from fatal app crashes rather than reported as a clean console.

All 28 existing/new web and BLE adapter tests, the Vite build, Android/iOS
Capacitor sync and Android `:app:assembleDebug` passed. The APK is debug-signed;
neither an Android phone, a release build nor a BLE connection was tested. One
board remains bound to the PC; changing its binding is separate from installing
the APK. Build and emulator screenshots remain local.

### Two-board automatic trigger diagnostic on 5 November

With one ST-LINK and independent power, the two identified nRF52832 boards were
backed up and loaded in turn with an isolated diagnostic build based on v0.1.2.
It starts matching automatically with a synthetic clock and test-only token
prefix, accepts only marked peers, keeps test encounters in RAM and holds the
green output on for two seconds. It does not persist the synthetic configuration
or test encounter records into the production store.

Board 2 reported 11 received, 11 matched and one saved RAM test event; board 1
reported 41 received, 41 matched and four saved RAM test events. Different runs
and restarts account for the differing counts; these are not reception rates.
The user observed both green LEDs illuminate twice on a repeated trigger. A
non-halting 50 ms GPIO-output sample on board 2 detected 42 low samples during
a restart trigger. Both boards were restored to v0.1.2, fully read-back verified,
with UICR/FICR and Flash beyond the programmed pages unchanged before boot.
Board 1's pre-existing PC bond and encrypted status worked after restoration.

This confirms two-way close-range matching and trigger behaviour in the temporary
diagnostic build. It does not verify production firmware's real-clock setup,
Flash persistence, range, power consumption, endurance or mobile apps. The
diagnostic image and raw identifiers/backups remain in the ignored build tree.

### Chinese / English interface on 5 November

The shared React interface now offers a Chinese/English control on onboarding
and in the main header. Application copy, navigation, device/error messages,
privacy controls, tag and university labels, known encounter context and intent
labels use a shared translation dictionary. Language is saved separately from
the profile and device configuration; switching language does not alter matching
IDs or stored profile values. The HTML language and title follow the selection.
The iOS Bluetooth purpose text contains both languages; iOS system permission
language is controlled by the operating system rather than the in-app toggle.

`npm ci`, 31 tests, TypeScript/Vite build, Capacitor Android/iOS sync, audit and
protocol/artifact checks passed. The translation coverage test checks static
copy, BLE/storage messages and shared labels. An isolated browser session
checked onboarding, all four desktop sections, privacy, tags, mobile layout,
language persistence and unchanged local profile data. The updated Android debug
APK was built, installed in the existing MuMu Android 15 instance, switched from
Chinese to English and back, and retained the previously selected language after
an update. The emulator does not expose BLE. iOS installation, physical phone
BLE and screen-reader/device-specific layout remain unverified.
The dictionary lookup only uses its own keys; tests cover custom values such as
`toString` and `__proto__` so user-entered text is not mistaken for a translation.
The translation lookup and dialog focus handling also avoid newer JavaScript
built-ins unavailable on some early iOS 15 WebViews; actual iOS testing is still
required. Dialog and page heights include `vh` fallbacks for WebViews without
dynamic viewport units. Vite's production target includes iOS/Safari 15, so
CSS minification retains the tested fallbacks rather than dropping them for
the newer default browser baseline. See [Safari 15.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-15_4-release-notes)
and [Vite build targets](https://vite.dev/config/build-options.html#build-target).
