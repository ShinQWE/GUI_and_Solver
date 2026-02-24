import torch
import ollama
import os
import json
import re
import glob
from openai import OpenAI
import tkinter as tk
from tkinter import filedialog
import shutil


class MedicalAssistant:
    def __init__(self, model="mistral:7b"):
        """
        Универсальный медицинский ассистент
        
        Args:
            model (str): Название модели Ollama
        """
        self.model = model
        self.client = OpenAI(
            base_url='http://localhost:11434/v1',
            api_key='llama3'  # можно оставить любой
        )
        self.conversation_history = []
        self.patient_data = {}
        self.vault_content = []
        self.vault_embeddings_tensor = None
        
        # Цвета для консоли
        self.PINK = '\033[95m'
        self.CYAN = '\033[96m'
        self.YELLOW = '\033[93m'
        self.NEON_GREEN = '\033[92m'
        self.RESET_COLOR = '\033[0m'
    
    def open_file(self, filepath):
        """Чтение файла"""
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    
    def save_file(self, filepath, content):
        """Сохранение файла"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def load_patient_data_smart(self, data_path='ИБ'):
        """
        Умная загрузка данных пациента из JSON
        Поддерживает разные форматы
        """
        try:
            # Создаем папку если нет
            if not os.path.exists(data_path):
                os.makedirs(data_path)
                print(f"📁 Создана папка {data_path}")
            
            # Очищаем папку
            self.clear_data_folder(data_path)
            
            # Диалог выбора файла
            json_filepath = self.open_file_dialog()
            if not json_filepath:
                print("❌ Файл не выбран")
                return {}
            
            # Копируем файл
            filename = os.path.basename(json_filepath)
            destination = os.path.join(data_path, filename)
            shutil.copy2(json_filepath, destination)
            print(f"✅ Файл скопирован: {destination}")
            
            # Загружаем данные
            with open(destination, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            print(f"📊 Анализ структуры файла {filename}...")
            
            # АДАПТИВНЫЙ ПАРСИНГ: обрабатываем разные форматы
            patient_data = self.parse_patient_data_adaptive(raw_data)
            
            print(f"\n✅ Загружено {len(patient_data)} полей пациента")
            
            # ВАЖНО: Проверяем наличие ключевых полей
            if "Диагноз" not in patient_data and "Клинический диагноз" not in patient_data:
                print("⚠️  Внимание: диагноз не найден в данных!")
            
            return patient_data
            
        except Exception as e:
            print(f"❌ Ошибка загрузки данных: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def parse_patient_data_adaptive(self, raw_data):
        """
        Адаптивный парсинг данных пациента из разных структур
        """
        patient_data = {}
        
        # СЛУЧАЙ 1: Стандартный формат v.4
        if "История болезни или наблюдений v.4" in raw_data:
            print("📋 Обнаружен формат v.4")
            ib_data = raw_data["История болезни или наблюдений v.4"]
            
            # Находим запись пациента (первый ключ)
            patient_key = list(ib_data.keys())[0]
            patient_record = ib_data[patient_key]
            
            # Извлекаем данные из всех разделов
            if "Данные" in patient_record:
                all_data = patient_record["Данные"]
                
                for section_name, section_data in all_data.items():
                    if isinstance(section_data, dict):
                        for field_name, field_data in section_data.items():
                            if isinstance(field_data, dict) and "Значение" in field_data:
                                value = field_data["Значение"]
                                if value not in [None, "", [], {}]:
                                    patient_data[field_name] = {
                                        "Тип": field_data.get("Тип", "Текстовое"),
                                        "Значение": value
                                    }
        
        # СЛУЧАЙ 2: Прямой формат (из GUI)
        elif isinstance(raw_data, dict) and any(key in raw_data for key in ['Клинический диагноз', 'Возраст', 'Пол']):
            print("📋 Обнаружен прямой формат")
            for key, value in raw_data.items():
                if value not in [None, "", []]:
                    patient_data[key] = {
                        "Тип": "Текстовое",
                        "Значение": value
                    }
        
        # СЛУЧАЙ 3: Формат из GUI с иерархией
        else:
            print("📋 Обнаружен нестандартный формат")
            patient_data = self.flatten_data_structure(raw_data)
        
        return patient_data
    
    def flatten_data_structure(self, data, parent_key=''):
        """
        Преобразует вложенную структуру в плоский словарь
        """
        items = {}
        
        if isinstance(data, dict):
            for key, value in data.items():
                new_key = f"{parent_key}_{key}" if parent_key else key
                
                if isinstance(value, dict):
                    if "Значение" in value:
                        # Это поле с данными
                        val = value["Значение"]
                        if val not in [None, "", []]:
                            items[new_key] = {
                                "Тип": value.get("Тип", "Текстовое"),
                                "Значение": val
                            }
                    else:
                        # Рекурсивно обрабатываем вложенный словарь
                        items.update(self.flatten_data_structure(value, new_key))
                elif isinstance(value, list):
                    # Обрабатываем списки
                    if value:
                        items[new_key] = {
                            "Тип": "Список",
                            "Значение": value
                        }
                elif value not in [None, "", []]:
                    # Простые значения
                    items[new_key] = {
                        "Тип": "Текстовое",
                        "Значение": value
                    }
        
        return items
    
    def clear_data_folder(self, data_path):
        """Очистка папки с данными"""
        if os.path.exists(data_path):
            for filename in os.listdir(data_path):
                file_path = os.path.join(data_path, filename)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                        print(f"🗑️  Удален старый файл: {filename}")
                except Exception as e:
                    print(f"⚠️  Ошибка удаления {filename}: {e}")
    
    def open_file_dialog(self):
        """Диалог выбора файла"""
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        file_path = filedialog.askopenfilename(
            title="Выберите JSON файл с данными пациента",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        root.destroy()
        return file_path
    
    def get_medical_specialization(self, diagnosis_text):
        """
        Определяет медицинскую специализацию на основе диагноза
        Использует интеллектуальный анализ вместо жестких шаблонов
        """
        if not diagnosis_text:
            return "общей медицине"
        
        diagnosis_lower = diagnosis_text.lower()
        
        # Ключевые слова для специализаций (можно расширять)
        cardiology_keywords = ['ибс', 'ишемическ', 'стенокарди', 'аритми', 'гипертенз', 
                              'гипертония', 'сердечн', 'кардио', 'миокард', 'инфаркт']
        
        neurology_keywords = ['мигрен', 'головн', 'невролог', 'инсульт', 'эпилепс', 
                             'парез', 'паралич', 'рассеянн']
        
        hepatology_keywords = ['гепатит', 'печен', 'хвгс', 'цирроз', 'билирубин']
        
        traumatology_keywords = ['перелом', 'вывих', 'травм', 'ушиб', 'растяжен', 
                                'связк', 'сустав', 'кости', 'остеосинтез']
        
        gastroenterology_keywords = ['гастрит', 'язвен', 'колит', 'панкреатит', 
                                    'желудок', 'кишечник']
        
        # Определяем специализацию
        for keyword in cardiology_keywords:
            if keyword in diagnosis_lower:
                return "кардиологии"
        
        for keyword in neurology_keywords:
            if keyword in diagnosis_lower:
                return "неврологии"
        
        for keyword in hepatology_keywords:
            if keyword in diagnosis_lower:
                return "гепатологии"
        
        for keyword in traumatology_keywords:
            if keyword in diagnosis_lower:
                return "травматологии"
        
        for keyword in gastroenterology_keywords:
            if keyword in diagnosis_lower:
                return "гастроэнтерологии"
        
        return "общей медицине"
    
    def get_all_treatment_files(self):
        """
        Получает ВСЕ доступные файлы с лечением
        """
        base_dir = os.path.dirname(__file__)
        data_dir = os.path.join(base_dir, "data")
        
        if not os.path.exists(data_dir):
            print(f"⚠️  Папка {data_dir} не найдена!")
            os.makedirs(data_dir)
            return []
        
        # Ищем ВСЕ txt файлы в папке data
        treatment_files = []
        for filename in os.listdir(data_dir):
            if filename.endswith('.txt'):
                filepath = os.path.join(data_dir, filename)
                treatment_files.append(filepath)
        
        print(f"📚 Найдено {len(treatment_files)} файлов с лечением")
        return treatment_files
    
    def load_all_treatment_content(self):
        """
        Загружает ВСЕ доступные параграфы лечения из папки data
        ИСПРАВЛЕНО: лучший парсинг параграфов
        """
        base_dir = os.path.dirname(__file__)
        data_dir = os.path.join(base_dir, "data")
        
        if not os.path.exists(data_dir):
            print(f"⚠️ Папка {data_dir} не найдена!")
            os.makedirs(data_dir)
            return []
        
        # Ищем ВСЕ txt файлы
        treatment_files = []
        for filename in os.listdir(data_dir):
            if filename.endswith('.txt'):
                filepath = os.path.join(data_dir, filename)
                treatment_files.append(filepath)
        
        print(f"📚 Найдено {len(treatment_files)} файлов с лечением")
        
        all_content = []
        
        for filepath in treatment_files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Разбиваем на параграфы (УЛУЧШЕННЫЙ ПАРСИНГ)
                    lines = content.split('\n')
                    current_paragraph = []
                    
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        
                        # Проверяем начало нового параграфа
                        if (line[0].isdigit() and '. ' in line[:4]) or \
                           (len(line) > 2 and line[0].isdigit() and line[1] == '.'):
                            # Сохраняем предыдущий параграф
                            if current_paragraph:
                                all_content.append(' '.join(current_paragraph))
                                current_paragraph = []
                        
                        current_paragraph.append(line)
                    
                    # Добавляем последний параграф
                    if current_paragraph:
                        all_content.append(' '.join(current_paragraph))
                    
                    file_paragraphs = len([p for p in all_content if p])
                    print(f"📖 Загружено из {os.path.basename(filepath)}: {file_paragraphs} параграфов")
                    
            except Exception as e:
                print(f"⚠️ Ошибка загрузки {filepath}: {e}")
        
        # Убираем дубликаты
        all_content = list(dict.fromkeys(all_content))
        
        print(f"📚 ВСЕГО загружено: {len(all_content)} уникальных параграфов лечения")
        return all_content
    
    def extract_diagnosis_from_data(self, patient_data):
        """
        Извлекает диагноз из данных пациента (адаптивный метод)
        """
        if not patient_data:
            return "Диагноз не указан"
        
        # Пробуем разные возможные ключи
        possible_keys = [
            'Клинический диагноз', 'Основной диагноз', 'Диагноз', 
            'Заключительный диагноз', 'Предварительный диагноз',
            'Диагноз при поступлении', 'Заключительный клинический диагноз'
        ]
        
        for key in possible_keys:
            if key in patient_data:
                value = patient_data[key]
                if isinstance(value, dict) and "Значение" in value:
                    diagnosis = str(value["Значение"]).strip()
                else:
                    diagnosis = str(value).strip()
                
                if diagnosis and diagnosis.lower() != 'не указан':
                    print(f"✅ Найден диагноз по ключу '{key}': {diagnosis}")
                    return diagnosis
        
        # Если не нашли в стандартных ключах, ищем в любом поле
        for key, value in patient_data.items():
            if isinstance(value, dict) and "Значение" in value:
                val_str = str(value["Значение"]).lower()
                # Ищем упоминания диагноза
                if any(word in val_str for word in ['диагноз', 'заключение', 'нозологи']):
                    return str(value["Значение"]).strip()
        
        print("⚠️  Диагноз не найден в данных пациента")
        return "Диагноз не указан"
    
    def get_intelligent_system_message(self, patient_data):
        """
        Создает интеллектуальное системное сообщение на основе данных пациента
        """
        # Извлекаем диагноз
        diagnosis = self.extract_diagnosis_from_data(patient_data)
        
        # Определяем специализацию
        specialization = self.get_medical_specialization(diagnosis)
        
        # Формируем строку с данными пациента
        patient_info_lines = []
        for key, value in patient_data.items():
            if isinstance(value, dict) and 'Значение' in value:
                val = value['Значение']
                if val not in [None, "", [], {}]:
                    patient_info_lines.append(f"- {key}: {val}")
            elif value not in [None, "", [], {}] and not isinstance(value, dict):
                patient_info_lines.append(f"- {key}: {value}")
        
        patient_info = "\n".join(patient_info_lines)
        
        system_message = f"""Ты - медицинский ассистент, специалист в {specialization}.

