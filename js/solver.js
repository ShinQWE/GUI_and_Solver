// Функции для приоритизации вариантов лечения
function prioritize_treatment_variants(variants_data) {
    if (!variants_data || typeof variantsants_data !== 'object') return variants_data;
    
    const variantsArray = [];
    
    // Преобразуем объект в массив для сортировки
    for (const variant_name in variants_data) {
        variantsArray.push({
            name: variant_name,
            data: variants_data[variant_name],
            specificity: calculate_variant_specificity(variants_data[variant_name])
        });
    }
    
    // Сортируем по специфичности (более специфичные первыми)
    variantsArray.sort((a, b) => b.specificity - a.specificity);
    
    // Преобразуем обратно в объект
    const prioritized = {};
    variantsArray.forEach(variant => {
        prioritized[variant.name] = variant.data;
    });
    
    return prioritized;
}

function calculate_variant_specificity(variant) {
    if (!variant || !variant["Инструкция"]) return 0;
    
    let specificity = 0;
    const instructions = variant["Инструкция"];
    
    for (const instrKey in instructions) {
        const instruction = instructions[instrKey];
        
        // Категория пациента значительно увеличивает специфичность
        if (instruction["Категория пациента"]) {
            const category = instruction["Категория пациента"];
            
            // Факторы сильно увеличивают специфичность
            if (category["Фактор"]) {
                specificity += Object.keys(category["Фактор"]).length * 20;
            }
            
            // Наблюдения увеличивают специфичность
            if (category["Наблюдение"]) {
                if (Array.isArray(category["Наблюдение"])) {
                    specificity += category["Наблюдение"].length * 10;
                } else if (typeof category["Наблюдение"] === 'object') {
                    specificity += Object.keys(category["Наблюдение"]).length * 10;
                }
            }
        }
        
        // Наличие плана лечения увеличивает специфичность
        if (instruction["План лечебных действий"]) {
            specificity += 15;
        }
        
        // Отсутствие категории пациента - общий вариант (меньшая специфичность)
        if (!instruction["Категория пациента"]) {
            specificity -= 10;
        }
    }
    
    return Math.max(0, specificity);
}

// Функция для оценки соответствия варианта (более точная)
function evaluate_variant_match(patient_data, instruction, variant_name) {
    let match_score = 0;
    let max_score = 0;
    const explanations = [];
    let has_contradictions = false;
    let hard_contradiction = false;
    
    // 1. ПРОВЕРКА ПРОТИВОРЕЧИЙ (приоритет №1)
    const contradictions = check_contradictions(patient_data, instruction);
    if (contradictions.length > 0) {
        explanations.push(...contradictions);
        has_contradictions = true;
        hard_contradiction = true;
        match_score = 0;
        
        // Если есть жесткие противоречия, сразу возвращаем результат
        return {
            score: 0,
            explanations,
            has_contradictions: true,
            hard_contradiction: true,
            has_treatment: !!instruction["План лечебных действий"]
        };
    }
    
    // 2. ПРОВЕРКА ФАКТОРОВ СООТВЕТСТВИЯ
    if (instruction["Категория пациента"]) {
        const category = instruction["Категория пациента"];
        
        // Проверяем факторы
        if (category["Фактор"]) {
            const factors = category["Фактор"];
            for (const factor_name in factors) {
                const factor_data = factors[factor_name];
                
                if (factor_data && "value" in factor_data) {
                    max_score += 10;
                    const kb_values = factor_data["value"];
                    const patient_value = extract_patient_value(patient_data, factor_name);
                    
                    if (patient_value !== null) {
                        const patient_normalized = normalize_value(patient_value);
                        const kb_normalized = Array.isArray(kb_values) ? 
                            kb_values.map(v => normalize_value(v)) : 
                            [normalize_value(kb_values)];
                        
                        let factor_matched = false;
                        for (const kb_val of kb_normalized) {
                            if (patient_normalized.includes(kb_val) || kb_val.includes(patient_normalized)) {
                                factor_matched = true;
                                break;
                            }
                        }
                        
                        if (factor_matched) {
                            match_score += 10;
                            explanations.push(`✅ Фактор '${factor_name}' совпадает`);
                        } else {
                            explanations.push(`❌ Фактор '${factor_name}' не совпадает`);
                            has_contradictions = true;
                        }
                    } else {
                        explanations.push(`❓ Фактор '${factor_name}' неизвестен`);
                        // Неизвестные факторы не уменьшают счет, но и не увеличивают
                    }
                }
            }
        }
        
        // Наблюдения не влияют на счет соответствия, только отображаются
        if (category["Наблюдение"]) {
            const observations = category["Наблюдение"];
            if (Array.isArray(observations)) {
                observations.forEach(obs => {
                    if (obs && typeof obs === 'object') {
                        for (const obs_name in obs) {
                            const patient_val = extract_patient_value(patient_data, obs_name);
                            if (patient_val !== null) {
                                explanations.push(`📊 Наблюдение '${obs_name}': ${patient_val}`);
                            } else {
                                explanations.push(`❓ Наблюдение '${obs_name}' неизвестно`);
                            }
                        }
                    }
                });
            } else if (typeof observations === 'object') {
                for (const obs_name in observations) {
                    const patient_val = extract_patient_value(patient_data, obs_name);
                    if (patient_val !== null) {
                        explanations.push(`📊 Наблюдение '${obs_name}': ${patient_val}`);
                    } else {
                        explanations.push(`❓ Наблюдение '${obs_name}' неизвестно`);
                    }
                }
            }
        }
    } else {
        // Вариант без категории пациента - базовый уровень соответствия
        match_score = 5;
        max_score = 10;
        explanations.push(`📝 Общий вариант лечения`);
    }
    
    // 3. УЧЕТ ПЛАНА ЛЕЧЕНИЯ
    if (instruction["План лечебных действий"]) {
        match_score += 5;
        max_score += 5;
        explanations.push(`💊 Имеется план лечения`);
    } else {
        explanations.push(`ℹ️ План лечения не указан`);
    }
    
    // 4. РАСЧЕТ ИТОГОВОГО ПРОЦЕНТА
    let final_score = 0;
    if (hard_contradiction) {
        final_score = 0;
    } else if (max_score > 0) {
        final_score = (match_score / max_score) * 100;
    } else {
        // Если нет критериев, но есть лечение - базовый уровень
        final_score = instruction["План лечебных действий"] ? 30 : 0;
    }
    
    // 5. КОРРЕКЦИЯ СЧЕТА ДЛЯ ОБЩИХ ВАРИАНТОВ
    if (!instruction["Категория пациента"] && instruction["План лечебных действий"]) {
        // Общие варианты с лечением не должны иметь высокий счет
        final_score = Math.min(final_score, 50);
    }
    
    return {
        score: final_score,
        explanations,
        has_contradictions: has_contradictions || hard_contradiction,
        hard_contradiction,
        has_treatment: !!instruction["План лечебных действий"]
    };
}

