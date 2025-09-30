import json

def find_disease_node(knowledge_base, diagnosis):
    """Находит узел заболевания в базе знаний (адаптировано под вашу структуру)"""
    if "КлинРек II ур" in knowledge_base and "Заболевание" in knowledge_base["КлинРек II ур"]:
        diseases = knowledge_base["КлинРек II ур"]["Заболевание"]

        # Сначала ищем точное совпадение
        if diagnosis in diseases:
            return {"name": diagnosis, **diseases[diagnosis]}

        # Затем ищем частичное совпадение (если диагноз содержит ключевые слова)
        for disease_name, disease_data in diseases.items():
            if disease_name in diagnosis or diagnosis in disease_name:
                return {"name": disease_name, **disease_data}

    return None

def match_factors(patient_data, factors):
    """Сопоставляет факторы пациента с условиями в базе знаний"""
    explanations = []
    for factor in factors:
        factor_name = factor["name"]
        if "value" in factor:
            # Обработка обычных факторов
            kb_values = factor["value"]
            patient_value = patient_data.get(factor_name)

            if not patient_value:
                explanations.append(f"<{factor_name} неизвестен>")
            elif isinstance(kb_values, list) and patient_value in kb_values:
                explanations.append(f"<{factor_name}, {patient_value}>")
            elif str(patient_value) == str(kb_values):
                explanations.append(f"<{factor_name}, {patient_value}>")
            else:
                explanations.append(f"<невозможно, т.к. {factor_name} + {kb_values}>")

        elif "Характеристика" in factor:
            # Обработка характеристик
            for char_name, char_data in factor["Характеристика"].items():
                if "Качественное значение" in char_data:
                    kb_values = list(char_data["Качественное значение"].keys())
                    patient_value = patient_data.get(f"{factor_name}_{char_name}")

                    if not patient_value:
                        explanations.append(f"<{factor_name}_{char_name} неизвестен>")
                    elif patient_value in kb_values:
                        explanations.append(f"<{factor_name}_{char_name}, {patient_value}>")
                    else:
                        explanations.append(f"<невозможно, т.к. {factor_name}_{char_name} + {kb_values}>")

    return explanations

def extract_diagnosis_from_ib(ib_data):
    """Извлекает диагноз из структуры истории болезни"""
    # Проверяем жалобы
    if "Жалобы" in ib_data and "Признак" in ib_data["Жалобы"]:
        for symptom in ib_data["Жалобы"]["Признак"]:
            if isinstance(symptom, dict):
                if "Клинический диагноз" in symptom:
                    return symptom["Клинический диагноз"]["Качественные значения"]["значение"][0]
                if "Сопутствующий диагноз" in symptom:
                    return symptom["Сопутствующий диагноз"]["Качественные значения"]["значение"][0]
                if "Диагноз" in symptom:
                    return symptom["Диагноз"]["Качественные значения"]["значение"][0]

    # Проверяем объективное состояние
    if "Объективное состояние" in ib_data and "Общий осмотр" in ib_data["Объективное состояние"]:
        for symptom in ib_data["Объективное состояние"]["Общий осмотр"]["Признак"]:
            if isinstance(symptom, dict):
                if "Диагноз" in symptom:
                    return symptom["Диагноз"]["Качественные значения"]["значение"][0]

    return None

def extract_patient_data(ib_data):
    """Извлекает данные пациента из истории болезни"""
    patient_data = {}

    # Паспортные данные
    if "Паспортная часть" in ib_data and "Факт" in ib_data["Паспортная часть"]:
        fact = ib_data["Паспортная часть"]["Факт"]
        if "Возраст" in fact:
            patient_data["Возраст"] = fact["Возраст"]["Числовые значения"]["значение"]
        if "Национальность" in fact:
            patient_data["Национальность"] = fact["Национальность"]["Качественные значения"]["значение"][0]

    # Жалобы
    if "Жалобы" in ib_data and "Признак" in ib_data["Жалобы"]:
        for symptom in ib_data["Жалобы"]["Признак"]:
            for key, value in symptom.items():
                if "Качественные значения" in value:
                    patient_data[key] = value["Качественные значения"]["значение"][0]
                elif "Числовые значения" in value:
                    patient_data[key] = value["Числовые значения"]["значение"]

    # Объективное состояние
    if "Объективное состояние" in ib_data:
        if "Общий осмотр" in ib_data["Объективное состояние"] and "Признак" in ib_data["Объективное состояние"]["Общий осмотр"]:
            for symptom in ib_data["Объективное состояние"]["Общий осмотр"]["Признак"]:
                for key, value in symptom.items():
                    if "Качественные значения" in value:
                        patient_data[key] = value["Качественные значения"]["значение"][0]
                    elif "Числовые значения" in value:
                        patient_data[key] = value["Числовые значения"]["значение"]

    return patient_data

