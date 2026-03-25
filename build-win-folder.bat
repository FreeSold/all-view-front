@echo off
REM 打包为「文件夹版」：跳过 portable 单文件压缩，避免部分环境卡死（CPU 长期为 0）
cd /d "%~dp0"
call npm.cmd run build:win-dir
if errorlevel 1 exit /b 1
echo.
echo 运行程序：release\win-unpacked\All Play.exe
echo （请保留 win-unpacked 下整份文件夹，不要只拷贝 exe）
pause