// ФУНКЦИЯ ПРОВЕРКИ ПРОТИВОРЕЧИЙ
function check_contradictions(patient_data, instruction) {
    console.log("=== ПРОВЕРКА ПРОТИВОРЕЧИЙ ===");
    
    const contradictions = [];
    
    if (!instruction["Категория пациента"] || !instruction["Категория пациента"]["Фактор"]) {
        console.log("Нет факторов для проверки противоречий");
        return contradictions;
    }
    
    const factors = instruction["Категория пациента"]["Фактор"];
    console.log("Факторы для проверки:", factors);
    
    for (const factor_name in factors) {
        const factor_data = factors[factor_name];
        console.log("Проверяем фактор:", factor_name, factor_data);
        
        if (factor_data && "value" in factor_data) {
            const kb_values = factor_data["value"];
            const patient_value = extract_patient_value(patient_data, factor_name);
            console.log("Значение из базы:", kb_values, "Значение пациента:", patient_value);
            
            if (patient_value !== null) {
                const patient_normalized = normalize_value(patient_value);
                const kb_normalized = Array.isArray(kb_values) ? 
                    kb_values.map(v => normalize_value(v)) : 
                    [normalize_value(kb_values)];
                
                console.log("Нормализованные значения - пациент:", patient_normalized, "база:", kb_normalized);
                
                // ПРОВЕРКА ПРОТИВОРЕЧИЙ ДЛЯ КЛЮЧЕВЫХ ФАКТОРОВ
                for (const kb_val of kb_normalized) {
                    console.log("Сравниваем:", patient_normalized, "с", kb_val);
                    
                    // КРИТИЧЕСКИЕ ПРОТИВОРЕЧИЯ
                    if (factor_name === "Трансплантация печени") {
                        if (kb_val.includes("не проводилась") && patient_normalized.includes("проводилась")) {
                            contradictions.push(`🚫 Противоречие: '${factor_name}' - у пациента: ${patient_value}, но требуется: ${kb_val}`);
                            console.log("НАЙДЕНО ПРОТИВОРЕЧИЕ: Трансплантация!");
                            break;
                        }
                    }
                    
                    if (factor_name === "Цирроз печени") {
                        if (kb_val.includes("отсутствует") && patient_normalized.includes("имеется")) {
                            contradictions.push(`🚫 Противоречие: '${factor_name}' - у пациента: ${patient_value}, но требуется: ${kb_val}`);
                            console.log("НАЙДЕНО ПРОТИВОРЕЧИЕ: Цирроз!");
                            break;
                        }
                    }
                    
                    // ОБЩАЯ ЛОГИКА ДЛЯ ОТСУТСТВИЯ/НАЛИЧИЯ
                    if ((kb_val.includes("не ") || kb_val.includes("без ") || kb_val.includes("отсутствует")) && 
                        (patient_normalized.includes("проводилась") || patient_normalized.includes("имеется") || patient_normalized.includes("есть"))) {
                        contradictions.push(`🚫 Противоречие: '${factor_name}' - у пациента: ${patient_value}, но требуется: ${kb_val}`);
                        console.log("НАЙДЕНО ОБЩЕЕ ПРОТИВОРЕЧИЕ!");
                        break;
                    }
                }
            } else {
                console.log("Значение пациента неизвестно для фактора:", factor_name);
            }
        } else if (factor_data && "Характеристика" in factor_data) {
            console.log("Фактор с характеристиками:", factor_name, factor_data["Характеристика"]);
            // Обработка вложенных характеристик
            const characteristics = factor_data["Характеристика"];
            for (const char_name in characteristics) {
                const char_data = characteristics[char_name];
                if (char_data && "Качественное значение" in char_data) {
                    const kb_values = Object.keys(char_data["Качественное значение"]);
                    const combined_name = `${factor_name}_${char_name}`;
                    const patient_value = extract_patient_value(patient_data, combined_name);
                    
                    console.log("Характеристика:", combined_name, "значения базы:", kb_values, "значение пациента:", patient_value);
                    
                    // Аналогичная проверка противоречий для характеристик
                    if (patient_value !== null) {
                        const patient_normalized = normalize_value(patient_value);
                        for (const kb_val of kb_values) {
                            const kb_normalized = normalize_value(kb_val);
                            
                            if ((kb_normalized.includes("не ") || kb_normalized.includes("без ")) && 
                                (patient_normalized.includes("имеется") || patient_normalized.includes("есть"))) {
                                contradictions.push(`🚫 Противоречие: '${combined_name}' - у пациента: ${patient_value}, но требуется: ${kb_val}`);
                                console.log("НАЙДЕНО ПРОТИВОРЕЧИЕ В ХАРАКТЕРИСТИКЕ!");
                            }
                        }
                    }
                }
            }
        }
    }
    
    console.log("Найдено противоречий:", contradictions);
    return contradictions;
}
// Решатель - функции анализа данных

