@echo off
chcp 65001 > nul
echo 🏥 МЕДИЦИНСКИЙ AI АССИСТЕНТ - ПЕРВЫЙ ЗАПУСК
echo.

echo [1/6] Проверка и установка компонентов...
python --version > nul 2>&1 || (echo ❌ Установите Python 3.8+ && pause && exit)
ollama --version > nul 2>&1 || (echo ❌ Установите Ollama && pause && exit)

echo [2/6] Установка AI моделей...
ollama pull llama3.2:1b
ollama pull nomic-embed-text

echo [3/6] Установка зависимостей...
pip install flask flask-cors

echo [4/6] Запуск системы...
start "Ollama" /B cmd /c "ollama serve"
timeout /t 5
start "AI Server" /B cmd /c "cd /d %~dp0 && python smart_ai_api.py"  
timeout /t 3
start "" "index.html"

echo ✅ Установка завершена! Используйте start_system.bat для след. запусков
pause