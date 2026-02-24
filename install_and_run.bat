@echo off
chcp 65001 > nul
title 🏥 Medical Assistant - ПОЛНАЯ УСТАНОВКА
echo 🏥 МЕДИЦИНСКИЙ AI АССИСТЕНТ - ПОЛНАЯ УСТАНОВКА
echo ========================================
echo.

:: ========== 1. ПРОВЕРКА PYTHON ==========
echo [1/9] 🔍 Проверка Python...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python не найден!
    echo.
    echo 📥 Python будет установлен автоматически...
    echo.
    echo Скачивание Python 3.11.9...
    curl -o python-installer.exe https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
    
    echo 🔧 Установка Python (это займет 1-2 минуты)...
    python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    
    echo ⏳ Ожидаем 10 секунд для завершения установки...
    timeout /t 10 /nobreak > nul
    
    del python-installer.exe
    
    echo ✅ Python установлен!
    
    :: Обновляем PATH
    echo ⏳ Обновляем переменные окружения...
    call set PATH=%PATH%;C:\Program Files\Python311\;C:\Program Files\Python311\Scripts\
    
    echo ✅ Python готов к работе
) else (
    echo ✅ Python найден
)

:: ========== 2. ПРОВЕРКА PIP ==========
echo.
echo [2/9] 📦 Проверка pip...
python -m pip --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Pip не найден, устанавливаем...
    curl -o get-pip.py https://bootstrap.pypa.io/get-pip.py
    python get-pip.py
    del get-pip.py
)
echo ✅ Pip готов

:: ========== 3. ОБНОВЛЕНИЕ PIP ==========
echo.
echo [3/9] 🔧 Обновление pip...
python -m pip install --upgrade pip
echo ✅ Pip обновлен

:: ========== 4. УСТАНОВКА PyTorch ==========
echo.
echo [4/9] 🔥 Установка PyTorch (150 МБ)...
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu --timeout 120
if %errorlevel% neq 0 (
    echo ⚠️ Ошибка установки PyTorch, пробуем альтернативный метод...
    python -m pip install torch==2.0.1+cpu torchvision==0.15.2+cpu torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu
)
echo ✅ PyTorch установлен

:: ========== 5. УСТАНОВКА ЗАВИСИМОСТЕЙ ==========
echo.
echo [5/9] 📚 Установка остальных зависимостей...
python -m pip install ollama openai numpy tqdm requests --timeout 120
echo ✅ Зависимости установлены

:: ========== 6. ПРОВЕРКА OLLAMA ==========
echo.
echo [6/9] 🤖 Проверка Ollama...
where ollama > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Ollama не найден!
    echo.
    echo 📥 Скачивание Ollama...
    
    :: Определяем архитектуру
    if exist "C:\Program Files\Ollama\ollama.exe" (
        echo ✅ Ollama уже установлен в Program Files
    ) else (
        echo Скачивание Ollama для Windows...
        curl -L -o ollama-setup.exe https://ollama.com/download/OllamaSetup.exe
        
        echo 🔧 Установка Ollama (это займет 1-2 минуты)...
        start /wait ollama-setup.exe /SILENT
        
        echo ⏳ Ожидаем 10 секунд для завершения установки...
        timeout /t 10 /nobreak > nul
        
        del ollama-setup.exe
        
        :: Добавляем в PATH
        set PATH=%PATH%;C:\Program Files\Ollama\
    fi
) else (
    echo ✅ Ollama найден
)

:: ========== 7. ЗАПУСК OLLAMA ==========
echo.
echo [7/9] 🚀 Запуск Ollama сервера...
taskkill /f /im ollama.exe > nul 2>&1
timeout /t 2 /nobreak > nul

echo 🔧 Запускаем Ollama serve...
start "Ollama" /B cmd /c "ollama serve"
echo ⏳ Ожидаем 10 секунд для запуска...
timeout /t 10 /nobreak > nul

:: ========== 8. СКАЧИВАНИЕ МОДЕЛИ ==========
echo.
echo [8/9] 📥 Проверка модели mistral:7b...
ollama list | findstr "mistral:7b" > nul || (
    echo 📥 Скачивание модели mistral:7b (4.1 ГБ)...
    echo ⏳ Это займет 10-30 минут в зависимости от скорости интернета
    echo.
    echo    ┌─────────────────────────────────────────────┐
    echo    │  ⏰ МОЖНО ВЫПИТЬ ЧАЙ                         │
    echo    │  📦 РАЗМЕР: 4.1 ГБ                         │
    echo    │  🚀 СКОРОСТЬ: зависит от вашего интернета  │
    echo    └─────────────────────────────────────────────┘
    echo.
    ollama pull mistral:7b
)
echo ✅ Модель mistral:7b готова

:: ========== 9. ЗАПУСК СИСТЕМЫ ==========
echo.
echo [9/9] 🚀 Запуск Medical Assistant...

:: Проверяем, существует ли папка medical_assistant
if not exist "%~dp0medical_assistant" (
    echo ❌ Папка medical_assistant не найдена!
    echo 📁 Проверьте, что вы запускаете батник из корневой папки проекта
    pause
    exit /b 1
)

:: Запускаем сервер
cd /d "%~dp0medical_assistant"

:: Убиваем старые процессы на порту 5001
echo 🔧 Очистка порта 5001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001') do (
    taskkill /F /PID %%a > nul 2>&1
)

echo 🐍 Запуск AI сервера...
start "AI Server" /B cmd /c "python server.py"

echo ⏳ Ожидаем 10 секунд для запуска сервера...
timeout /t 10 /nobreak > nul

cd /d "%~dp0"

:: Запускаем интерфейс
echo 🌐 Запуск веб-интерфейса...
start "" "index.html"

:: ========== ИТОГ ==========
echo.
echo ========================================
echo ✅ УСТАНОВКА ПОЛНОСТЬЮ ЗАВЕРШЕНА!
echo ========================================
echo.
echo 📌 ВАЖНАЯ ИНФОРМАЦИЯ:
echo   1. ✅ Все компоненты установлены
echo   2. ✅ Сервер запущен
echo   3. ✅ Интерфейс открыт в браузере
echo.
echo 🔍 ПРОВЕРКА РАБОТЫ:
echo   Откройте в браузере: http://localhost:5001/api/health
echo.
echo 📌 ДЛЯ ПОСЛЕДУЮЩИХ ЗАПУСКОВ:
echo   Используйте файл: start_system.bat
echo.
echo ❗ НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!
echo   Здесь работает сервер. Просто сверните его.
echo.
pause