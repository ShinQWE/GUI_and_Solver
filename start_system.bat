@echo off
chcp 65001 > nul
title 🏥 Medical Assistant - ЗАПУСК
echo 🏥 МЕДИЦИНСКИЙ AI АССИСТЕНТ - БЫСТРЫЙ ЗАПУСК
echo ========================================
echo.

echo [1/3] 🤖 Проверка Ollama...
tasklist | findstr "ollama.exe" > nul || (
    echo 🚀 Запуск Ollama сервера...
    start "Ollama" /B cmd /c "ollama serve"
    echo ⏳ Ожидаем 5 секунд...
    timeout /t 5 /nobreak > nul
)
echo ✅ Ollama запущен

echo [2/3] 🚀 Запуск AI сервера...

:: ИСПРАВЛЕНО: ПЕРЕХОДИМ В ПАПКУ medical_assistant
cd /d "%~dp0medical_assistant"
echo 📁 Текущая папка: %CD%

:: Проверяем, не запущен ли уже сервер на порту 5001
netstat -ano | findstr :5001 > nul
if %errorlevel% equ 0 (
    echo ⚠️ Сервер уже запущен на порту 5001
) else (
    echo 🐍 Запуск AI сервера...
    echo ✅ Команда: python server.py
    
    :: ИСПРАВЛЕНО: ЗАПУСКАЕМ server.py ИЗ ТЕКУЩЕЙ ПАПКИ
    start "AI Server" /B cmd /c "python server.py"
    
    echo ⏳ Ожидаем 5 секунд для запуска сервера...
    timeout /t 5 /nobreak > nul
)

cd /d "%~dp0"
echo ✅ AI сервер готов

echo [3/3] 🌐 Запуск интерфейса...
start "" "index.html"

echo.
echo ========================================
echo ✅ СИСТЕМА ЗАПУЩЕНА!
echo ========================================
echo 🤖 AI модель: mistral:7b
echo 🌐 AI API: http://localhost:5001/api/health
echo 📁 Интерфейс: index.html
echo.
echo 📌 ВАЖНО: 
echo   ✅ Сервер запущен из папки: %~dp0medical_assistant
echo   ✅ Это окно можно свернуть, но НЕ ЗАКРЫВАТЬ!
echo   ✅ Сервер работает, пока открыто это окно
echo.
pause