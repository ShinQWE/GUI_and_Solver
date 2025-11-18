import torch
import ollama
import os
import json
import glob
import re
from openai import OpenAI
import tkinter as tk
from tkinter import filedialog
import os
import json
import glob
import shutil


class MedicalAssistant:
    def __init__(self, model="mistral:7b"):
        """
        Инициализация медицинского ассистента

        Args:
            model (str): Название модели Ollama для использования
        """
        self.model = model
        self.client = OpenAI(
            base_url='http://localhost:11434/v1',
            api_key='llama3'
        )
        self.conversation_history = []
        self.patient_data = {}
        self.vault_content = []
        self.vault_embeddings_tensor = None

        # Цвета для вывода в консоль
        self.PINK = '\033[95m'
        self.CYAN = '\033[96m'
        self.YELLOW = '\033[93m'
        self.NEON_GREEN = '\033[92m'
        self.RESET_COLOR = '\033[0m'

    # Функция для окрытия файла, возвращает текст в виде строк
    def open_file(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as infile:
            return infile.read()

    # Функция для загрузки данных пациента из JSON файла
    # Упрощенная версия с лучшим форматированием
    import tkinter as tk
    from tkinter import filedialog
    import os
    import json
    import glob
    import shutil

    def load_patient_data_simple(self, data_path='ИБ'):
        try:
            # Создаем папку ИБ если ее нет
            if not os.path.exists(data_path):
                os.makedirs(data_path)
                print(f"Создана папка {data_path}")

            # Очищаем папку ИБ от старых файлов
            self.clear_ib_folder(data_path)

            # Открываем диалоговое окно для выбора файла
            json_filepath = self.open_file_dialog()

            if not json_filepath:
                print("Файл не выбран")
                return {}

            # Копируем выбранный файл в папку ИБ
            filename = os.path.basename(json_filepath)
            destination_path = os.path.join(data_path, filename)
            shutil.copy2(json_filepath, destination_path)
            print(f"Файл скопирован в: {destination_path}")

            # Загружаем данные из скопированного файла
            print(f"Загружаем данные из файла: {filename}")

            with open(destination_path, 'r', encoding='utf-8') as file:
                data = json.load(file)

            # Извлекаем данные
            patient_record = list(data["История болезни или наблюдений v.4"].values())[0]
            patient_info = patient_record["Данные"]["Сведения при обращении"]

            print("\nДанные пациента:")
            print("=" * 50)

            # Создаем словарь для возвращаемых данных
            patient_data = {}

            for field_name, field_data in patient_info.items():
                if isinstance(field_data, dict) and "Значение" in field_data:
                    value = field_data["Значение"]

                    if value in [None, "", [], False]:
                        continue

                    # Сохраняем данные в возвращаемый словарь
                    patient_data[field_name] = {
                        "Тип": field_data.get("Тип", ""),
                        "Значение": value
                    }

                    # Простые значения
                    if not isinstance(value, list):
                        print(f"• {field_name}: {value}")

                    # Списки простых значений
                    elif isinstance(value, list) and value and not isinstance(value[0], dict):
                        print(f"• {field_name}: {', '.join(map(str, value))}")

                    # Сложные структуры
                    else:
                        print(f"• {field_name}:")
                        for item in value:
                            if isinstance(item, dict):
                                for sub_key, sub_value in item.items():
                                    if isinstance(sub_value, dict) and "Значение" in sub_value:
                                        nested_items = sub_value["Значение"]
                                        if nested_items:
                                            print(f"  └── {sub_key}:")
                                            for nested_item in nested_items:
                                                if isinstance(nested_item, dict):
                                                    for detail_key, detail_value in nested_item.items():
                                                        if isinstance(detail_value,
                                                                      dict) and "Значение" in detail_value:
                                                            detail_content = detail_value["Значение"]
                                                            if detail_content not in [None, "", []]:
                                                                print(f"      ├── {detail_key}: {detail_content}")

            print("=" * 50)
            return patient_data

        except Exception as e:
            print(f"Ошибка при загрузке данных пациента: {e}")
            return {}

    def clear_ib_folder(self, data_path):
        """Очищает папку ИБ от всех файлов"""
        if os.path.exists(data_path):
            for filename in os.listdir(data_path):
                file_path = os.path.join(data_path, filename)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                        print(f"Удален старый файл: {filename}")
                except Exception as e:
                    print(f"Ошибка при удалении файла {filename}: {e}")

    def open_file_dialog(self):
        """Открывает диалоговое окно для выбора JSON файла"""
        root = tk.Tk()
        root.withdraw()  # Скрываем основное окно
        root.attributes('-topmost', True)  # Поверх всех окон

        file_path = filedialog.askopenfilename(
            title="Выберите JSON файл с данными пациента",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )

        root.destroy()
        return file_path


    # Функция для определения нужного файла параграфов на основе диагноза
    def get_paragraphs_file_by_diagnosis(self,patient_data):
        """
        Определяет какой файл параграфов использовать на основе клинического диагноза
        """

        base_dir = os.path.dirname(__file__)


        # Извлекаем клинический диагноз из данных пациента
        clinical_diagnosis = ""
        if "Клинический диагноз" in patient_data:
            clinical_diagnosis = str(patient_data["Клинический диагноз"]["Значение"]).lower()

        print(f"Анализируем диагноз: '{clinical_diagnosis}'")

        # Регулярные выражения для поиска
        hepatitis_patterns = [
            r'хвгс',  # ХВГС
            r'гепатит',  # гепатит, гепатита, гепатитом и т.д.
            r'хрон\w* гепатит',  # хронический гепатит
            r'вирусн\w* гепатит',  # вирусный гепатит
            r'гепатит\s*с',  # гепатит с, гепатитс
        ]

        # Паттерны для переломов ключицы и/или лопатки
        fracture_patterns = [
            # Перелом(ы) ключицы
            r'перелом\w*\s+ключиц\w*',
            r'ключиц\w*\s+перелом\w*',

            # Перелом(ы) лопатки
            r'перелом\w*\s+лопат\w*',
            r'лопат\w*\s+перелом\w*',

            # Перелом(ы) ключицы и лопатки
            r'перелом\w*\s+ключиц\w*\s+и\s+лопат\w*',
            r'перелом\w*\s+лопат\w*\s+и\s+ключиц\w*',
            r'ключиц\w*\s+и\s+лопат\w*\s+перелом\w*',

            # Перелом(ы) ключицы или лопатки
            r'перелом\w*\s+ключиц\w*\s+или\s+лопат\w*',
            r'перелом\w*\s+лопат\w*\s+или\s+ключиц\w*',
        ]

        # Проверяем паттерны для гепатита
        for pattern in hepatitis_patterns:
            if re.search(pattern, clinical_diagnosis):
                paragraphs_file = os.path.join(base_dir, "data", "Хронический вирусный гепатит С (ХВГС) параграфы.txt")
                print(f"✅ Выбран файл для гепатита (найден паттерн: '{pattern}')")
                return paragraphs_file

        # Проверяем паттерны для переломов
        for pattern in fracture_patterns:
            if re.search(pattern, clinical_diagnosis):
                paragraphs_file = os.path.join(base_dir, "data", "Переломы ключицы и лопатки параграфы.txt")
                print(f"✅ Выбран файл для переломов (найден паттерн: '{pattern}')")
                return paragraphs_file

        # По умолчанию используем гепатит, если диагноз не распознан
        paragraphs_file = os.path.join(base_dir, "data", "Хронический вирусный гепатит С (ХВГС) параграфы.txt")
        print("⚠️  Выбран файл по умолчанию (гепатит) - диагноз не распознан")
        return paragraphs_file

    # Функция для загрузки соответствующих параграфов
    def load_relevant_paragraphs(self, patient_data):
        """
        Загружает параграфы соответствующие диагнозу пациента
        """
        paragraphs_file = self.get_paragraphs_file_by_diagnosis(patient_data)

        print(self.NEON_GREEN + f"Загрузка {paragraphs_file}..." + self.RESET_COLOR)
        vault_content = []

        if os.path.exists(paragraphs_file):
            with open(paragraphs_file, "r", encoding='utf-8') as vault_file:
                vault_content = vault_file.readlines()
            print(f"Загружено {len(vault_content)} строк из {paragraphs_file}")
        else:
            print(f"Файл {paragraphs_file} не найден!")

        return vault_content

    # Функция для определения системного сообщения на основе диагноза
    def get_system_message_by_diagnosis(self, patient_data):
        """
        Возвращает соответствующее системное сообщение на основе диагноза
        """
        clinical_diagnosis = ""
        if "Клинический диагноз" in patient_data:
            clinical_diagnosis = str(patient_data["Клинический диагноз"]["Значение"])

        # Для переломов
        if any(keyword in clinical_diagnosis.lower() for keyword in
               ["перелом ключицы", "перелом лопатки", "ключицы и лопатки"]):
            return f"""Ты - медицинский ассистент, специализирующийся на травматологии и лечении переломов. 
    СТРОГИЕ ПРАВИЛА:
    1. ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ
    2. ВСЕГДА ИСПОЛЬЗУЙ ДАННЫЕ ПАЦИЕНТА ДЛЯ ФОРМИРОВАНИЯ ОТВЕТА
    3. ИСПОЛЬЗУЙ ТОЛЬКО ТЕКСТ ИЗ ПРЕДОСТАВЛЕННОГО КОНТЕКСТА - НИЧЕГО НЕ ПРИДУМЫВАЙ
    4. НЕ ИЗМЕНЯЙ ТЕРМИНОЛОГИЮ ИЗ КОНТЕКСТА
    5. ЕСЛИ В КОНТЕКСТЕ НЕТ ИНФОРМАЦИИ - СКАЖИ "В предоставленном контексте нет информации"
    6. НЕ ДОБАВЛЯЙ СВОИ ЗНАНИЯ ИЛИ ИНТЕРПРЕТАЦИИ
    7. УБЕРИ РЕКОМЕНДАЦИИ ДЛЯ ДЕТЕЙ, ЕСЛИ ВОЗРАСТ ПАЦИЕНТА >=18

    ДАННЫЕ ПАЦИЕНТА (ОБЯЗАТЕЛЬНО ИСПОЛЬЗОВАТЬ): {patient_data}
    ПРАВИЛА ИСПОЛЬЗОВАНИЯ ДАННЫХ ПАЦИЕНТА:
    - Учитывай возраст пациента при выборе лечения
    - Учитывай противопоказания из анамнеза
    - Учитывай уже проведенные лечения
    - Адаптируй дозировки под параметры пациента
    - Исключи рекомендации, не подходящие данному пациенту

    ФОРМАТ ОТВЕТА:
    Используй ТОЧНО такие же формулировки как в контексте. Не меняй слова, не перефразируй, не сокращай.

    Пример ПРАВИЛЬНОГО ответа:
    "Рекомендуется оперативное лечение при вывихах в акромиально-ключичном суставе (пластика связок сустава, код медицинской услуги А16.04.037)"

    Пример НЕПРАВИЛЬНОГО ответа:
    "Нужно делать операцию при вывихах в плечевом суставе"

    ОТВЕЧАЙ ТОЛЬКО НА ОСНОВЕ ПРЕДОСТАВЛЕННОГО КОНТЕКСТА БЕЗ ИЗМЕНЕНИЙ!"""

        # Для гепатита
        elif any(keyword in clinical_diagnosis.lower() for keyword in
                 ["хвгс", "гепатит", "гепатит с", "хронический вирусный гепатит"]):
            return f"""Ты - медицинский ассистент, специализирующийся на лечении хронического вирусного гепатита C. 
    СТРОГИЕ ПРАВИЛА:
    1. ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ
    2. ВСЕГДА ИСПОЛЬЗУЙ ДАННЫЕ ПАЦИЕНТА ДЛЯ ФОРМИРОВАНИЯ ОТВЕТА
    3. ИСПОЛЬЗУЙ ТОЛЬКО ТЕКСТ ИЗ ПРЕДОСТАВЛЕННОГО КОНТЕКСТА - НИЧЕГО НЕ ПРИДУМЫВАЙ
    4. НЕ ИЗМЕНЯЙ ТЕРМИНОЛОГИЮ ИЗ КОНТЕКСТА
    5. ЕСЛИ В КОНТЕКСТЕ НЕТ ИНФОРМАЦИИ - СКАЖИ "В предоставленном контексте нет информации"
    6. НЕ ДОБАВЛЯЙ СВОИ ЗНАНИЯ ИЛИ ИНТЕРПРЕТАЦИИ
    7. УБЕРИ РЕКОМЕНДАЦИИ ДЛЯ ДЕТЕЙ, ЕСЛИ ВОЗРАСТ ПАЦИЕНТА >=18


    ДАННЫЕ ПАЦИЕНТА (ОБЯЗАТЕЛЬНО ИСПОЛЬЗОВАТЬ): {patient_data}
    ПРАВИЛА ИСПОЛЬЗОВАНИЯ ДАННЫХ ПАЦИЕНТА:
    - Учитывай возраст пациента при выборе лечения
    - Учитывай противопоказания из анамнеза
    - Учитывай уже проведенные лечения
    - Адаптируй дозировки под параметры пациента
    - Исключи рекомендации, не подходящие данному пациенту


    ФОРМАТ ОТВЕТА:
    Используй ТОЧНО такие же формулировки как в контексте. Не меняй слова, не перефразируй, не сокращай.

    ОТВЕЧАЙ ТОЛЬКО НА ОСНОВЕ ПРЕДОСТАВЛЕННОГО КОНТЕКСТА БЕЗ ИЗМЕНЕНИЙ!"""

        # По умолчанию
        else:
            return f"""Ты - медицинский ассистент. 

    СТРОГИЕ ПРАВИЛА:
    1. ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ
    2. ВСЕГДА ИСПОЛЬЗУЙ ДАННЫЕ ПАЦИЕНТА ДЛЯ ФОРМИРОВАНИЯ ОТВЕТА 
    3. ИСПОЛЬЗУЙ ТОЛЬКО ТЕКСТ ИЗ ПРЕДОСТАВЛЕННОГО КОНТЕКСТА - НИЧЕГО НЕ ПРИДУМЫВАЙ
    4. НЕ ИЗМЕНЯЙ ТЕРМИНОЛОГИЮ ИЗ КОНТЕКСТА
    5. ЕСЛИ В КОНТЕКСТЕ НЕТ ИНФОРМАЦИИ - СКАЖИ "В предоставленном контексте нет информации"
    6. НЕ ДОБАВЛЯЙ СВОИ ЗНАНИЯ ИЛИ ИНТЕРПРЕТАЦИИ
    7. УБЕРИ РЕКОМЕНДАЦИИ ДЛЯ ДЕТЕЙ, ЕСЛИ ВОЗРАСТ ПАЦИЕНТА >=18


    ДАННЫЕ ПАЦИЕНТА (ОБЯЗАТЕЛЬНО ИСПОЛЬЗОВАТЬ): {patient_data}
    ПРАВИЛА ИСПОЛЬЗОВАНИЯ ДАННЫХ ПАЦИЕНТА:
    - Учитывай возраст пациента при выборе лечения
    - Учитывай противопоказания из анамнеза
    - Учитывай уже проведенные лечения
    - Адаптируй дозировки под параметры пациента
    - Исключи рекомендации, не подходящие данному пациенту

    ОТВЕЧАЙ ТОЛЬКО НА ОСНОВЕ ПРЕДОСТАВЛЕННОГО КОНТЕКСТА БЕЗ ИЗМЕНЕНИЙ!"""

    def get_relevant_context(self, rewritten_input, vault_embeddings, vault_content, top_k=3):
        if vault_embeddings.nelement() == 0:
            return []

        # ПРЕДВАРИТЕЛЬНАЯ ФИЛЬТРАЦИЯ: оставляем только параграфы с 3.
        filtered_vault_content = []
        filtered_vault_embeddings = []

        for i, content in enumerate(vault_content):
            if content.strip().startswith('3.'):
                filtered_vault_content.append(content)
                filtered_vault_embeddings.append(vault_embeddings[i])

        print(f"🔍 Из {len(vault_content)} параграфов отфильтровано {len(filtered_vault_content)} с '3.'")

        # Если нет параграфов с 3., возвращаем пустой список
        if len(filtered_vault_content) == 0:
            print("⚠️  Не найдено параграфов, начинающихся с '3.'")
            return []

        # Преобразуем отфильтрованные эмбеддинги в тензор
        filtered_vault_embeddings_tensor = torch.stack(filtered_vault_embeddings)

        # Генерируем эмбеддинг для запроса
        input_embedding = ollama.embeddings(model='nomic-embed-text', prompt=rewritten_input)["embedding"]
        input_embedding_tensor = torch.tensor(input_embedding).unsqueeze(0)

        # Нормализация эмбеддингов
        vault_normalized = torch.nn.functional.normalize(filtered_vault_embeddings_tensor, p=2, dim=1)
        input_normalized = torch.nn.functional.normalize(input_embedding_tensor, p=2, dim=1)

        # 1. Косинусное сходство (основная метрика)
        cos_scores = torch.cosine_similarity(input_normalized, vault_normalized)

        # 2. Евклидово расстояние (дополнительная метрика)
        euclidean_dist = torch.cdist(input_normalized, vault_normalized, p=2).squeeze()
        euclidean_scores = 1 / (1 + euclidean_dist)  # Преобразуем в схожесть

        # 3. Точечное произведение
        dot_scores = torch.matmul(input_normalized, vault_normalized.T).squeeze()

        # Комбинированный скоринг
        combined_scores = (
                0.6 * cos_scores +  # Основной вес
                0.3 * euclidean_scores +  # Дополнительная метрика
                0.1 * dot_scores  # Второстепенная
        )

        # Порог релевантности
        similarity_threshold = 0.80
        above_threshold = combined_scores >= similarity_threshold

        if above_threshold.sum() > 0:
            # Берем только релевантные выше порога
            top_indices = torch.where(above_threshold)[0]
            # Сортируем по убыванию скора
            sorted_scores, sorted_indices = torch.sort(combined_scores[top_indices], descending=True)
            top_indices = top_indices[sorted_indices][:top_k].tolist()
        else:
            # Если ничего выше порога - берем лучшие N
            top_k = min(top_k, len(combined_scores))
            top_indices = torch.topk(combined_scores, k=top_k)[1].tolist()

        # Получаем релевантный контекст из отфильтрованных параграфов
        relevant_context = [filtered_vault_content[idx].strip() for idx in top_indices]

        print(f"✅ Найдено релевантных контекстов с 3.: {len(relevant_context)}")

        # Показываем найденные контексты для отладки
        if relevant_context:
            print("\n🔍 НАЙДЕННЫЕ КОНТЕКСТЫ С 3.:")
            for i, context in enumerate(relevant_context[:3]):  # Показываем первые 3
                preview = context.replace('\n', ' ').strip()[:150]
                print(f"   {i + 1}. {preview}...")

        return relevant_context

    # Формирование запроса для модели
    def rewrite_query(self, user_input_json, conversation_history, ollama_model, patient_data):
        user_input = json.loads(user_input_json)["Исходный запрос"]
        # Эта строка формирует строку context, которая содержит последние два сообщения из истории разговора.
        context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in conversation_history[-2:]])

        # Формируем строку с данными пациента
        patient_info_str = f"""
    Данные пациента:
    {patient_data}
    """

        prompt = f"""Ты - медицинский ассистент. Переформулируй следующий запрос для поиска релевантной медицинской информации. ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ.

    {patient_info_str}

        История разговора:
        {context}

        Исходный запрос: [{user_input}]

        Переписанный запрос: 
        """
        response = self.client.chat.completions.create(
            model=ollama_model,
            messages=[{"role": "system", "content": prompt}],
            max_tokens=4000,
            n=1,
            temperature=0.1,
            timeout=200

        )
        rewritten_query = response.choices[0].message.content.strip()
        return json.dumps({"Переписанный запрос": rewritten_query})

    def ollama_chat(self, user_input, system_message, vault_embeddings, vault_content, ollama_model, conversation_history,
                    patient_data):
        # Добавление пользовательского ввода в историю
        conversation_history.append({"role": "user", "content": user_input})
        # Переписывание запроса
        if len(conversation_history) > 1:
            query_json = {
                "Исходный запрос": user_input,
                "Переписанный запрос": ""
            }
            rewritten_query_json = self.rewrite_query(json.dumps(query_json), conversation_history, ollama_model, patient_data)
            rewritten_query_data = json.loads(rewritten_query_json)
            rewritten_query = rewritten_query_data["Переписанный запрос"]
            print(self.PINK + "Исходный запрос: " + user_input + self.RESET_COLOR)
            print(self.PINK + "Переписанный запрос: " + rewritten_query + self.RESET_COLOR)
        else:
            rewritten_query = user_input
        # Извлечение релевантного контекста
        relevant_context = self.get_relevant_context(rewritten_query, vault_embeddings, vault_content)
        if relevant_context:
            context_str = "\n".join(relevant_context)
            print("контекст найден: \n\n" + self.CYAN + context_str + self.RESET_COLOR)
            # Добавляем строгое указание использовать только контекст
            strict_context_instruction = """
            ВАЖНО: Используй ТОЛЬКО информацию из предоставленного контекста. 
            НЕ придумывай, НЕ интерпретируй, НЕ изменяй терминологию.
            Копируй точные формулировки из контекста.
            """
            user_input_with_context = user_input + strict_context_instruction + "\n\nРелевантный контекст:\n" + context_str
        else:
            print(self.CYAN + "контекст не найден" + self.RESET_COLOR)
            user_input_with_context = user_input + "\n\nВАЖНО: Контекст не найден. Ответь: 'В предоставленном контексте нет информации по данному вопросу.'"

        # Обновление истории разговора
        conversation_history[-1]["content"] = user_input_with_context

        # Формирование сообщений для модели
        messages = [
            {"role": "system", "content": system_message},
            *conversation_history
        ]
        # Получение ответа от модели
        response = self.client.chat.completions.create(
            model=ollama_model,
            messages=messages,
            max_tokens=4000,  # Увеличил лимит токенов для более полного ответа
            temperature=0.1  # Уменьшаем температуру для более детерминированного ответа
        )

        conversation_history.append({"role": "assistant", "content": response.choices[0].message.content})

        return response.choices[0].message.content




    def generate_embeddings(self, vault_content):
        """
        Генерация эмбеддингов для содержимого хранилища
        """
        print(self.NEON_GREEN + "Генерация эмбеддингов..." + self.RESET_COLOR)
        vault_embeddings = []

        for content in vault_content:
            response = ollama.embeddings(model='nomic-embed-text', prompt=content)
            vault_embeddings.append(response["embedding"])

        # Преобразование эмбеддингов в тензор
        print("Преобразование эмбеддингов в тензор...")
        vault_embeddings_tensor = torch.tensor(vault_embeddings)
        print(f"Размер тензора эмбеддингов: {vault_embeddings_tensor.shape}")

        return vault_embeddings_tensor



    def initialize_system(self, data_path=None):
        """Полная инициализация системы"""
        if data_path is None:
            # Используем папку в домашней директории пользователя
            data_path = os.path.join(os.path.expanduser("~"), "MedicalAssistant", "ИБ")

        print(f"Используем путь: {data_path}")
        self.patient_data = self.load_patient_data_simple(data_path)

        if self.patient_data:
            self.vault_content = self.load_relevant_paragraphs(self.patient_data)
            self.vault_embeddings_tensor = self.generate_embeddings(self.vault_content)
        else:
            print("Не удалось загрузить данные пациента")