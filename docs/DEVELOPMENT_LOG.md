# Week 6 development record

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

Advisories: [Vitest mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8),
[Vitest Windows path bypass](https://github.com/advisories/GHSA-xp26-3454-mjgp),
[UUID buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Unverified and unimplemented scope

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
