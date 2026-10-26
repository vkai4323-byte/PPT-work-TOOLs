@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
set "PPT_INSTALL_RESULT=%ERRORLEVEL%"
pause
exit /b %PPT_INSTALL_RESULT%
