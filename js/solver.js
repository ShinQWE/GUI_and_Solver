// Решатель - функции анализа данных

function normalize_diagnosis_name(diagnosis) {
    if (!diagnosis) {
        return "";
    }

    // Если diagnosis - массив, берем первый элемент
    if (Array.isArray(diagnosis)) {
        if (diagnosis.length === 0) {
            return "";
        }
        diagnosis = diagnosis[0]; // Берем первый диагноз из массива
    }

    // Убеждаемся, что diagnosis - строка
    diagnosis = String(diagnosis).toLowerCase().trim();
    
    const replacements = {
        'аг': 'артериальная гипертензия',
        'гб': 'гипертоническая болезнь',
        'ибс': 'ишемическая болезнь сердца',
        'хвгс': 'хронический вирусный гепатит c',
        'хгс': 'хронический гепатит c',
        'хронический вирусный гепатит c': 'хвгс',
        'артериальная гипертензия': 'аг',
        'ишемическая болезнь сердца': 'ибс'
    };
    
    for (const [short, full] of Object.entries(replacements)) {
        diagnosis = diagnosis.replace(short, full);
    }
    return diagnosis;
}

function find_disease_node(knowledge_base, diagnosis) {
    const normalized_input = normalize_diagnosis_name(diagnosis);
    if (!normalized_input) {
        return [null, null];
    }

    if (knowledge_base && "КлинРек II ур" in knowledge_base && "Заболевание" in knowledge_base["КлинРек II ур"]) {
        const diseases = knowledge_base["КлинРек II ур"]["Заболевание"];

        // Прямое совпадение
        for (const disease_name in diseases) {
            if (normalize_diagnosis_name(disease_name) === normalized_input) {
                return [disease_name, diseases[disease_name]];
            }
        }

        // Частичное совпадение
        for (const disease_name in diseases) {
            const normalized_disease = normalize_diagnosis_name(disease_name);
            if (normalized_input.includes(normalized_disease) || 
                normalized_disease.includes(normalized_input)) {
                return [disease_name, diseases[disease_name]];
            }
        }

        // Совпадение по синонимам
        for (const disease_name in diseases) {
            if (disease_name.toLowerCase().includes(normalized_input) || 
                normalized_input.includes(disease_name.toLowerCase())) {
                return [disease_name, diseases[disease_name]];
            }
        }
    }

    return [null, null];
}

function extract_patient_value(patient_data, field_name) {
    // Прямое совпадение
    if (field_name in patient_data) {
        const value = patient_data[field_name];
        // Возвращаем как есть (массив или строку) - НЕ ПРЕОБРАЗУЕМ В СТРОКУ!
        return value;
    }

    // Совпадение без учета пробелов и регистра
    const lower_field = field_name.toLowerCase().replace(/\s+/g, "");
    for (const key in patient_data) {
        if (key.toLowerCase().replace(/\s+/g, "") === lower_field) {
            return patient_data[key]; // Возвращаем как есть
        }
    }

    // Поиск в значениях (только для строковых значений)
    for (const key in patient_data) {
        let value = patient_data[key];
        // Если значение - массив, преобразуем в строку для поиска
        if (Array.isArray(value)) {
            value = value.join(', ');
        }
        if (typeof value === 'string' && value.toLowerCase().includes(field_name.toLowerCase())) {
            return value;
        }
    }

    return null;
}

function normalize_value(value) {
    if (value === null || value === undefined) return "";
    
    // Если значение - массив, преобразуем в строку для сравнения
    if (Array.isArray(value)) {
        return value.join(', ').toLowerCase().trim();
    }
    
    return String(value).toLowerCase().trim();
}

