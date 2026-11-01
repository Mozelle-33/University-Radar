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
