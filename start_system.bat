@echo off
chcp 65001 > nul
echo 🏥 МЕДИЦИНСКИЙ AI АССИСТЕНТ - БЫСТРЫЙ ЗАПУСК
echo.

echo [1/4] Проверка и запуск Ollama...
tasklist | findstr "ollama.exe" > nul || (
    echo 🚀 Запуск Ollama сервера...
    start "Ollama" /B cmd /c "ollama serve"
    echo ⏳ Ожидаем 8 секунд для запуска...
    timeout /t 8 /nobreak > nul
)

echo [2/4] Проверка модели mistral:7b...
ollama list | findstr "mistral:7b" > nul || (
    echo ❌ Модель mistral:7b не найдена!
    echo 📥 Устанавливаем модель...
    ollama pull mistral:7b
)

echo [3/4] Запуск AI сервера...
tasklist | findstr "python.exe" > nul || (
    echo 🐍 Запуск AI сервера...
    start "AI Server" /B cmd /c "cd /d %~dp0 && python smart_ai_api.py"
    timeout /t 3 /nobreak > nul
)

echo [4/4] Запуск интерфейса...
start "" "index.html"

echo.
echo ✅ Система запущена!
echo 🤖 Модель: mistral:7b
echo 💡 Серверы работают в фоне
echo 🚀 Можете использовать AI-ассистент
echo.
pause