function match_patient_factors(patient_data, category_data) {
    const explanations = [];
    let matched = true;

    if (category_data && "Фактор" in category_data) {
        const factors = category_data["Фактор"];
        
        if (typeof factors === 'object') {
            for (const factor_name in factors) {
                const factor_data = factors[factor_name];
                
                if (factor_data && typeof factor_data === 'object') {
                    if ("value" in factor_data) {
                        const kb_values = factor_data["value"];
                        const patient_value = extract_patient_value(patient_data, factor_name);

                        if (patient_value === null) {
                            explanations.push(`❌ Фактор '${factor_name}' неизвестен`);
                            matched = false;
                        } else if (Array.isArray(kb_values)) {
                            const kb_values_normalized = kb_values.map(v => normalize_value(v));
                            const patient_value_normalized = normalize_value(patient_value);
                            
                            let found_match = false;
                            for (const kb_val of kb_values_normalized) {
                                if (patient_value_normalized.includes(kb_val) || kb_val.includes(patient_value_normalized)) {
                                    found_match = true;
                                    break;
                                }
                            }
                            
                            if (!found_match) {
                                explanations.push(`❌ Фактор '${factor_name}' не совпадает (нужно: ${kb_values.join(', ')}, у пациента: ${patient_value})`);
                                matched = false;
                            } else {
                                explanations.push(`✅ Фактор '${factor_name}' совпадает: ${patient_value}`);
                            }
                        } else {
                            const kb_value_normalized = normalize_value(kb_values);
                            const patient_value_normalized = normalize_value(patient_value);
                            
                            if (!patient_value_normalized.includes(kb_value_normalized) && 
                                !kb_value_normalized.includes(patient_value_normalized)) {
                                explanations.push(`❌ Фактор '${factor_name}' не совпадает (нужно: ${kb_values}, у пациента: ${patient_value})`);
                                matched = false;
                            } else {
                                explanations.push(`✅ Фактор '${factor_name}' совпадает: ${patient_value}`);
                            }
                        }
                    } else if ("Характеристика" in factor_data) {
                        const characteristics = factor_data["Характеристика"];
                        
                        if (characteristics && typeof characteristics === 'object') {
                            for (const char_name in characteristics) {
                                const char_data = characteristics[char_name];
                                
                                if (char_data && "Качественное значение" in char_data) {
                                    const kb_values = Object.keys(char_data["Качественное значение"]);
                                    const combined_name = `${factor_name}_${char_name}`;
                                    const patient_value = extract_patient_value(patient_data, combined_name);

                                    if (patient_value === null) {
                                        // Пробуем найти значение по отдельным полям
                                        const separate_value = extract_patient_value(patient_data, char_name);
                                        if (separate_value !== null) {
                                            const kb_values_normalized = kb_values.map(v => normalize_value(v));
                                            const separate_value_normalized = normalize_value(separate_value);
                                            
                                            let found_match = false;
                                            for (const kb_val of kb_values_normalized) {
                                                if (separate_value_normalized.includes(kb_val) || 
                                                    kb_val.includes(separate_value_normalized)) {
                                                    found_match = true;
                                                    break;
                                                }
                                            }
                                            
                                            if (found_match) {
                                                explanations.push(`✅ Характеристика '${char_name}' совпадает: ${separate_value}`);
                                            } else {
                                                explanations.push(`❌ Характеристика '${char_name}' не совпадает (нужно: ${kb_values.join(', ')}, у пациента: ${separate_value})`);
                                                matched = false;
                                            }
                                        } else {
                                            explanations.push(`❌ Характеристика '${char_name}' неизвестна`);
                                            matched = false;
                                        }
                                    } else {
                                        const kb_values_normalized = kb_values.map(v => normalize_value(v));
                                        const patient_value_normalized = normalize_value(patient_value);
                                        
                                        let found_match = false;
                                        for (const kb_val of kb_values_normalized) {
                                            if (patient_value_normalized.includes(kb_val) || 
                                                kb_val.includes(patient_value_normalized)) {
                                                found_match = true;
                                                break;
                                            }
                                        }
                                        
                                        if (found_match) {
                                            explanations.push(`✅ Характеристика '${combined_name}' совпадает: ${patient_value}`);
                                        } else {
                                            explanations.push(`❌ Характеристика '${combined_name}' не совпадает (нужно: ${kb_values.join(', ')}, у пациента: ${patient_value})`);
                                            matched = false;
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

    // Обработка наблюдений
    if (category_data && "Наблюдение" in category_data) {
        const observations = category_data["Наблюдение"];
        
        if (Array.isArray(observations)) {
            observations.forEach(obs => {
                if (obs && typeof obs === 'object') {
                    for (const obs_name in obs) {
                        const obs_data = obs[obs_name];
                        if (obs_data && "Числовое значение" in obs_data) {
                            const patient_val = extract_patient_value(patient_data, obs_name);
                            if (patient_val !== null) {
                                explanations.push(`📊 Наблюдение '${obs_name}': ${patient_val}`);
                                // Проверка диапазона значений
                                const num_val = Number(patient_val);
                                const num_data = obs_data["Числовое значение"];
                                if (!isNaN(num_val) && num_data) {
                                    if (num_data["нижняя граница"] !== undefined && num_val < num_data["нижняя граница"]) {
                                        explanations.push(`⚠️ Значение '${obs_name}' ниже нормы`);
                                    }
                                    if (num_data["верхняя граница"] !== undefined && num_val > num_data["верхняя граница"]) {
                                        explanations.push(`⚠️ Значение '${obs_name}' выше нормы`);
                                    }
                                }
                            } else {
                                explanations.push(`❌ Наблюдение '${obs_name}' неизвестно`);
                                matched = false;
                            }
                        } else if (obs_data && "Качественное значение" in obs_data) {
                            const patient_val = extract_patient_value(patient_data, obs_name);
                            const expected_values = Object.keys(obs_data["Качественное значение"]);
                            
                            if (patient_val !== null) {
                                const patient_val_normalized = normalize_value(patient_val);
                                let value_matched = false;
                                
                                for (const expected_val of expected_values) {
                                    if (patient_val_normalized.includes(normalize_value(expected_val)) || 
                                        normalize_value(expected_val).includes(patient_val_normalized)) {
                                        value_matched = true;
                                        break;
                                    }
                                }
                                
                                if (value_matched) {
                                    explanations.push(`✅ Наблюдение '${obs_name}' совпадает: ${patient_val}`);
                                } else {
                                    explanations.push(`❌ Наблюдение '${obs_name}' не совпадает (ожидалось: ${expected_values.join(', ')}, получено: ${patient_val})`);
                                    matched = false;
                                }
                            } else {
                                explanations.push(`❌ Наблюдение '${obs_name}' неизвестно`);
                                matched = false;
                            }
                        }
                    }
                }
            });
        } else if (observations && typeof observations === 'object') {
            for (const obs_name in observations) {
                const obs_data = observations[obs_name];
                if (obs_data && "Числовое значение" in obs_data) {
                    const patient_val = extract_patient_value(patient_data, obs_name);
                    if (patient_val !== null) {
                        explanations.push(`📊 Наблюдение '${obs_name}': ${patient_val}`);
                    } else {
                        explanations.push(`❌ Наблюдение '${obs_name}' неизвестно`);
                        matched = false;
                    }
                } else if (obs_data && "Качественное значение" in obs_data) {
                    const patient_val = extract_patient_value(patient_data, obs_name);
                    const expected_values = Object.keys(obs_data["Качественное значение"]);
                    
                    if (patient_val !== null) {
                        const patient_val_normalized = normalize_value(patient_val);
                        let value_matched = false;
                        
                        for (const expected_val of expected_values) {
                            if (patient_val_normalized.includes(normalize_value(expected_val)) || 
                                normalize_value(expected_val).includes(patient_val_normalized)) {
                                value_matched = true;
                                break;
                            }
                        }
                        
                        if (value_matched) {
                            explanations.push(`✅ Наблюдение '${obs_name}' совпадает: ${patient_val}`);
                        } else {
                            explanations.push(`❌ Наблюдение '${obs_name}' не совпадает (ожидалось: ${expected_values.join(', ')}, получено: ${patient_val})`);
                            matched = false;
                        }
                    } else {
                        explanations.push(`❌ Наблюдение '${obs_name}' неизвестно`);
                        matched = false;
                    }
                }
            }
        }
    }

    return [matched, explanations];
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

    const [disease_name, disease_node] = find_disease_node(knowledge_base, diagnosis);
    if (!disease_node) {
        return `❌ Заболевание '${diagnosis}' не найдено в базе знаний.`;
    }

    const result = [];
    let found_suitable_treatment = false;

    // Проверяем варианты течения и стадии
    const sections_to_check = ["Вариант течения (функциональный класс)", "Стадия"];
    
    for (const section of sections_to_check) {
        if (section in disease_node && typeof disease_node[section] === 'object') {
            for (const variant_name in disease_node[section]) {
                const variant_data = disease_node[section][variant_name];
                
                if (variant_data && typeof variant_data === 'object' && "Инструкция" in variant_data) {
                    const instructions = variant_data["Инструкция"];
                    
                    if (instructions && typeof instructions === 'object') {
                        for (const instr_num in instructions) {
                            const instruction = instructions[instr_num];
                            
                            if (instruction && typeof instruction === 'object') {
                                const treatments = [];
                                let category_matched = false;
                                let factor_explanations = [];
                                let match_score = 0;
                                let total_factors = 0;

                                // Извлекаем план лечения если есть
                                if ("План лечебных действий" in instruction) {
                                    const plan = instruction["План лечебных действий"];
                                    const extracted_treatments = extract_treatment_plan(plan);
                                    treatments.push(...extracted_treatments);
                                }

                                // Проверяем категорию пациента
                                if ("Категория пациента" in instruction) {
                                    const category = instruction["Категория пациента"];
                                    [category_matched, factor_explanations] = match_patient_factors(patient_data, category);
                                    
                                    // Подсчитываем процент совпадения
                                    total_factors = factor_explanations.length;
                                    const matched_factors = factor_explanations.filter(exp => exp.includes('✅')).length;
                                    match_score = total_factors > 0 ? (matched_factors / total_factors) * 100 : 0;
                                } else {
                                    // Если категории нет, считаем подходящим
                                    category_matched = true;
                                    match_score = 100;
                                }

                                // Формируем вывод
                                if (category_matched || match_score > 0) {
                                    found_suitable_treatment = true;
                                    
                                    // Градация по проценту совпадения
                                    if (match_score === 100 || category_matched) {
                                        result.push(`\n🎯 === ПОДХОДЯЩИЙ ВАРИАНТ ЛЕЧЕНИЯ ===`);
                                    } else if (match_score > 70) {
                                        result.push(`\n🟡 === ВЕРОЯТНО ПОДХОДЯЩИЙ ВАРИАНТ (совпадение: ${match_score.toFixed(0)}%) ===`);
                                    } else if (match_score > 30) {
                                        result.push(`\n🟠 === ВАРИАНТ ТРЕБУЕТ ДООБСЛЕДОВАНИЯ (совпадение: ${match_score.toFixed(0)}%) ===`);
                                    } else {
                                        result.push(`\n🔴 === ВАРИАНТ МАЛОВЕРОЯТЕН (совпадение: ${match_score.toFixed(0)}%) ===`);
                                    }
                                    
                                    // Остальной код остается таким же...
                                    result.push(`🏥 Диагноз: ${disease_name}`);
                                    result.push(`📋 Вариант: ${variant_name}`);
                                    
                                    if (treatments.length > 0) {
                                        result.push("\n💡 Рекомендуемое лечение:");
                                        treatments.forEach(treatment => result.push(`   ${treatment}`));
                                    } else {
                                        result.push("\n💡 Информация о лечении: требуется уточнение");
                                    }

                                    if (factor_explanations.length > 0) {
                                        result.push("\n📊 Анализ критериев:");
                                        factor_explanations.forEach(exp => result.push(`   ${exp}`));
                                    }
                                    
                                    result.push(`\n📈 Совпадение критериев: ${match_score.toFixed(0)}%`);
                                    
                                    // Рекомендации в зависимости от процента
                                    if (match_score <= 30) {
                                        result.push(`\n💡 Рекомендация: данный вариант маловероятен, рассмотрите другие варианты лечения`);
                                    } else if (match_score <= 70) {
                                        result.push(`\n💡 Рекомендация: необходимо заполнить недостающие данные для подтверждения варианта`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (!found_suitable_treatment) {
        result.push("\n❌ Не найдено полностью подходящих вариантов лечения.");
        result.push("💡 Рекомендации:");
        result.push("   - Проверьте введенные данные пациента");
        result.push("   - Убедитесь, что все необходимые поля заполнены");
        result.push("   - Рассмотрите частично подходящие варианты выше");
    }

    // Добавляем общую информацию о пациенте
    result.push("\n👤 ОБЩАЯ ИНФОРМАЦИЯ О ПАЦИЕНТЕ:");
    result.push(`   Диагноз: ${diagnosis}`);
    if (patient_data["Возраст"]) result.push(`   Возраст: ${patient_data["Возраст"]} лет`);
    if (patient_data["Пол"]) result.push(`   Пол: ${patient_data["Пол"]}`);
    if (patient_data["Сопутствующий диагноз"]) result.push(`   Сопутствующие заболевания: ${patient_data["Сопутствующий диагноз"]}`);

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
    // Нормализация опыта терапии
    if (patient_data["ПВТ (противовирусной терапии)"]) {
        let pvt = patient_data["ПВТ (противовирусной терапии)"];
        // Если значение - массив, берем первый элемент
        if (Array.isArray(pvt)) {
            pvt = pvt.length > 0 ? pvt[0] : "";
        }
        pvt = pvt.toLowerCase();
        if (pvt.includes("не ответил") || pvt.includes("неэффектив")) {
            patient_data["Опыт терапии_ПВТ (противовирусной терапии)"] = "не ответил";
            patient_data["Опыт терапии_терапия ПегИФН + РБВ"] = "не ответил";
        } else if (pvt.includes("отсутствует") || pvt.includes("нет опыта")) {
            patient_data["Опыт терапии_ПВТ (противовирусной терапии)"] = "отсутствует";
        }
    }

    // Нормализация трансплантации
    if (patient_data["Операции"]) {
        let operations = patient_data["Операции"];
        // Если значение - массив, преобразуем в строку для поиска
        if (Array.isArray(operations)) {
            operations = operations.join(', ');
        }
        operations = operations.toLowerCase();
        if (operations.includes("трансплантация") || operations.includes("пересадка")) {
            patient_data["Трансплантация печени"] = "проводилась";
        } else {
            patient_data["Трансплантация печени"] = "не проводилась";
        }
    }

    // Нормализация цирроза
    if (patient_data["Сопутствующий диагноз"]) {
        let diagnoses = patient_data["Сопутствующий диагноз"];
        // Если значение - массив, преобразуем в строку для поиска
        if (Array.isArray(diagnoses)) {
            diagnoses = diagnoses.join(', ');
        }
        diagnoses = diagnoses.toLowerCase();
        if (diagnoses.includes("цирроз")) {
            patient_data["Цирроз печени"] = "имеется";
        } else {
            patient_data["Цирроз печени"] = "отсутствует";
        }
    }

    // Нормализация генотипа
    if (patient_data["Результат"]) {
        patient_data["Анализ крови на гепатит С с определением генотипа_Результат"] = patient_data["Результат"];
    }
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