@echo off
chcp 65001 > nul
echo 🏥 МЕДИЦИНСКИЙ AI АССИСТЕНТ - ПЕРВЫЙ ЗАПУСК
echo.

echo [1/6] Проверка и установка компонентов...
python --version > nul 2>&1 || (echo ❌ Установите Python 3.8+ && pause && exit)
ollama --version > nul 2>&1 || (echo ❌ Установите Ollama && pause && exit)

echo [2/6] Установка AI моделей...
ollama pull mistral:7b
ollama pull nomic-embed-text

echo [3/6] Установка зависимостей...
pip install flask flask-cors torch requests

echo [4/6] Запуск Ollama сервера...
start "Ollama" /B cmd /c "ollama serve"
echo ⏳ Ожидаем 10 секунд для запуска Ollama...
timeout /t 10 /nobreak > nul

echo [5/6] Запуск AI сервера...
start "AI Server" /B cmd /c "cd /d %~dp0 && python smart_ai_api.py"  
timeout /t 5 /nobreak > nul

echo [6/6] Запуск интерфейса...
start "" "index.html"

echo.
echo ✅ Установка завершена!
echo 🤖 Используется модель: mistral:7b
echo 💡 Для следующих запусков используйте: start_system.bat
echo.
pause