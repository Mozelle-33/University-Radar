@echo off
setlocal
pushd "%~dp0software"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or newer is required.
  pause
  popd
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    popd
    exit /b 1
  )
)
echo Open http://127.0.0.1:5174 in your browser.
echo Press Ctrl+C to stop the server.
call npm run dev -- --port 5174
popd
endlocal
