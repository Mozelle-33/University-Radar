"""Reproducible nRF52832 build using pinned PlatformIO tools and three Zephyr modules.

The PlatformIO SDK's full manifest includes many unrelated optional stacks. This
entry point invokes Zephyr's supported CMake workflow with explicit ZEPHYR_MODULES.
It does not alter the vendor SDK or its west.yml.
"""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import zipfile

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = Path(os.environ.get('PLATFORMIO_CORE_DIR', Path.home() / '.platformio')) / 'packages'
BUILD = ROOT / 'build' / 'nrf52832'


def tool(name, version, executable):
    location = PACKAGES / name
    if not (location / executable).is_file():
        subprocess.run([sys.executable, '-m', 'platformio', 'pkg', 'install', '--global', '--tool', f'platformio/{name}@{version}'], check=True)
    if not (location / executable).is_file():
        raise RuntimeError(f'Missing tool: {location / executable}')
    return location


def module(sdk, manifest, name):
    entry = next(p for p in manifest['projects'] if p['name'] == name)
    destination = sdk / '_pio' / entry['path']
    # A failed git clone can leave an empty directory; never accept that as a module.
    if (destination / 'zephyr/module.yml').is_file() or (destination / 'zephyr/CMakeLists.txt').is_file():
        return destination
    remote = entry.get('remote', manifest['defaults']['remote'])
    base = next(r['url-base'] for r in manifest['remotes'] if r['name'] == remote)
    repository = entry.get('repo-path', name)
    if base != 'https://github.com/zephyrproject-rtos':
        raise RuntimeError(f'Unexpected SDK module source: {base}')
    url = f'https://codeload.github.com/zephyrproject-rtos/{repository}/zip/{entry["revision"]}'
    print(f'Downloading pinned {name}: {entry["revision"]}', flush=True)
    response = requests.get(url, timeout=(15, 90))
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        destination.mkdir(parents=True, exist_ok=True)
        resolved = destination.resolve()
        for member in archive.infolist():
            parts = PurePosixPath(member.filename).parts[1:]
            if not parts:
                continue
            target = destination.joinpath(*parts)
            if not target.resolve().is_relative_to(resolved):
                raise RuntimeError('Unsafe path in SDK archive')
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(member))
    (destination / '.radar-source.json').write_text(json.dumps({'url': url, 'commit': entry['revision'], 'sha256': hashlib.sha256(response.content).hexdigest()}, indent=2), encoding='utf-8')
    if not (destination / 'zephyr/module.yml').is_file() and not (destination / 'zephyr/CMakeLists.txt').is_file():
        raise RuntimeError(f'Invalid Zephyr module: {destination}')
    return destination


def run(command, env, log):
    process = subprocess.Popen([str(x) for x in command], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    for line in process.stdout:
        print(line, end='', flush=True)
        log.write(line)
    if process.wait():
        raise SystemExit(process.returncode)


def main():
    sdk = tool('framework-zephyr', '2.20701.220422', 'west.yml')
    compiler = tool('toolchain-gccarmnoneeabi', '1.80201.181220', 'bin/arm-none-eabi-gcc.exe')
    cmake = tool('tool-cmake', '3.21.3', 'bin/cmake.exe') / 'bin/cmake.exe'
    ninja = tool('tool-ninja', '1.9.0', 'ninja.exe') / 'ninja.exe'
    dtc = tool('tool-dtc', '1.4.7', 'dtc.exe') / 'dtc.exe'
    manifest = yaml.safe_load((sdk / 'west.yml').read_text())['manifest']
    modules = [module(sdk, manifest, name) for name in ['cmsis', 'hal_nordic', 'tinycrypt']]
    BUILD.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update(ZEPHYR_BASE=str(sdk), ZEPHYR_TOOLCHAIN_VARIANT='gnuarmemb', GNUARMEMB_TOOLCHAIN_PATH=str(compiler))
    env['PATH'] = str(dtc.parent) + os.pathsep + str(ninja.parent) + os.pathsep + env['PATH']
    with (BUILD / 'build.log').open('w', encoding='utf-8') as log:
        run([cmake, '-GNinja', '-S', ROOT / 'zephyr', '-B', BUILD,
             '-DBOARD=nrf52dk_nrf52832', f'-DPYTHON_EXECUTABLE={sys.executable}', f'-DPython3_EXECUTABLE={sys.executable}',
             f'-DCMAKE_MAKE_PROGRAM={ninja.as_posix()}', f'-DDTC={dtc.as_posix()}',
             '-DZEPHYR_MODULES=' + ';'.join(p.as_posix() for p in modules)], env, log)
        run([ninja, '-C', BUILD, '-j', '4'], env, log)
    print(f'HEX: {BUILD / "zephyr/zephyr.hex"}')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