def generate_explanation(ib_data, knowledge_base):
    """Генерирует объяснение на основе истории болезни и базы знаний"""
    print("Извлекаем диагноз...")  # Логирование
    diagnosis = extract_diagnosis_from_ib(ib_data)
    if not diagnosis:
        print("Диагноз не найден в истории болезни")  # Логирование
        return "Нет решения: диагноз не указан в истории болезни."

    print(f"Найден диагноз: {diagnosis}")  # Логирование

    # Извлекаем данные пациента
    patient_data = extract_patient_data(ib_data)
    patient_data["Диагноз"] = diagnosis

    print("Ищем заболевание в БЗ...")  # Логирование
    disease_node = find_disease_node(knowledge_base, diagnosis)
    if not disease_node:
        print(f"Заболевание '{diagnosis}' не найдено в БЗ")  # Логирование
        return f"Нет решения: заболевание '{diagnosis}' не найдено в базе знаний."

    print(f"Найдено заболевание в БЗ: {disease_node['name']}")  # Логирование
    # Остальной код без изменений...

    explanations = []

    # Обработка вариантов течения
    if "Вариант течения (функциональный класс)" in disease_node:
        for variant_name, variant_data in disease_node["Вариант течения (функциональный класс)"].items():
            if "Инструкция" in variant_data:
                for instr_num, instruction in variant_data["Инструкция"].items():
                    if "План лечебных действий" in instruction:
                        plan = instruction["План лечебных действий"]
                        explanations.append(f"<{diagnosis}:{variant_name}")

                        # Обработка вариантов лечения
                        if "вариант лечения" in plan:
                            for treatment in plan["вариант лечения"].values():
                                if "медикаментозное" in treatment:
                                    med = treatment["медикаментозное"]
                                    if "Действующее вещество" in med:
                                        for substance, _ in med["Действующее вещество"].items():
                                            explanations.append(f"<{substance}>")

                    # Обрабатываем категорию пациента
                    if "Категория пациента" in [n.get("name") for n in instruction.get("successors", [])]:
                        for category in instruction.get("successors", []):
                            if category.get("name") == "Категория пациента":
                                # Обрабатываем факторы
                                if "Фактор" in [n.get("name") for n in category.get("successors", [])]:
                                    factors = [n for n in category.get("successors", []) if n.get("name") == "Фактор"]
                                    explanations.extend(match_factors(patient_data, factors))

                                # Обрабатываем наблюдения
                                if "Наблюдение" in [n.get("name") for n in category.get("successors", [])]:
                                    observations = [n for n in category.get("successors", []) if n.get("name") == "Наблюдение"]
                                    explanations.extend(match_factors(patient_data, observations))

                    # Проверяем исключения (если есть)
                    if "Исключить" in [n.get("name") for n in plan.get("successors", [])]:
                        for exclude in plan.get("successors", []):
                            if exclude.get("name") == "Исключить":
                                # Обрабатываем факторы исключения
                                if "Фактор" in [n.get("name") for n in exclude.get("successors", [])]:
                                    factors = [n for n in exclude.get("successors", []) if n.get("name") == "Фактор"]
                                    explanations.extend(match_factors(patient_data, factors))

                                # Обрабатываем наблюдения исключения
                                if "Наблюдение" in [n.get("name") for n in exclude.get("successors", [])]:
                                    observations = [n for n in exclude.get("successors", []) if n.get("name") == "Наблюдение"]
                                    explanations.extend(match_factors(patient_data, observations))

    return "\n".join(explanations) if explanations else "Нет решения: не найдено объяснений."

def main():
    try:
        # Загрузка истории болезни
        with open('история_болезни.json', 'r', encoding='utf-8') as f:
            ib_data = json.load(f)

        # Извлекаем данные первого пациента
        first_patient = next(iter(ib_data["История болезни или наблюдений v.4"].values()))

        # Загрузка базы знаний
        with open('БЗ по КлинРек.simple.json', 'r', encoding='utf-8') as f:
            knowledge_base = json.load(f)

        # Генерация объяснения
        explanation = generate_explanation(first_patient, knowledge_base)
        print(explanation)

    except FileNotFoundError as e:
        print(f"Ошибка: файл не найден. {e}")
    except json.JSONDecodeError:
        print("Ошибка: не удалось декодировать JSON.")
    except Exception as e:
        print(f"Произошла ошибка: {e}")

if __name__ == "__main__":
    main()