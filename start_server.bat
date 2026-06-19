@echo off
chcp 65001 >nul
title 陶艺AI知识库服务器
echo ╔══════════════════════════════════════╗
echo ║   陶艺AI知识库服务器启动脚本         ║
echo ╚══════════════════════════════════════╝
echo.
cd /d "%~dp0"

:loop
echo [%date% %time%] 正在启动服务器...
node server.js
echo [%date% %time%] 服务器意外退出，3秒后自动重启...
timeout /t 3 /nobreak >nul
goto loop
