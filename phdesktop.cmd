@echo off
setlocal
cd /d "%~dp0"

call pnpm --filter "@productivityhub/desktop..." build
if errorlevel 1 (
    echo Build failed, not launching.
    exit /b %errorlevel%
)

call "%~dp0apps\desktop\node_modules\.bin\electron.cmd" "%~dp0apps\desktop" %*
