@echo off
chcp 65001 > nul
echo 🏥 МЕДИЦИНСКИЙ AI АССИСТЕНТ - БЫСТРЫЙ ЗАПУСК
echo.

echo [1/3] Проверка серверов...
tasklist | findstr "ollama.exe" > nul || start "Ollama" /B cmd /c "ollama serve"
tasklist | findstr "python.exe" > nul || start "AI Server" /B cmd /c "cd /d %~dp0 && python smart_ai_api.py"

echo [2/3] Запуск интерфейса...
timeout /t 3
start "" "index.html"

echo [3/3] Готово!
echo ✅ Система запущена
echo 💡 Серверы работают в фоне
echo 🚀 Можете использовать AI-ассистент
pause