function normalize_diagnosis_name(diagnosis) {
    if (!diagnosis) return "";
    
    // ЕСЛИ ДИАГНОЗ - МАССИВ, ИЩЕМ ПЕРВЫЙ ПОДХОДЯЩИЙ
    if (Array.isArray(diagnosis)) {
        for (const diag of diagnosis) {
            const normalized = normalize_single_diagnosis(diag);
            if (normalized) return normalized;
        }
        return "";
    }
    
    return normalize_single_diagnosis(diagnosis);
}

function normalize_single_diagnosis(diagnosis) {
    diagnosis = String(diagnosis).toLowerCase().trim();
    
    const mappings = {
        'хвгс': 'хвгс',
        'хронический вирусный гепатит c': 'хвгс', 
        'аг': 'аг',
        'артериальная гипертензия': 'аг',
        'ибс': 'стабильная ибс',
        'ишемическая болезнь сердца': 'стабильная ибс',
        'мигрень': 'мигрень'
    };
    
    for (const [key, value] of Object.entries(mappings)) {
        if (diagnosis.includes(key)) {
            return value;
        }
    }
    
    return diagnosis;
}

function find_disease_node(knowledge_base, diagnosis) {
    const normalized_input = normalize_diagnosis_name(diagnosis);
    if (!normalized_input) {
        return [null, null];
    }

    console.log("Поиск диагноза:", normalized_input); // для отладки

    if (knowledge_base && "КлинРек II ур" in knowledge_base && "Заболевание" in knowledge_base["КлинРек II ур"]) {
        const diseases = knowledge_base["КлинРек II ур"]["Заболевание"];

        // Прямое совпадение
        for (const disease_name in diseases) {
            const normalized_disease = normalize_diagnosis_name(disease_name);
            console.log("Сравниваем:", normalized_input, "с", normalized_disease); // для отладки
            
            if (normalized_disease === normalized_input) {
                console.log("Найдено прямое совпадение:", disease_name);
                return [disease_name, diseases[disease_name]];
            }
        }

        // Частичное совпадение
        for (const disease_name in diseases) {
            const normalized_disease = normalize_diagnosis_name(disease_name);
            if (normalized_input.includes(normalized_disease) || 
                normalized_disease.includes(normalized_input)) {
                console.log("Найдено частичное совпадение:", disease_name);
                return [disease_name, diseases[disease_name]];
            }
        }

        // Совпадение по ключевым словам
        for (const disease_name in diseases) {
            const disease_lower = disease_name.toLowerCase();
            const input_lower = normalized_input.toLowerCase();
            
            // Проверяем совпадение ключевых слов
            const disease_words = disease_lower.split(/\s+/);
            const input_words = input_lower.split(/\s+/);
            
            let match_count = 0;
            for (const dw of disease_words) {
                if (dw.length > 3 && input_lower.includes(dw)) { // слова длиннее 3 символов
                    match_count++;
                }
            }
            
            if (match_count >= 2) { // если совпало хотя бы 2 ключевых слова
                console.log("Найдено совпадение по ключевым словам:", disease_name);
                return [disease_name, diseases[disease_name]];
            }
        }
    }

    console.log("Диагноз не найден в базе знаний");
    return [null, null];
}

