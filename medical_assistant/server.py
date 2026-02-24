#!/usr/bin/env python3
"""
ИСПРАВЛЕННЫЙ API сервер для медицинского ассистента
С RAG и базой знаний из параграфов
"""
import http.server
import socketserver
import json
import subprocess
import os
import time
import sys
import glob
from urllib.parse import urlparse, parse_qs

PORT = 5001

# Добавляем путь к core.py
sys.path.insert(0, os.path.dirname(__file__))
from core import MedicalAssistant

class MedicalAPIHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {self.address_string()} - {format % args}")
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/health':
            self.handle_health_check()
        elif parsed_path.path == '/api/models':
            self.handle_models_list()
        else:
            self.send_error(404, "Endpoint not found")
    
    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/get_recommendations':
            self.handle_recommendations()
        else:
            self.send_error(404, "Endpoint not found")
    
    def handle_health_check(self):
        """Проверка здоровья сервера"""
        try:
            # Проверяем Ollama
            result = subprocess.run(
                ['ollama', 'list'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Проверяем наличие параграфов лечения
            data_dir = os.path.join(os.path.dirname(__file__), "data")
            paragraphs_count = 0
            if os.path.exists(data_dir):
                txt_files = glob.glob(os.path.join(data_dir, "*.txt"))
                for txt_file in txt_files:
                    with open(txt_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        paragraphs_count += content.count('\n1.') + content.count('\n2.') + content.count('\n3.')
            
            response = {
                "status": "healthy",
                "ollama": "running" if result.returncode == 0 else "error",
                "rag_ready": paragraphs_count > 0,
                "paragraphs_loaded": paragraphs_count,
                "port": PORT
            }
            
            self.send_json_response(200, response)
            
        except Exception as e:
            self.send_json_response(503, {"status": "degraded", "error": str(e)})
    
    def handle_models_list(self):
        """Список доступных моделей"""
        try:
            result = subprocess.run(
                ['ollama', 'list'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            models = []
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines[1:]:
                    if line:
                        parts = line.split()
                        if len(parts) >= 2:
                            models.append(parts[0])
            
            self.send_json_response(200, {"models": models})
            
        except Exception as e:
            self.send_json_response(500, {"error": str(e)})
    
    def handle_recommendations(self):
        """ГЛАВНОЕ: Получение рекомендаций через RAG"""
        print(f"\n📨 POST /api/get_recommendations")
        
        try:
            # 1. Читаем данные запроса
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            diagnosis = request_data.get('diagnosis', '').strip()
            patient_data = request_data.get('patient_data', {})
            model = request_data.get('model', 'mistral:7b')
            
            if not diagnosis:
                self.send_json_response(400, {"error": "Diagnosis is required"})
                return
            
            print(f"🤖 Диагноз: {diagnosis}")
            print(f"📊 Данных пациента: {len(patient_data)} полей")
            
            # 2. СОЗДАЕМ АССИСТЕНТА С RAG
            print("🔄 Инициализация MedicalAssistant с RAG...")
            assistant = MedicalAssistant(model=model)
            
            # 3. ЗАГРУЖАЕМ ДАННЫЕ ПАЦИЕНТА
            assistant.patient_data = patient_data
            
            # 4. ЗАГРУЖАЕМ ВСЕ ПАРАГРАФЫ ЛЕЧЕНИЯ
            print("📚 Загрузка параграфов лечения...")
            assistant.vault_content = assistant.load_all_treatment_content()
            print(f"✅ Загружено {len(assistant.vault_content)} параграфов")
            
            # 5. ГЕНЕРИРУЕМ ЭМБЕДДИНГИ
            if assistant.vault_content:
                print("🔧 Генерация эмбеддингов...")
                assistant.vault_embeddings_tensor = assistant.generate_embeddings(
                    assistant.vault_content
                )
                print(f"✅ Эмбеддинги готовы")
            
            # 6. ПОЛУЧАЕМ РЕКОМЕНДАЦИЮ ЧЕРЕЗ RAG
            print("🧠 Запрос к модели с RAG...")
            start_time = time.time()
            
            recommendation = assistant.get_treatment_recommendation()
            
            processing_time = time.time() - start_time
            
            # 7. ОТПРАВЛЯЕМ ОТВЕТ
            response = {
                "success": True,
                "diagnosis": diagnosis,
                "recommendation": recommendation,
                "processing_time": round(processing_time, 2),
                "model": model,
                "rag_used": len(assistant.vault_content) > 0,
                "paragraphs_used": len(assistant.vault_content)
            }
            
            print(f"✅ Ответ получен за {processing_time:.1f}с, {len(recommendation)} символов")
            self.send_json_response(200, response)
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
            
            # Возвращаем понятную ошибку
            self.send_json_response(500, {
                "error": str(e),
                "success": False
            })
    
    def send_json_response(self, status_code, data):
        """Отправка JSON ответа"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_cors_headers()
        self.end_headers()
        
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        self.wfile.write(json_str.encode('utf-8'))


def run_server():
    """Запуск сервера"""
    print(f"""
    {'='*60}
    🚀 МЕДИЦИНСКИЙ AI СЕРВЕР С RAG
    {'='*60}
    📍 Порт: {PORT}
    🤖 Модель: mistral:7b
    📚 Режим: RAG (поиск по параграфам)
    {'='*60}
    """)
    
    try:
        with socketserver.TCPServer(("127.0.0.1", PORT), MedicalAPIHandler) as httpd:
            httpd.allow_reuse_address = True
            print(f"✅ Сервер запущен на порту {PORT}")
            print(f"⏳ Ожидание запросов...\n")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n⏹️ Сервер остановлен")
    except Exception as e:
        print(f"❌ Ошибка: {e}")


if __name__ == "__main__":
    run_server()