СТРОГИЕ ПРАВИЛА:
1. ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ
2. ИСПОЛЬЗУЙ ДАННЫЕ ПАЦИЕНТА для персонализации рекомендаций
3. ОПИРАЙСЯ НА ПРЕДОСТАВЛЕННЫЙ КОНТЕКСТ лечения
4. ЕСЛИ В КОНТЕКСТЕ НЕТ ИНФОРМАЦИИ - скажи это честно
5. УЧИТЫВАЙ возраст и особенности пациента
6. ДАВАЙ КОНКРЕТНЫЕ, ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ

ДАННЫЕ ПАЦИЕНТА:
{patient_info}

ОСНОВНОЙ ДИАГНОЗ: {diagnosis}

ФОРМАТ ОТВЕТА:
1. Краткое резюме случая
2. Основные направления лечения
3. Конкретные рекомендации (препараты, дозировки, сроки)
4. Наблюдение и контроль
5. Рекомендации для пациента

Используй медицинскую терминологию, но объясняй понятно.
Учитывай возраст, пол и другие особенности пациента.
Если нужно - предлагай дополнительные обследования."""
        
        return system_message
    
    def get_relevant_context(self, query, vault_embeddings, vault_content, top_k=5):
        """
        Поиск релевантного контекста с УЛУЧШЕННОЙ точностью
        """
        # ИСПРАВЛЕНО: явная проверка на None и размер
        if vault_embeddings is None:
            print("⚠️ Эмбеддинги не загружены (None)")
            return []
        
        if not isinstance(vault_embeddings, torch.Tensor):
            print("⚠️ Эмбеддинги не являются тензором")
            return []
        
        if vault_embeddings.nelement() == 0:
            print("⚠️ Эмбеддинги пустые")
            return []
        
        if not vault_content:
            print("⚠️ Контент не загружен")
            return []
        
        print(f"🔍 Поиск контекста для: {query[:100]}...")
        
        try:
            # Извлекаем диагноз для лучшего поиска
            diagnosis = self.extract_diagnosis_from_data(self.patient_data)
            
            # Расширяем запрос ключевыми словами
            enhanced_query = f"{query} {diagnosis} лечение рекомендации дозировки"
            
            # Генерируем эмбеддинг
            input_embedding = ollama.embeddings(
                model='nomic-embed-text', 
                prompt=enhanced_query
            )["embedding"]
            
            input_embedding_tensor = torch.tensor(input_embedding).unsqueeze(0)
            
            # Нормализация
            vault_normalized = torch.nn.functional.normalize(vault_embeddings, p=2, dim=1)
            input_normalized = torch.nn.functional.normalize(input_embedding_tensor, p=2, dim=1)
            
            # Косинусное сходство
            cos_scores = torch.cosine_similarity(input_normalized, vault_normalized)
            
            # ПОНИЖАЕМ ПОРОГ для лучшего покрытия
            top_k = min(top_k * 2, len(vault_content))
            top_indices = torch.topk(cos_scores, k=top_k)[1].tolist()
            
            similarity_threshold = 0.65
            relevant_context = []
            
            for idx in top_indices:
                if cos_scores[idx] >= similarity_threshold:
                    content = vault_content[idx].strip()
                    # Проверяем, что контент релевантен диагнозу
                    if diagnosis.lower() in content.lower() or \
                       any(word in content.lower() for word in diagnosis.lower().split()[:3]):
                        relevant_context.append(content)
                        print(f"   ✅ Релевантность {cos_scores[idx]:.3f}: {content[:80]}...")
            
            # Если ничего не нашли, берем топ-3 даже с низкой релевантностью
            if not relevant_context and top_indices:
                print("⚠️ Ничего с высоким score, беру топ-3")
                for idx in top_indices[:3]:
                    content = vault_content[idx].strip()
                    relevant_context.append(content)
                    print(f"   ⚠️ Score {cos_scores[idx]:.3f}: {content[:80]}...")
            
            print(f"✅ Найдено {len(relevant_context)} релевантных контекстов")
            return relevant_context[:3]
            
        except Exception as e:
            print(f"❌ Ошибка поиска контекста: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def rewrite_query(self, user_input, conversation_history, patient_data):
        """
        Переписывает запрос для лучшего поиска
        """
        if len(conversation_history) < 2:
            return user_input
        
        context = "\n".join([
            f"{msg['role']}: {msg['content'][:200]}..."
            for msg in conversation_history[-2:]
        ])
        
        diagnosis = self.extract_diagnosis_from_data(patient_data)
        
        prompt = f"""Переформулируй медицинский запрос для лучшего поиска информации.

