import json
from typing import Dict, Any, List, Optional

class MedicalDecisionSystem:
    def __init__(self, knowledge_base_path: str):
        self.knowledge_base = self._load_json(knowledge_base_path)

    def _load_json(self, file_path: str) -> Dict:
        """Загрузка JSON файла с обработкой ошибок"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise Exception(f"Файл {file_path} не найден")
        except json.JSONDecodeError:
            raise Exception(f"Ошибка декодирования JSON в файле {file_path}")

    def process_case(self, case_data: Dict) -> Dict:
        """
        Основной метод обработки случая
        Возвращает структуру с диагнозом, подобранным лечением и объяснением
        """
        result = {
            "diagnosis": None,
            "treatment_plans": [],
            "explanations": [],
            "errors": []
        }

        # 1. Извлечение диагноза
        diagnosis = self._extract_diagnosis(case_data)
        if not diagnosis:
            result["errors"].append("Диагноз не найден в истории болезни")
            return result

        result["diagnosis"] = diagnosis

        # 2. Извлечение данных пациента
        patient_data = self._extract_patient_data(case_data)

        # 3. Поиск заболевания в базе знаний
        disease_node = self._find_disease_node(diagnosis)
        if not disease_node:
            result["errors"].append(f"Заболевание '{diagnosis}' не найдено в базе знаний")
            return result

        # 4. Поиск подходящих вариантов лечения
        treatment_plans = self._find_treatment_plans(disease_node, patient_data)

        if not treatment_plans:
            result["errors"].append("Не найдено подходящих планов лечения")
            return result

        result["treatment_plans"] = treatment_plans
        return result

    def _extract_diagnosis(self, case_data: Dict) -> Optional[str]:
        """Извлечение диагноза из истории болезни"""
        # Проверяем разные возможные места нахождения диагноза
        possible_locations = [
            ["Жалобы", "Признак", "Клинический диагноз"],
            ["Жалобы", "Признак", "Диагноз"],
            ["Объективное состояние", "Общий осмотр", "Признак", "Диагноз"],
            ["Диагноз"]
        ]

        for location in possible_locations:
            try:
                current = case_data
                for key in location:
                    if isinstance(current, list):
                        for item in current:
                            if key in item:
                                current = item[key]
                                break
                        else:
                            raise KeyError
                    else:
                        current = current[key]

                if isinstance(current, dict) and "Качественные значения" in current:
                    return current["Качественные значения"]["значение"][0]
                elif isinstance(current, str):
                    return current
            except (KeyError, TypeError):
                continue

        return None

    def _extract_patient_data(self, case_data: Dict) -> Dict:
        """Извлечение данных пациента из истории болезни"""
        patient_data = {}

        # 1. Паспортные данные
        if "Паспортная часть" in case_data:
            passport = case_data["Паспортная часть"].get("Факт", {})
            if "Возраст" in passport:
                patient_data["Возраст"] = passport["Возраст"]["Числовые значения"]["значение"]
            if "Пол" in passport:
                patient_data["Пол"] = passport["Пол"]["Качественные значения"]["значение"][0]

        # 2. Жалобы и симптомы
        if "Жалобы" in case_data:
            for symptom in case_data["Жалобы"].get("Признак", []):
                for key, value in symptom.items():
                    if isinstance(value, dict) and "Качественные значения" in value:
                        patient_data[key] = value["Качественные значения"]["значение"][0]
                    elif isinstance(value, dict) and "Числовые значения" in value:
                        patient_data[key] = value["Числовые значения"]["значение"]

        # 3. Объективное состояние
        if "Объективное состояние" in case_data:
            for symptom in case_data["Объективное состояние"].get("Общий осмотр", {}).get("Признак", []):
                for key, value in symptom.items():
                    if isinstance(value, dict) and "Качественные значения" in value:
                        patient_data[key] = value["Качественные значения"]["значение"][0]
                    elif isinstance(value, dict) and "Числовые значения" in value:
                        patient_data[key] = value["Числовые значения"]["значение"]

        # 4. Данные лечения
        if "Лечение, назначенное врачом" in case_data:
            for therapy in case_data["Лечение, назначенное врачом"].get("Медикаментозная терапия", {}).values():
                for key, value in therapy.get("запись о лечении", {}).items():
                    if isinstance(value, dict):
                        if "Качественные значения" in value:
                            patient_data[key] = value["Качественные значения"]["значение"][0]
                        elif "Характеристика" in value:
                            # Для сложных данных типа генотипа
                            patient_data[key] = self._extract_complex_value(value)

        return patient_data

    def _extract_complex_value(self, value: Dict) -> Dict:
        """Извлечение сложных структур данных (например, генотипа)"""
        if "Характеристика" in value and "Результат" in value["Характеристика"]:
            if "Качественное значение" in value["Характеристика"]["Результат"]:
                return value["Характеристика"]["Результат"]["Качественное значение"]
        return {}

    def _find_disease_node(self, diagnosis: str) -> Optional[Dict]:
        """Поиск узла заболевания в базе знаний"""
        diseases = self.knowledge_base.get("КлинРек II ур", {}).get("Заболевание", {})

        # 1. Точное совпадение
        if diagnosis in diseases:
            return diseases[diagnosis]

        # 2. Частичное совпадение
        for disease_name, disease_data in diseases.items():
            if disease_name.lower() in diagnosis.lower() or diagnosis.lower() in disease_name.lower():
                return disease_data

        return None

    def _find_treatment_plans(self, disease_node: Dict, patient_data: Dict) -> List[Dict]:
        """Поиск подходящих планов лечения"""
        treatment_plans = []

        # Проверяем все варианты течения заболевания
        for variant_name, variant_data in disease_node.get("Вариант течения (функциональный класс)", {}).items():
            for instruction in variant_data.get("Инструкция", {}).values():
                plan = instruction.get("План лечебных действий", {})

                # Проверяем соответствие пациента условиям
                if self._check_patient_conditions(plan, patient_data):
                    treatment_plan = {
                        "variant": variant_name,
                        "goals": [],
                        "treatments": [],
                        "patient_conditions": []
                    }

                    # Извлекаем цели лечения
                    if "Цель" in plan:
                        for goal in plan["Цель"].values():
                            if "устранить" in goal:
                                treatment_plan["goals"].append(f"Устранить: {goal['устранить']}")
                            elif "снизить" in goal:
                                treatment_plan["goals"].append(f"Снизить: {goal['снизить']}")

                    # Извлекаем варианты лечения
                    if "вариант лечения" in plan:
                        for treatment in plan["вариант лечения"].values():
                            if "медикаментозное" in treatment:
                                med = treatment["медикаментозное"]
                                if "комбинация" in med:
                                    substances = list(med["комбинация"].get("Действующее вещество", {}).keys())
                                    treatment_plan["treatments"].append({
                                        "type": "комбинация препаратов",
                                        "substances": substances
                                    })
                                elif "группа" in med:
                                    for group, data in med["группа"].items():
                                        substances = list(data.get("Действующее вещество", {}).keys())
                                        treatment_plan["treatments"].append({
                                            "type": f"группа: {group}",
                                            "substances": substances
                                        })

                    # Добавляем объяснение соответствия пациента
                    if "Категория пациента" in instruction:
                        treatment_plan["patient_conditions"] = self._explain_patient_conditions(
                            instruction["Категория пациента"], patient_data
                        )

                    treatment_plans.append(treatment_plan)

        return treatment_plans

    def _check_patient_conditions(self, plan: Dict, patient_data: Dict) -> bool:
        """Проверка соответствия пациента условиям плана лечения"""
        # Если нет условий - подходит всем
        if "Категория пациента" not in plan:
            return True

        # Проверяем факторы
        if "Фактор" in plan["Категория пациента"]:
            for factor, values in plan["Категория пациента"]["Фактор"].items():
                if factor not in patient_data:
                    return False

                if isinstance(values.get("значение"), list):
                    if patient_data[factor] not in values["значение"]:
                        return False
                else:
                    if str(patient_data[factor]) != str(values.get("значение")):
                        return False

        # Проверяем наблюдения (например, генотип)
        if "Наблюдение" in plan["Категория пациента"]:
            for observation in plan["Категория пациента"]["Наблюдение"]:
                if not isinstance(observation, dict):
                    continue

                for obs_key, obs_data in observation.items():
                    if obs_key not in patient_data:
                        return False

                    if "Характеристика" in obs_data:
                        for char_name, char_data in obs_data["Характеристика"].items():
                            if "Качественное значение" in char_data:
                                expected_values = list(char_data["Качественное значение"].keys())
                                if not any(v in patient_data[obs_key] for v in expected_values):
                                    return False

        return True

    def _explain_patient_conditions(self, conditions: Dict, patient_data: Dict) -> List[str]:
        """Генерация объяснения соответствия пациента условиям"""
        explanations = []

        if "Фактор" in conditions:
            for factor, values in conditions["Фактор"].items():
                if factor in patient_data:
                    if isinstance(values.get("значение"), list):
                        if patient_data[factor] in values["значение"]:
                            explanations.append(
                                f"Фактор '{factor}': значение '{patient_data[factor]}' "
                                f"соответствует допустимым {values['значение']}"
                            )
                        else:
                            explanations.append(
                                f"Фактор '{factor}': значение '{patient_data[factor]}' "
                                f"не соответствует допустимым {values['значение']}"
                            )
                    else:
                        if str(patient_data[factor]) == str(values.get("значение")):
                            explanations.append(
                                f"Фактор '{factor}': значение '{patient_data[factor]}' "
                                f"соответствует требуемому '{values['значение']}'"
                            )
                        else:
                            explanations.append(
                                f"Фактор '{factor}': значение '{patient_data[factor]}' "
                                f"не соответствует требуемому '{values['значение']}'"
                            )
                else:
                    explanations.append(f"Фактор '{factor}': отсутствует в истории болезни")

        if "Наблюдение" in conditions:
            for observation in conditions["Наблюдение"]:
                if isinstance(observation, dict):
                    for obs_key, obs_data in observation.items():
                        if obs_key in patient_data:
                            if "Характеристика" in obs_data:
                                for char_name, char_data in obs_data["Характеристика"].items():
                                    if "Качественное значение" in char_data:
                                        expected_values = list(char_data["Качественное значение"].keys())
                                        if any(v in patient_data[obs_key] for v in expected_values):
                                            explanations.append(
                                                f"Наблюдение '{obs_key}': значение соответствует одному из {expected_values}"
                                            )
                                        else:
                                            explanations.append(
                                                f"Наблюдение '{obs_key}': значение не соответствует ни одному из {expected_values}"
                                            )
                            else:
                                explanations.append(f"Наблюдение '{obs_key}': проверено")
                        else:
                            explanations.append(f"Наблюдение '{obs_key}': отсутствует в истории болезни")

        return explanations


def main():
    try:
        # Инициализация системы с базой знаний
        decision_system = MedicalDecisionSystem('БЗ по КлинРек.simple.json')

        # Загрузка истории болезни
        with open('история_болезни.json', 'r', encoding='utf-8') as f:
            case_data = json.load(f)["История болезни или наблюдений v.4"]
            first_case = next(iter(case_data.values()))

        # Обработка случая
        result = decision_system.process_case(first_case)

        # Вывод результатов
        print("Результаты анализа:")
        print(f"Диагноз: {result['diagnosis']}")

        if result['errors']:
            print("\nОшибки:")
            for error in result['errors']:
                print(f"- {error}")

        if result['treatment_plans']:
            print("\nНайдены подходящие планы лечения:")
            for i, plan in enumerate(result['treatment_plans'], 1):
                print(f"\nВариант {i}: {plan['variant']}")

                if plan['goals']:
                    print("  Цели лечения:")
                    for goal in plan['goals']:
                        print(f"  - {goal}")

                if plan['treatments']:
                    print("  Варианты лечения:")
                    for treatment in plan['treatments']:
                        print(f"  - Тип: {treatment['type']}")
                        if treatment['substances']:
                            print("    Препараты:")
                            for substance in treatment['substances']:
                                print(f"    - {substance}")

                if plan['patient_conditions']:
                    print("  Обоснование:")
                    for condition in plan['patient_conditions']:
                        print(f"  - {condition}")

    except Exception as e:
        print(f"Произошла ошибка: {str(e)}")

if __name__ == "__main__":
    main()