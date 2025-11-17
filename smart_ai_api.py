# smart_ai_api.py - ТОЛЬКО AI РЕЖИМ
import sys
import os
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

class SmartAIHandler(BaseHTTPRequestHandler):
    
    def __init__(self, *args, **kwargs):
        self.available_models = self.detect_available_models()
        super().__init__(*args, **kwargs)
    
    def detect_available_models(self):
        """Автоматически определяет доступные модели Ollama"""
        print("🔍 Поиск доступных моделей...")
        available_models = []
        
        try:
            result = subprocess.run(['ollama', 'list'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines[1:]:
                    if line.strip():
                        model_name = line.split()[0]
                        available_models.append(model_name)
                        print(f"✅ Найдена модель: {model_name}")
            
            if not available_models:
                print("❌ Модели не найдены! Установите: ollama pull llama3.2:1b")
                
        except Exception as e:
            print(f"⚠️ Ошибка поиска моделей: {e}")
        
        return available_models
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/api/analyze':
            print(f"📨 Получен запрос (доступно моделей: {len(self.available_models)})")
            
            try:
                if not self.available_models:
                    raise Exception("AI модели не найдены! Установите: ollama pull llama3.2:1b")
                
                # Читаем данные
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                request_data = json.loads(post_data.decode('utf-8'))
                
                # Извлекаем диагноз
                ib_data = request_data["История болезни или наблюдений v.4"]
                ib_id = list(ib_data.keys())[0]
                patient_data = ib_data[ib_id]["Данные"]["Сведения при обращении"]
                diagnosis = patient_data.get("Клинический диагноз", {}).get("Значение", "не указан")
                
                # ИСПОЛЬЗУЕМ ТОЛЬКО AI
                recommendations = self.use_ai_system(diagnosis)
                
                # Отправляем ответ
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'success': True,
                    'recommendations': recommendations,
                    'mode': 'ai'
                }
                
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode())
                print("✅ AI рекомендации отправлены")
                
            except Exception as e:
                print(f"❌ Ошибка: {e}")
                self.send_error_response(str(e))
                
        else:
            self.send_response(404)
            self.end_headers()
    
    def use_ai_system(self, diagnosis):
        """Использует реальные AI модели через прямое подключение"""
        try:
            print(f"🎯 Запуск AI для диагноза: {diagnosis}")
            
            # Добавляем путь к их проекту
            sys.path.append('./medical_assistant')
            
            # Прямой импорт их системы
            from core import MedicalAssistant
            
            # Создаем ассистент
            assistant = MedicalAssistant(model="llama3.2:1b")
            
            # Подготавливаем данные пациента в нужном формате
            patient_data_formatted = {
                "Клинический диагноз": {
                    "Тип": "Текстовое", 
                    "Значение": diagnosis
                }
            }
            
            print("📚 Загрузка медицинских параграфов...")
            # Загружаем релевантные параграфы
            vault_content = assistant.load_relevant_paragraphs(patient_data_formatted)
            print(f"✅ Загружено параграфов: {len(vault_content)}")
            
            print("🔍 Создание эмбеддингов...")
            # Генерируем эмбеддинги
            vault_embeddings = assistant.generate_embeddings(vault_content)
            print(f"✅ Создано эмбеддингов: {vault_embeddings.shape}")
            
            print("💬 Генерация системного сообщения...")
            # Получаем системное сообщение
            system_message = assistant.get_system_message_by_diagnosis(patient_data_formatted)
            
            print("🤖 Запрос к AI модели...")
            # Генерируем рекомендации
            user_input = f"Назначьте лечение для пациента с диагнозом: {diagnosis}"
            
            recommendation = assistant.ollama_chat(
                user_input,
                system_message,
                vault_embeddings,
                vault_content,
                assistant.model,
                assistant.conversation_history,
                patient_data_formatted
            )
            
            print("🎉 AI рекомендации успешно сгенерированы!")
            return recommendation
            
        except Exception as e:
            print(f"❌ Ошибка AI системы: {e}")
            raise Exception(f"Ошибка AI системы: {str(e)}")
    
    def send_error_response(self, error_msg):
        self.send_response(500)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({
            'success': False,
            'error': error_msg
        }).encode())

def run_smart_server():
    print("🚀 УМНЫЙ МЕДИЦИНСКИЙ AI СЕРВЕР")
    print("📍 http://127.0.0.1:5000")
    print("🔍 Использует только реальные AI модели")
    print("❌ Оффлайн режим отключен")
    print("⏹️  Ctrl+C для остановки\n")
    
    server = HTTPServer(('127.0.0.1', 5000), SmartAIHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️ Остановка сервера")

if __name__ == '__main__':
    run_smart_server()