ДИАГНОЗ: {diagnosis}
ИСТОРИЯ: {context}
ЗАПРОС: {user_input}

Переписанный запрос (только запрос, без пояснений):"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3
            )
            rewritten = response.choices[0].message.content.strip()
            print(f"🔄 Переписанный запрос: {rewritten}")
            return rewritten
        except Exception as e:
            print(f"⚠️ Ошибка переписывания запроса: {e}")
            return user_input
    
    def ollama_chat(self, user_input, system_message, vault_embeddings, vault_content, 
                   conversation_history, patient_data):
        """
        Основная функция общения с моделью
        """
        conversation_history.append({"role": "user", "content": user_input})
        
        if len(conversation_history) > 1:
            rewritten_query = self.rewrite_query(user_input, conversation_history, patient_data)
        else:
            rewritten_query = user_input
        
        relevant_context = self.get_relevant_context(
            rewritten_query, 
            vault_embeddings, 
            vault_content
        )
        
        if relevant_context:
            context_str = "\n\n".join(relevant_context)
            full_prompt = f"""КОНТЕКСТ ЛЕЧЕНИЯ:
{context_str}

ЗАПРОС: {user_input}

ИСПОЛЬЗУЙ ТОЛЬКО ИНФОРМАЦИЮ ИЗ КОНТЕКСТА.
Если в контексте нет нужной информации - скажи об этом."""
        else:
            full_prompt = user_input
            print("⚠️ Контекст не найден, используем общие знания")
        
        conversation_history[-1]["content"] = full_prompt
        
        messages = [
            {"role": "system", "content": system_message},
            *conversation_history[-3:]
        ]
        
        try:
            print("🧠 Запрос к модели...")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=2000,
                temperature=0.3,
                timeout=60
            )
            
            answer = response.choices[0].message.content
            conversation_history.append({"role": "assistant", "content": answer})
            
            print(f"✅ Получен ответ ({len(answer)} символов)")
            return answer
            
        except Exception as e:
            error_msg = f"❌ Ошибка получения ответа: {e}"
            print(error_msg)
            return error_msg
    
    def generate_embeddings(self, content_list):
        """
        Генерация эмбеддингов для списка контента
        """
        print(f"🔧 Генерация эмбеддингов для {len(content_list)} элементов...")
        
        embeddings = []
        
        for i, content in enumerate(content_list):
            try:
                if i % 50 == 0:
                    print(f"   Прогресс: {i}/{len(content_list)}")
                
                response = ollama.embeddings(
                    model='nomic-embed-text',
                    prompt=content[:1000]
                )
                embeddings.append(response["embedding"])
                
            except Exception as e:
                print(f"⚠️ Ошибка эмбеддинга для элемента {i}: {e}")
                embeddings.append([0] * 768)
        
        if not embeddings:
            print("⚠️ Не удалось создать эмбеддинги")
            return torch.tensor([])
        
        embeddings_tensor = torch.tensor(embeddings)
        print(f"✅ Создан тензор эмбеддингов: {embeddings_tensor.shape}")
        
        return embeddings_tensor
    
    def initialize_system(self, data_path='ИБ'):
        """
        Полная инициализация системы
        """
        print("=" * 60)
        print("🏥 ИНИЦИАЛИЗАЦИЯ МЕДИЦИНСКОГО АССИСТЕНТА")
        print("=" * 60)
        
        print("\n[1/3] 📋 Загрузка данных пациента...")
        self.patient_data = self.load_patient_data_smart(data_path)
        
        if not self.patient_data:
            print("❌ Не удалось загрузить данные пациента")
            return False
        
        print(f"✅ Загружено {len(self.patient_data)} полей")
        
        diagnosis = self.extract_diagnosis_from_data(self.patient_data)
        print(f"📌 Диагноз: {diagnosis}")
        
        print("\n[2/3] 📚 Загрузка базы знаний лечения...")
        self.vault_content = self.load_all_treatment_content()
        
        if not self.vault_content:
            print("⚠️ Нет данных лечения. Создаем минимальную базу...")
            self.vault_content = [
                "1. Общие принципы лечения: индивидуальный подход, учет возраста и сопутствующих заболеваний.",
                "2. Медикаментозная терапия должна назначаться врачом после полного обследования.",
                "3. Регулярное наблюдение и контроль эффективности лечения.",
                "4. Модификация образа жизни: питание, физическая активность, отказ от вредных привычек."
            ]
        
        print("\n[3/3] 🔧 Генерация эмбеддингов...")
        self.vault_embeddings_tensor = self.generate_embeddings(self.vault_content)
        
        print("\n" + "=" * 60)
        print("✅ СИСТЕМА ГОТОВА К РАБОТЕ")
        print("=" * 60)
        
        return True
    
    def get_treatment_recommendation(self, custom_query=None):
        """
        Получает рекомендации по лечению через RAG
        ИСПРАВЛЕНО: гарантированная загрузка контекста
        """
        if not self.patient_data:
            print("❌ Данные пациента не загружены")
            return self.get_fallback_recommendation("Данные пациента не загружены")
        
        diagnosis = self.extract_diagnosis_from_data(self.patient_data)
        
        if not self.vault_content:
            print("📚 Контент не загружен, загружаем...")
            self.vault_content = self.load_all_treatment_content()
            
            if self.vault_content:
                print("🔧 Генерируем эмбеддинги...")
                self.vault_embeddings_tensor = self.generate_embeddings(self.vault_content)
        
        if custom_query:
            user_query = custom_query
        else:
            age = "не указан"
            if 'Возраст' in self.patient_data:
                age_val = self.patient_data['Возраст']
                if isinstance(age_val, dict) and 'Значение' in age_val:
                    age = age_val['Значение']
                else:
                    age = age_val
            
            user_query = f"Назначь лечение для пациента с диагнозом: {diagnosis}. Возраст: {age} лет."
        
        system_message = self.get_intelligent_system_message(self.patient_data)
        
        print(f"\n🤖 ЗАПРОС К RAG: {user_query}")
        print(f"📚 Параграфов в базе: {len(self.vault_content) if self.vault_content else 0}")
        
        recommendation = self.ollama_chat(
            user_input=user_query,
            system_message=system_message,
            vault_embeddings=self.vault_embeddings_tensor,
            vault_content=self.vault_content,
            conversation_history=self.conversation_history,
            patient_data=self.patient_data
        )
        
        return recommendation
    
    def get_fallback_recommendation(self, reason="Контекст лечения не найден"):
        """
        Резервные рекомендации, когда RAG не сработал
        """
        diagnosis = self.extract_diagnosis_from_data(self.patient_data) if self.patient_data else "Диагноз не указан"
        
        return f"""
# ⚠️ РЕКОМЕНДАЦИИ ПО ЛЕЧЕНИЮ (БАЗОВЫЙ УРОВЕНЬ)

**Диагноз:** {diagnosis}
**Примечание:** {reason}

## Общие принципы:

### 1. Медикаментозная терапия
- Назначается врачом после осмотра
- Индивидуальный подбор дозировок
- Контроль эффективности

### 2. Немедикаментозные методы
- Режим дня
- Диета
- Физическая активность

### 3. Наблюдение
- Регулярные осмотры
- Контроль анализов

*ДЛЯ ПОЛУЧЕНИЯ ТОЧНЫХ РЕКОМЕНДАЦИЙ:*
1. Проверьте наличие файлов в папке /data/
2. Убедитесь, что в файлах есть параграфы лечения для вашего диагноза
3. Повторите запрос
"""


