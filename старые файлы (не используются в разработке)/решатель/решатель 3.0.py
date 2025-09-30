import json
from typing import Dict, Any, List, Optional, Union

class MedicalDecisionSystem:
    def __init__(self, knowledge_base_path: str):
        self.knowledge_base = self._load_knowledge_base(knowledge_base_path)
    
    def _load_knowledge_base(self, file_path: str) -> Dict:
        """Загрузка базы знаний с обработкой ошибок"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            raise Exception(f"Ошибка загрузки базы знаний: {str(e)}")

    def process_patient_case(self, case_data: Dict) -> Dict:
        """
        Основной метод обработки случая пациента
        Возвращает структуру с рекомендациями
        """
        result = {
            "diagnosis": None,
            "patient_data": {},
            "treatment_options": [],
            "warnings": [],
            "errors": []
        }

        try:
            # Извлечение данных пациента
            result["patient_data"] = self._extract_patient_data(case_data)
            
            # Определение основного диагноза
            result["diagnosis"] = self._determine_primary_diagnosis(result["patient_data"])
            
            if not result["diagnosis"]:
                result["errors"].append("Не удалось определить основной диагноз")
                return result
            
            # Поиск рекомендаций в базе знаний
            treatment_options = self._find_treatment_options(result["diagnosis"], result["patient_data"])
            
            if not treatment_options:
                result["errors"].append("Для данного диагноза не найдено рекомендаций в базе знаний")
                return result
            
            # Фильтрация и ранжирование вариантов лечения
            result["treatment_options"] = self._filter_and_rank_treatments(treatment_options)
            
            # Проверка на предупреждения
            result["warnings"] = self._check_for_warnings(result["patient_data"])
            
        except Exception as e:
            result["errors"].append(f"Ошибка обработки данных: {str(e)}")
        
        return result

    def _extract_patient_data(self, case_data: Dict) -> Dict:
        """Извлечение и структурирование данных пациента"""
        patient_data = {
            "demographics": {},
            "diagnoses": [],
            "symptoms": {},
            "examinations": {},
            "treatments": {},
            "laboratory": {},
            "special_factors": {}
        }

        # 1. Паспортные данные
        if "Паспортная часть" in case_data:
            passport = case_data["Паспортная часть"].get("Факт", {})
            for key, value in passport.items():
                if "Числовые значения" in value:
                    patient_data["demographics"][key] = value["Числовые значения"]["значение"]
                elif "Качественные значения" in value:
                    patient_data["demographics"][key] = value["Качественные значения"]["значение"][0]

        # 2. Диагнозы и жалобы
        if "Жалобы" in case_data:
            for item in case_data["Жалобы"].get("Признак", []):
                for key, value in item.items():
                    if key == "Клинический диагноз":
                        patient_data["diagnoses"].append(value["Качественные значения"]["значение"][0])
                    elif key == "Сопутствующий диагноз":
                        patient_data["diagnoses"].extend(value["Качественные значения"]["значение"])
                    elif "Качественные значения" in value:
                        patient_data["symptoms"][key] = value["Качественные значения"]["значение"][0]

        # 3. Объективные данные осмотра
        if "Объективное состояние" in case_data:
            exam = case_data["Объективное состояние"].get("Общий осмотр", {}).get("Признак", [])
            for item in exam:
                for key, value in item.items():
                    if "Числовые значения" in value:
                        patient_data["examinations"][key] = {
                            "value": value["Числовые значения"]["значение"],
                            "unit": value["Числовые значения"].get("единица измерения", "")
                        }
                    elif "Качественные значения" in value:
                        patient_data["examinations"][key] = value["Качественные значения"]["значение"][0]

        # 4. Данные о лечении
        if "Лечение, назначенное врачом" in case_data:
            therapies = case_data["Лечение, назначенное врачом"].get("Медикаментозная терапия", {})
            for therapy in therapies.values():
                treatment = therapy.get("запись о лечении", {})
                for key, value in treatment.items():
                    if isinstance(value, dict) and "Качественные значения" in value:
                        patient_data["treatments"][key] = value["Качественные значения"]["значение"][0]

        return patient_data

    def _determine_primary_diagnosis(self, patient_data: Dict) -> Optional[str]:
        """Определение основного диагноза"""
        if not patient_data.get("diagnoses"):
            return None
        
        # Ищем диагнозы, которые есть в нашей базе знаний
        known_diagnoses = self.knowledge_base.get("КлинРек II ур", {}).get("Заболевание", {}).keys()
        
        for diagnosis in patient_data["diagnoses"]:
            if diagnosis in known_diagnoses:
                return diagnosis
        
        # Если точного совпадения нет, ищем частичное
        for diagnosis in patient_data["diagnoses"]:
            for known_diagnosis in known_diagnoses:
                if diagnosis.lower() in known_diagnosis.lower() or known_diagnosis.lower() in diagnosis.lower():
                    return known_diagnosis
        
        return None

    def _find_treatment_options(self, diagnosis: str, patient_data: Dict) -> List[Dict]:
        """Поиск вариантов лечения в базе знаний"""
        disease_node = self.knowledge_base.get("КлинРек II ур", {}).get("Заболевание", {}).get(diagnosis)
        if not disease_node:
            return []
        
        treatment_options = []
        
        # Проверяем все варианты течения заболевания
        for variant_name, variant_data in disease_node.get("Вариант течения (функциональный класс)", {}).items():
            for instruction in variant_data.get("Инструкция", {}).values():
                plan = instruction.get("План лечебных действий", {})
                patient_conditions = instruction.get("Категория пациента", {})
                
                # Проверяем соответствие пациента условиям
                match_result = self._check_patient_match(patient_conditions, patient_data)
                
                treatment_option = {
                    "variant": variant_name,
                    "goals": self._extract_treatment_goals(plan),
                    "medications": self._extract_medications(plan),
                    "match_score": match_result["score"],
                    "matches": match_result["matches"],
                    "mismatches": match_result["mismatches"],
                    "missing_data": match_result["missing"]
                }
                
                treatment_options.append(treatment_option)
        
        return treatment_options

    def _extract_treatment_goals(self, plan: Dict) -> List[str]:
        """Извлечение целей лечения в читаемом формате"""
        goals = []
        
        for goal in plan.get("Цель", {}).values():
            if "устранить" in goal:
                target = self._get_observation_name(goal["устранить"])
                goals.append(f"Устранить {target}")
            elif "снизить" in goal:
                target = self._get_observation_name(goal["снизить"])
                goals.append(f"Нормализовать {target}")
            elif "достичь" in goal:
                goals.append(f"Достичь {goal['достичь']}")
        
        return goals

    def _get_observation_name(self, observation: Dict) -> str:
        """Получение названия наблюдаемого параметра"""
        if "Наблюдение" in observation:
            return next(iter(observation["Наблюдение"].keys()), "показатель")
        return "показатель"

    def _extract_medications(self, plan: Dict) -> List[Dict]:
        """Извлечение информации о лекарствах"""
        medications = []
        
        for treatment in plan.get("вариант лечения", {}).values():
            if "медикаментозное" not in treatment:
                continue
                
            med = treatment["медикаментозное"]
            med_info = {"type": "Медикаментозная терапия", "details": []}
            
            if "комбинация" in med:
                substances = list(med["комбинация"].get("Действующее вещество", {}).keys())
                med_info["details"].append({
                    "type": "Комбинация препаратов",
                    "substances": substances
                })
            
            if "группа" in med:
                for group, data in med["группа"].items():
                    substances = list(data.get("Действующее вещество", {}).keys())
                    med_info["details"].append({
                        "type": f"Группа препаратов: {group}",
                        "substances": substances
                    })
            
            if "препарат 1-й линии" in med:
                if "группа" in med["препарат 1-й линии"]:
                    for group, data in med["препарат 1-й линии"]["группа"].items():
                        substances = list(data.get("Действующее вещество", {}).keys())
                        med_info["details"].append({
                            "type": f"Препараты первой линии ({group})",
                            "substances": substances
                        })
            
            if med_info["details"]:
                medications.append(med_info)
        
        return medications

    def _check_patient_match(self, conditions: Dict, patient_data: Dict) -> Dict:
        """Проверка соответствия пациента условиям рекомендации"""
        result = {
            "score": 0,
            "matches": [],
            "mismatches": [],
            "missing": []
        }
        
        total_conditions = 0
        matched_conditions = 0
        
        # Проверка факторов (возраст, пол, анамнез и т.д.)
        for factor, values in conditions.get("Фактор", {}).items():
            total_conditions += 1
            
            if factor not in patient_data.get("demographics", {}) and factor not in patient_data.get("special_factors", {}):
                result["missing"].append(f"Отсутствует информация о факторе: {factor}")
                continue
                
            patient_value = patient_data.get("demographics", {}).get(factor) or patient_data.get("special_factors", {}).get(factor)
            expected_values = values.get("значение", [])
            
            if isinstance(expected_values, list):
                if patient_value in expected_values:
                    matched_conditions += 1
                    result["matches"].append(f"Фактор '{factor}': соответствует")
                else:
                    result["mismatches"].append(
                        f"Фактор '{factor}': значение '{patient_value}' не соответствует ожидаемым {expected_values}"
                    )
            else:
                if str(patient_value) == str(expected_values):
                    matched_conditions += 1
                    result["matches"].append(f"Фактор '{factor}': соответствует")
                else:
                    result["mismatches"].append(
                        f"Фактор '{factor}': значение '{patient_value}' не соответствует ожидаемому '{expected_values}'"
                    )
        
        # Проверка наблюдений (лабораторные данные, измерения)
        for observation in conditions.get("Наблюдение", []):
            if not isinstance(observation, dict):
                continue
                
            for obs_key, obs_data in observation.items():
                total_conditions += 1
                
                if obs_key not in patient_data.get("examinations", {}) and obs_key not in patient_data.get("laboratory", {}):
                    result["missing"].append(f"Отсутствует информация о наблюдении: {obs_key}")
                    continue
                    
                patient_value = patient_data.get("examinations", {}).get(obs_key, {}).get("value") or patient_data.get("laboratory", {}).get(obs_key)
                
                if "Числовое значение" in obs_data:
                    num_data = obs_data["Числовое значение"]
                    lower = num_data.get("нижняя граница", float('-inf'))
                    upper = num_data.get("верхняя граница", float('inf'))
                    
                    if lower <= patient_value <= upper:
                        matched_conditions += 1
                        result["matches"].append(f"Наблюдение '{obs_key}': в норме")
                    else:
                        result["mismatches"].append(
                            f"Наблюдение '{obs_key}': значение {patient_value} вне диапазона {lower}-{upper}"
                        )
                
                elif "Качественное значение" in obs_data:
                    expected = list(obs_data["Качественное значение"].keys())[0]
                    if patient_value == expected:
                        matched_conditions += 1
                        result["matches"].append(f"Наблюдение '{obs_key}': соответствует")
                    else:
                        result["mismatches"].append(
                            f"Наблюдение '{obs_key}': значение '{patient_value}' не соответствует '{expected}'"
                        )
        
        # Расчет оценки соответствия (в процентах)
        if total_conditions > 0:
            result["score"] = int((matched_conditions / total_conditions) * 100)
        
        return result

    def _filter_and_rank_treatments(self, treatments: List[Dict]) -> List[Dict]:
        """Фильтрация и ранжирование вариантов лечения"""
        # Сначала сортируем по степени соответствия
        sorted_treatments = sorted(treatments, key=lambda x: x["match_score"], reverse=True)
        
        # Затем группируем по степени соответствия
        perfect_matches = [t for t in sorted_treatments if t["match_score"] == 100]
        good_matches = [t for t in sorted_treatments if 80 <= t["match_score"] < 100]
        partial_matches = [t for t in sorted_treatments if 50 <= t["match_score"] < 80]
        poor_matches = [t for t in sorted_treatments if t["match_score"] < 50]
        
        # Возвращаем лучшие варианты (полностью подходящие или наиболее близкие)
        if perfect_matches:
            return perfect_matches[:3]  # Не более 3 лучших вариантов
        elif good_matches:
            return good_matches[:2]
        elif partial_matches:
            return partial_matches[:1]
        else:
            return poor_matches[:1]

    def _check_for_warnings(self, patient_data: Dict) -> List[str]:
        """Проверка на потенциальные проблемы/предупреждения"""
        warnings = []
        
        # Проверка критических показателей
        if "Систолическое артериальное давление" in patient_data.get("examinations", {}):
            sbp = patient_data["examinations"]["Систолическое артериальное давление"]["value"]
            if sbp > 140:
                warnings.append(f"Повышенное систолическое давление: {sbp} мм рт.ст.")
            elif sbp < 90:
                warnings.append(f"Пониженное систолическое давление: {sbp} мм рт.ст.")
        
        if "Диастолическое артериальное давление" in patient_data.get("examinations", {}):
            dbp = patient_data["examinations"]["Диастолическое артериальное давление"]["value"]
            if dbp > 90:
                warnings.append(f"Повышенное диастолическое давление: {dbp} мм рт.ст.")
            elif dbp < 60:
                warnings.append(f"Пониженное диастолическое давление: {dbp} мм рт.ст.")
        
        if "Частота сердечных сокращений" in patient_data.get("examinations", {}):
            hr = patient_data["examinations"]["Частота сердечных сокращений"]["value"]
            if hr > 100:
                warnings.append(f"Тахикардия: ЧСС {hr} уд/мин")
            elif hr < 50:
                warnings.append(f"Брадикардия: ЧСС {hr} уд/мин")
        
        # Проверка на конфликтующие диагнозы
        if "Цирроз печени" in patient_data.get("diagnoses", []) and "АГ" in patient_data.get("diagnoses", []):
            warnings.append("Сочетание цирроза печени и артериальной гипертензии требует особого подхода к лечению")
        
        return warnings


def print_recommendations(result: Dict):
    """Красивый вывод рекомендаций для врача/пациента"""
    print("\n" + "="*80)
    print(" МЕДИЦИНСКИЕ РЕКОМЕНДАЦИИ ".center(80, "="))
    print("="*80)
    
    # Основная информация
    print(f"\nОсновной диагноз: {result.get('diagnosis', 'не определен')}")
    
    if result.get('warnings'):
        print("\n⚠ ВНИМАНИЕ:")
        for warning in result['warnings']:
            print(f"  • {warning}")
    
    if result.get('errors'):
        print("\n❌ ОШИБКИ:")
        for error in result['errors']:
            print(f"  • {error}")
        return
    
    if not result.get('treatment_options'):
        print("\nДля данного случая не найдено конкретных рекомендаций.")
        print("Пожалуйста, проконсультируйтесь со специалистом.")
        return
    
    # Варианты лечения
    print("\nВАРИАНТЫ ЛЕЧЕНИЯ:")
    for i, option in enumerate(result['treatment_options'], 1):
        print(f"\n{' Вариант ' + str(i) + ' ':-^80}")
        
        # Описание варианта
        print(f"\nПоказание: {option['variant']}")
        print(f"Степень соответствия: {option['match_score']}%")
        
        # Цели лечения
        if option['goals']:
            print("\nЦели лечения:")
            for goal in option['goals']:
                print(f"  • {goal}")
        
        # Лекарства
        if option['medications']:
            print("\nРекомендуемая терапия:")
            for med in option['medications']:
                print(f"  {med['type']}:")
                for detail in med['details']:
                    if len(detail['substances']) > 1:
                        print(f"    • Комбинация: {', '.join(detail['substances'])}")
                    else:
                        print(f"    • {detail['substances'][0]}")
        
        # Соответствие критериям
        if option['matches']:
            print("\nСоответствует критериям:")
            for match in option['matches'][:3]:  # Показываем не более 3 соответствий
                print(f"  ✓ {match}")
        
        if option['mismatches']:
            print("\nНесоответствия:")
            for mismatch in option['mismatches'][:3]:  # Показываем не более 3 несоответствий
                print(f"  ✗ {mismatch}")
        
        if option['missing_data']:
            print("\nНедостающие данные:")
            for missing in option['missing_data'][:2]:  # Показываем не более 2 недостающих данных
                print(f"  ? {missing}")
        
        print(f"\n{' Конец варианта ' + str(i) + ' ':-^80}")

def main():
    try:
        # Инициализация системы
        decision_system = MedicalDecisionSystem('БЗ по КлинРек.simple.json')
        
        # Загрузка истории болезни
        with open('история_болезни.json', 'r', encoding='utf-8') as f:
            case_data = json.load(f)["История болезни или наблюдений v.4"]
            first_case = next(iter(case_data.values()))
        
        # Обработка случая
        result = decision_system.process_patient_case(first_case)
        
        # Вывод результатов
        print_recommendations(result)
        
    except Exception as e:
        print(f"\nОшибка при выполнении программы: {str(e)}")

if __name__ == "__main__":
    main()