function extract_patient_value(patient_data, field_name) {
    console.log("Поиск поля:", field_name, "в данных:", patient_data);
    
    // Прямое совпадение
    if (field_name in patient_data) {
        const value = patient_data[field_name];
        console.log("Прямое совпадение найдено:", value);
        return value;
    }

    // Совпадение без учета пробелов и регистра
    const lower_field = field_name.toLowerCase().replace(/\s+/g, "");
    for (const key in patient_data) {
        if (key.toLowerCase().replace(/\s+/g, "") === lower_field) {
            console.log("Совпадение без пробелов найдено:", patient_data[key]);
            return patient_data[key];
        }
    }

    // Поиск по ключевым словам для важных полей
    const important_fields = {
        'трансплантация': 'Трансплантация печени',
        'цирроз': 'Цирроз печени', 
        'опыт терапии': 'Опыт терапии',
        'пвт': 'ПВТ (противовирусной терапии)'
    };
    
    for (const [key, field] of Object.entries(important_fields)) {
        if (field_name.toLowerCase().includes(key)) {
            if (field in patient_data) {
                console.log("Найдено по ключевому слову:", field, "=", patient_data[field]);
                return patient_data[field];
            }
        }
    }

    console.log("Поле не найдено:", field_name);
    return null;
}

function normalize_value(value) {
    if (value === null || value === undefined) return "";
    
    // ЕСЛИ ЗНАЧЕНИЕ - МАССИВ, РАБОТАЕМ СО ВСЕМИ ЭЛЕМЕНТАМИ
    if (Array.isArray(value)) {
        return value.map(v => String(v).toLowerCase().trim()).join('|');
    }
    
    return String(value).toLowerCase().trim();
}

function match_patient_factors(patient_data, category_data) {
    const explanations = [];
    let matched = true;
    let total_factors = 0;
    let matched_factors = 0;

    if (category_data && "Фактор" in category_data) {
        const factors = category_data["Фактор"];
        
        if (typeof factors === 'object') {
            for (const factor_name in factors) {
                const factor_data = factors[factor_name];
                
                if (factor_data && typeof factor_data === 'object' && "value" in factor_data) {
                    total_factors++;
                    const kb_values = factor_data["value"];
                    const patient_value = extract_patient_value(patient_data, factor_name);

                    if (patient_value !== null) {
                        const patient_normalized = normalize_value(patient_value);
                        const kb_normalized = Array.isArray(kb_values) ? 
                            kb_values.map(v => normalize_value(v)) : 
                            [normalize_value(kb_values)];
                        
                        let found_match = false;
                        for (const kb_val of kb_normalized) {
                            if (patient_normalized.includes(kb_val) || kb_val.includes(patient_normalized)) {
                                found_match = true;
                                break;
                            }
                        }
                        
                        if (found_match) {
                            explanations.push(`✅ Фактор '${factor_name}' совпадает: ${patient_value}`);
                            matched_factors++;
                        } else {
                            explanations.push(`❌ Фактор '${factor_name}' не совпадает (нужно: ${kb_values}, у пациента: ${patient_value})`);
                            matched = false;
                        }
                    } else {
                        explanations.push(`❌ Фактор '${factor_name}' неизвестен`);
                        matched = false;
                    }
                }
            }
        }
    }

    // Обработка наблюдений (только отображение)
    if (category_data && "Наблюдение" in category_data) {
        const observations = category_data["Наблюдение"];
        
        if (Array.isArray(observations)) {
            observations.forEach(obs => {
                if (obs && typeof obs === 'object') {
                    for (const obs_name in obs) {
                        const obs_data = obs[obs_name];
                        const patient_val = extract_patient_value(patient_data, obs_name);
                        
                        if (patient_val !== null) {
                            explanations.push(`📊 Наблюдение '${obs_name}': ${patient_val}`);
                        }
                    }
                }
            });
        }
    }

    return [matched, explanations, matched_factors, total_factors];
}