# Утилита для быстрого тестирования
def test_assistant():
    """Тестовая функция для проверки работы"""
    print("🧪 ТЕСТИРОВАНИЕ АССИСТЕНТА")
    
    assistant = MedicalAssistant()
    
    # Тестовые данные (ИБС)
    test_data = {
        "Клинический диагноз": {
            "Тип": "Текстовое",
            "Значение": "Стабильная ишемическая болезнь сердца, стенокардия напряжения II ФК"
        },
        "Возраст": {
            "Тип": "Числовое",
            "Значение": "65"
        },
        "Пол": {
            "Тип": "Выбор",
            "Значение": "Мужской"
        },
        "Анамнез": {
            "Тип": "Текстовое",
            "Значение": "Артериальная гипертензия 10 лет, курение 20 лет"
        }
    }
    
    assistant.patient_data = test_data
    
    # Тест 1: Определение специализации
    diagnosis = assistant.extract_diagnosis_from_data(test_data)
    specialization = assistant.get_medical_specialization(diagnosis)
    print(f"📌 Диагноз: {diagnosis}")
    print(f"🎓 Специализация: {specialization}")
    
    # Тест 2: Системное сообщение
    sys_msg = assistant.get_intelligent_system_message(test_data)
    print(f"\n📝 Системное сообщение (первые 300 символов):")
    print(sys_msg[:300] + "...")
    
    # Тест 3: Загрузка всех файлов
    files = assistant.get_all_treatment_files()
    print(f"\n📚 Файлов лечения: {len(files)}")
    
    return assistant


if __name__ == "__main__":
    # Запуск теста
    test_assistant()