function extract_treatment_plan(plan) {
    const treatments = [];

    if (plan && typeof plan === 'object') {
        // Извлекаем цели лечения
        if ("Цель" in plan) {
            const goals = plan["Цель"];
            if (typeof goals === 'object') {
                for (const goal_key in goals) {
                    const goal = goals[goal_key];
                    if (goal && typeof goal === 'object') {
                        for (const action in goal) {
                            if (goal[action] && typeof goal[action] === 'object' && "Наблюдение" in goal[action]) {
                                const observations = goal[action]["Наблюдение"];
                                for (const obs_name in observations) {
                                    treatments.push(`🎯 Цель: ${action} ${obs_name}`);
                                }
                            } else if (typeof goal[action] === 'string') {
                                treatments.push(`🎯 Цель: ${action} ${goal[action]}`);
                            }
                        }
                    }
                }
            }
        }

        // Извлекаем варианты лечения
        if ("вариант лечения" in plan) {
            const treatment_options = plan["вариант лечения"];
            
            if (treatment_options && typeof treatment_options === 'object') {
                for (const treatment_key in treatment_options) {
                    const treatment = treatment_options[treatment_key];
                    
                    if (treatment && typeof treatment === 'object' && "медикаментозное" in treatment) {
                        const med = treatment["медикаментозное"];
                        
                        if (med && typeof med === 'object') {
                            // Действующие вещества
                            if ("Действующее вещество" in med) {
                                const substances = med["Действующее вещество"];
                                if (substances && typeof substances === 'object') {
                                    for (const substance_name in substances) {
                                        const substance_data = substances[substance_name];
                                        let treatment_text = `💊 ${substance_name}`;
                                        if (substance_data && typeof substance_data === 'object' && "режим" in substance_data) {
                                            treatment_text += ` (${substance_data["режим"]})`;
                                        }
                                        treatments.push(treatment_text);
                                    }
                                }
                            }

                            // Комбинации препаратов
                            if ("комбинация" in med) {
                                const combination = med["комбинация"];
                                if (combination && typeof combination === 'object') {
                                    if ("Действующее вещество" in combination) {
                                        const substances = combination["Действующее вещество"];
                                        if (substances && typeof substances === 'object') {
                                            const substance_names = Object.keys(substances);
                                            treatments.push(`🧪 Комбинация: ${substance_names.join(' + ')}`);
                                        }
                                    }
                                }
                            }

                            // Группы препаратов
                            if ("группа" in med) {
                                const groups = med["группа"];
                                if (groups && typeof groups === 'object') {
                                    for (const group_name in groups) {
                                        const group_data = groups[group_name];
                                        let group_text = `📦 Группа: ${group_name}`;
                                        if (group_data && "Действующее вещество" in group_data) {
                                            const substances = group_data["Действующее вещество"];
                                            if (substances && typeof substances === 'object') {
                                                const substance_names = Object.keys(substances);
                                                group_text += ` (${substance_names.join(', ')})`;
                                            }
                                        }
                                        treatments.push(group_text);
                                    }
                                }
                            }

                            // Препараты 1-й линии
                            if ("препарат 1-й линии" in med) {
                                const first_line = med["препарат 1-й линии"];
                                if (first_line && typeof first_line === 'object' && "группа" in first_line) {
                                    const groups = first_line["группа"];
                                    if (groups && typeof groups === 'object') {
                                        for (const group_name in groups) {
                                            const group_data = groups[group_name];
                                            treatments.push(`⭐ Препарат 1-й линии: ${group_name}`);
                                            if (group_data && "Действующее вещество" in group_data) {
                                                const substances = group_data["Действующее вещество"];
                                                if (substances && typeof substances === 'object') {
                                                    for (const substance_name in substances) {
                                                        treatments.push(`   💊 ${substance_name}`);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return treatments;
}

function generate_explanation(patient_data, knowledge_base) {
    if (!patient_data || Object.keys(patient_data).length === 0) {
        return "❌ Данные пациента отсутствуют или имеют неверный формат.";
    }

    const diagnosis = patient_data["Клинический диагноз"];
    if (!diagnosis) {
        return "❌ Диагноз не указан в истории болезни.";
    }

    console.log("Диагноз пациента:", diagnosis);
    console.log("База знаний:", knowledge_base);

    const [disease_name, disease_node] = find_disease_node(knowledge_base, diagnosis);
    
    console.log("Найденное заболевание:", disease_name);
    console.log("Узел заболевания:", disease_node);

    if (!disease_node) {
        return `❌ Заболевание '${diagnosis}' не найдено в базе знаний.\n\nДоступные заболевания в базе:\n${Object.keys(knowledge_base?.["КлинРек II ур"]?.["Заболевание"] || {}).join('\n')}`;
    }

    const result = [];
    let found_suitable_treatment = false;
    const all_treatments = [];

    // Проверяем варианты течения и стадии
    const sections_to_check = ["Вариант течения (функциональный класс)", "Стадия"];
    
    for (const section of sections_to_check) {
        if (section in disease_node && typeof disease_node[section] === 'object') {
            // ПРИОРИТИЗИРУЕМ варианты лечения
            const prioritizedVariants = prioritize_treatment_variants(disease_node[section]);
            
            for (const variant_name in prioritizedVariants) {
                const variant_data = prioritizedVariants[variant_name];
                
                if (variant_data && typeof variant_data === 'object' && "Инструкция" in variant_data) {
                    const instructions = variant_data["Инструкция"];
                    
                    if (instructions && typeof instructions === 'object') {
                        for (const instr_num in instructions) {
                            const instruction = instructions[instr_num];
                            
                            if (instruction && typeof instruction === 'object') {
                                const treatments = [];
                                
                                // Извлекаем план лечения если есть
                                if ("План лечебных действий" in instruction) {
                                    const plan = instruction["План лечебных действий"];
                                    const extracted_treatments = extract_treatment_plan(plan);
                                    treatments.push(...extracted_treatments);
                                }
                                
                                // ОЦЕНИВАЕМ соответствие варианта
                                const match_result = evaluate_variant_match(patient_data, instruction, variant_name);
                                
                                // Формируем вывод только если есть лечение ИЛИ хорошее соответствие
                                if (treatments.length > 0 || match_result.score >= 50) {
                                    found_suitable_treatment = true;
                                    
                                    // Сохраняем лечение для итогового анализа
                                    all_treatments.push({
                                        variant_name,
                                        treatments,
                                        match_score: match_result.score,
                                        explanations: match_result.explanations,
                                        has_contradictions: match_result.has_contradictions
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // СОРТИРУЕМ и ВЫВОДИМ результаты по убыванию соответствия
    all_treatments.sort((a, b) => b.match_score - a.match_score);
    
    all_treatments.forEach(treatment => {
    // Определяем тип вывода на основе процента совпадения и противоречий
    let header_type = "";
    
    if (treatment.hard_contradiction) {
        header_type = "🚫 === НЕПОДХОДЯЩИЙ ВАРИАНТ ===";
    } else if (treatment.match_score === 100 && !treatment.has_contradictions) {
        header_type = "🎯 === ОПТИМАЛЬНЫЙ ВАРИАНТ ЛЕЧЕНИЯ ===";
    } else if (treatment.match_score >= 80 && !treatment.has_contradictions) {
        header_type = "✅ === ПОДХОДЯЩИЙ ВАРИАНТ ЛЕЧЕНИЯ ===";
    } else if (treatment.match_score >= 60 || treatment.treatments.length > 0) {
        header_type = `🟡 === ВОЗМОЖНЫЙ ВАРИАНТ (совпадение: ${treatment.match_score.toFixed(0)}%) ===`;
    } else if (treatment.match_score >= 30) {
        header_type = `🟠 === ВАРИАНТ ТРЕБУЕТ УТОЧНЕНИЯ (совпадение: ${treatment.match_score.toFixed(0)}%) ===`;
    } else {
        header_type = `🔴 === МАЛОВЕРОЯТНЫЙ ВАРИАНТ (совпадение: ${treatment.match_score.toFixed(0)}%) ===`;
    }
    
    result.push(`\n${header_type}`);
    result.push(`🏥 Диагноз: ${disease_name}`);
    result.push(`📋 Вариант: ${treatment.variant_name}`);
    
    if (treatment.treatments.length > 0 && !treatment.hard_contradiction) {
        result.push("\n💡 Рекомендуемое лечение:");
        treatment.treatments.forEach(treatment_line => result.push(`   ${treatment_line}`));
    }
    
    if (treatment.explanations.length > 0) {
        result.push("\n📊 Анализ критериев:");
        treatment.explanations.forEach(exp => result.push(`   ${exp}`));
    }
    
    if (!treatment.hard_contradiction) {
        result.push(`\n📈 Совпадение критериев: ${treatment.match_score.toFixed(0)}%`);
    }
    
    // Рекомендации
    if (treatment.hard_contradiction) {
        result.push(`\n💡 Рекомендация: вариант противопоказан`);
    } else if (treatment.match_score < 50) {
        result.push(`\n💡 Рекомендация: необходимо уточнить данные пациента для этого варианта`);
    } else if (treatment.match_score < 80) {
        result.push(`\n💡 Рекомендация: вариант требует дополнительного обследования`);
    }
});

    if (!found_suitable_treatment) {
        result.push("\n❌ Не найдено подходящих вариантов лечения.");
        result.push("💡 Рекомендации:");
        result.push("   - Проверьте введенные данные пациента");
        result.push("   - Убедитесь, что все необходимые поля заполнены");
        result.push("   - Рассмотрите консультацию специалиста");
    } else if (all_treatments.length > 1) {
        result.push("\n💡 ИТОГОВАЯ РЕКОМЕНДАЦИЯ:");
        const best_treatment = all_treatments[0];
        result.push(`   Наиболее подходящий вариант: "${best_treatment.variant_name}"`);
        result.push(`   Уверенность: ${best_treatment.match_score.toFixed(0)}%`);
    }

    // Добавляем общую информацию о пациенте
    result.push("\n👤 ОБЩАЯ ИНФОРМАЦИЯ О ПАЦИЕНТЕ:");
    result.push(`   Диагноз: ${diagnosis}`);
    if (patient_data["Возраст"]) result.push(`   Возраст: ${patient_data["Возраст"]} лет`);
    if (patient_data["Пол"]) result.push(`   Пол: ${patient_data["Пол"]}`);
    if (patient_data["Сопутствующий диагноз"]) {
        const comorbidities = Array.isArray(patient_data["Сопутствующий диагноз"]) ? 
            patient_data["Сопутствующий диагноз"].join(', ') : 
            patient_data["Сопутствующий диагноз"];
        result.push(`   Сопутствующие заболевания: ${comorbidities}`);
    }

    return result.join("\n");
}

// Главная функция анализа
function analyzeData() {
    if (!window.knowledgeBase) {
        if (window.showNotification) {
            window.showNotification("Сначала загрузите базу знаний!", "error");
        }
        return;
    }

    const patient_data = window.extract_patient_data ? window.extract_patient_data() : {};
    if (Object.keys(patient_data).length === 0) {
        if (window.showNotification) {
            window.showNotification("Нет данных пациента! Загрузите историю болезни или заполните форму", "error");
        }
        return;
    }

    // Проверяем, есть ли данные для анализа
    let hasData = false;
    for (const tabName in window.allTabsData) {
        if (Object.keys(window.allTabsData[tabName].data).length > 0) {
            hasData = true;
            break;
        }
    }

    if (!hasData) {
        if (window.showNotification) {
            window.showNotification("Нет данных для анализа! Заполните форму.", "error");
        }
        return;
    }

    try {
        // Извлекаем данные пациента
        const patient_data = window.extract_patient_data ? window.extract_patient_data() : {};
        
        // Дополнительная обработка данных для лучшего сопоставления
        enhance_patient_data(patient_data);
        
        // Генерируем объяснение
        const explanation = generate_explanation(patient_data, window.knowledgeBase);
        
        // Показываем результаты
        const resultsDiv = document.getElementById('results');
        const analysisResultsDiv = document.getElementById('analysisResults');
        
        if (resultsDiv && analysisResultsDiv) {
            analysisResultsDiv.innerHTML = `
                <div class="analysis-result analysis-success">
                    <strong>Результат анализа:</strong>
                    <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 10px; border-left: 4px solid #28a745;">${explanation}</pre>
                </div>
                <div class="analysis-result">
                    <strong>Исходные данные пациента:</strong>
                    <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; max-height: 200px; overflow-y: auto;">${JSON.stringify(patient_data, null, 2)}</pre>
                </div>
            `;
            
            resultsDiv.style.display = 'block';
            
            if (window.showNotification) {
                window.showNotification("Анализ завершен успешно!", "success");
            }
        }
        
    } catch (error) {
        const resultsDiv = document.getElementById('results');
        const analysisResultsDiv = document.getElementById('analysisResults');
        
        if (resultsDiv && analysisResultsDiv) {
            analysisResultsDiv.innerHTML = `
                <div class="analysis-result analysis-error">
                    <strong>Ошибка анализа:</strong>
                    <p style="color: #dc3545;">${error.message}</p>
                </div>
            `;
            
            resultsDiv.style.display = 'block';
        }
        
        if (window.showNotification) {
            window.showNotification("Ошибка при анализе данных: " + error.message, "error");
        }
    }
}

// Функция для улучшения данных пациента
function enhance_patient_data(patient_data) {
    // Функция для извлечения значения из массива
    function getFirstValue(field) {
        if (!patient_data[field]) return null;
        if (Array.isArray(patient_data[field])) {
            return patient_data[field].length > 0 ? patient_data[field][0] : null;
        }
        return patient_data[field];
    }
    
    // Функция для проверки наличия значения в массиве или строке
    function containsValue(field, searchValue) {
        if (!patient_data[field]) return false;
        
        if (Array.isArray(patient_data[field])) {
            return patient_data[field].some(item => 
                String(item).toLowerCase().includes(searchValue.toLowerCase())
            );
        }
        
        return String(patient_data[field]).toLowerCase().includes(searchValue.toLowerCase());
    }

    // Нормализация опыта терапии
    const pvt = getFirstValue("ПВТ (противовирусной терапии)");
    if (pvt) {
        const pvtLower = String(pvt).toLowerCase();
        if (pvtLower.includes("не ответил") || pvtLower.includes("неэффектив")) {
            patient_data["Опыт терапии_ПВТ (противовирусной терапии)"] = "не ответил";
            patient_data["Опыт терапии_терапия ПегИФН + РБВ"] = "не ответил";
        } else if (pvtLower.includes("отсутствует") || pvtLower.includes("нет опыта")) {
            patient_data["Опыт терапии_ПВТ (противовирусной терапии)"] = "отсутствует";
        }
    }

    // Нормализация терапии ПегИФН + РБВ
    const pegIfn = getFirstValue("терапия ПегИФН + РБВ");
    if (pegIfn) {
        const pegIfnLower = String(pegIfn).toLowerCase();
        if (pegIfnLower.includes("не ответил")) {
            patient_data["Опыт терапии_терапия ПегИФН + РБВ"] = "не ответил";
        }
    }

    // Нормализация трансплантации печени
    if (containsValue("Операции", "трансплантация") || containsValue("Операции", "пересадка")) {
        patient_data["Трансплантация печени"] = "проводилась";
    } else if (containsValue("Операции", "операций не было") || 
               containsValue("Операции", "не было операций")) {
        patient_data["Трансплантация печени"] = "не проводилась";
    } else {
        // Если операции не указаны явно, устанавливаем по умолчанию
        patient_data["Трансплантация печени"] = "не проводилась";
    }

    // Нормализация цирроза печени
    if (containsValue("Сопутствующий диагноз", "цирроз") || 
        containsValue("Клинический диагноз", "цирроз") ||
        containsValue("Диагноз", "цирроз")) {
        patient_data["Цирроз печени"] = "имеется";
    } else {
        patient_data["Цирроз печени"] = "отсутствует";
    }

    // Нормализация ХБП (хроническая болезнь почек)
    if (containsValue("Сопутствующий диагноз", "хбп") || 
        containsValue("Сопутствующий диагноз", "хроническая болезнь почек") ||
        containsValue("Диагноз", "хбп")) {
        patient_data["ХБП"] = "имеется";
    }

    // Нормализация генотипа гепатита С
    if (patient_data["Анализ крови на гепатит С с определением генотипа_Результат"]) {
        patient_data["Результат"] = patient_data["Анализ крови на гепатит С с определением генотипа_Результат"];
    } else if (patient_data["Результат"]) {
        patient_data["Анализ крови на гепатит С с определением генотипа_Результат"] = patient_data["Результат"];
    }

    // Нормализация АГТ (антигипертензивной терапии)
    const agt = getFirstValue("АГТ, не включая диуретики");
    if (agt) {
        const agtLower = String(agt).toLowerCase();
        if (agtLower.includes("не достиг") || agtLower.includes("неэффектив")) {
            patient_data["Опыт терапии_АГТ, не включая диуретики"] = "не достиг целевого АД";
        }
    }

    // Нормализация НПВП и анальгетиков
    const nsaids = getFirstValue("приема обезболивающих и противовоспалительных");
    if (nsaids) {
        const nsaidsLower = String(nsaids).toLowerCase();
        if (nsaidsLower.includes("неэффектив") || nsaidsLower.includes("не помога")) {
            patient_data["Опыт терапии_приема обезболивающих и противовоспалительных"] = "неэффективны";
        }
    }

    // Нормализация возраста для числовых значений
    if (patient_data["Возраст"]) {
        const age = patient_data["Возраст"];
        if (typeof age === 'string') {
            // Извлекаем число из строки "45 лет" -> 45
            const ageMatch = age.match(/(\d+)/);
            if (ageMatch) {
                patient_data["Возраст_число"] = parseInt(ageMatch[1]);
            }
        } else if (typeof age === 'number') {
            patient_data["Возраст_число"] = age;
        }
    }

    // Нормализация переносимости терапии
    if (containsValue("Переносимость", "хорошая") || containsValue("Значение", "хорошая")) {
        patient_data["Переносимость_Значение"] = "хорошая";
    }

    // Создание комбинированных полей для упрощения поиска
    if (patient_data["Систолическое артериальное давление"] && patient_data["Диастолическое артериальное давление"]) {
        patient_data["Артериальное давление"] = {
            систолическое: patient_data["Систолическое артериальное давление"],
            диастолическое: patient_data["Диастолическое артериальное давление"]
        };
    }

    // Нормализация диагнозов для поиска
    if (patient_data["Клинический диагноз"]) {
        const diagnosis = getFirstValue("Клинический диагноз");
        if (diagnosis) {
            const diagLower = String(diagnosis).toLowerCase();
            
            // Создаем флаги для основных заболеваний
            patient_data["Диагноз_ХВГС"] = diagLower.includes("хвгс") || diagLower.includes("гепатит");
            patient_data["Диагноз_ИБС"] = diagLower.includes("ибс") || diagLower.includes("ишемическ");
            patient_data["Диагноз_АГ"] = diagLower.includes("аг") || diagLower.includes("артериальная гипертензия");
            patient_data["Диагноз_Мигрень"] = diagLower.includes("мигрень");
            
            // Сохраняем оригинальный диагноз для поиска
            patient_data["Основной диагноз"] = diagnosis;
        }
    }

    // Нормализация сопутствующих диагнозов
    if (patient_data["Сопутствующий диагноз"]) {
        const comorbidities = getFirstValue("Сопутствующий диагноз");
        if (comorbidities) {
            const comorbLower = String(comorbidities).toLowerCase();
            
            patient_data["Сопутствующий_АГ"] = comorbLower.includes("аг") || comorbLower.includes("артериальная гипертензия");
            patient_data["Сопутствующий_ИБС"] = comorbLower.includes("ибс") || comorbLower.includes("ишемическ");
            patient_data["Сопутствующий_ЦП"] = comorbLower.includes("цирроз") || comorbLower.includes("цп");
            patient_data["Сопутствующий_ХБП"] = comorbLower.includes("хбп") || comorbLower.includes("хроническая болезнь почек");
        }
    }

    console.log("Улучшенные данные пациента:", patient_data);
}
// Экспортируем главную функцию
window.analyzeData = analyzeData;

// Вспомогательная функция для отладки
function debugPatientData() {
    const patient_data = window.extract_patient_data ? window.extract_patient_data() : {};
    enhance_patient_data(patient_data);
    console.log("Улучшенные данные пациента:", patient_data);
    console.log("База знаний:", window.knowledgeBase);
    
    // Тестовый анализ
    if (window.knowledgeBase) {
        const explanation = generate_explanation(patient_data, window.knowledgeBase);
        console.log("Результат анализа:", explanation);
    }
}

