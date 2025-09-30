// Решатель - функции анализа данных

function normalize_diagnosis_name(diagnosis) {
    if (!diagnosis) {
        return "";
    }

    diagnosis = diagnosis.toLowerCase().trim();
    const replacements = {
        'аг': 'артериальная гипертензия',
        'гб': 'гипертоническая болезнь',
        'ибс': 'ишемическая болезнь сердца',
        'хвгс': 'хронический вирусный гепатит c',
        'хгс': 'хронический гепатит c'
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

        for (const disease_name in diseases) {
            if (normalize_diagnosis_name(disease_name) === normalized_input) {
                return [disease_name, diseases[disease_name]];
            }
        }

        for (const disease_name in diseases) {
            if (normalized_input.includes(normalize_diagnosis_name(disease_name)) || 
                normalize_diagnosis_name(disease_name).includes(normalized_input)) {
                return [disease_name, diseases[disease_name]];
            }
        }
    }

    return [null, null];
}

function extract_patient_value(patient_data, field_name) {
    if (field_name in patient_data) {
        return patient_data[field_name];
    }

    const lower_field = field_name.toLowerCase().replace(/\s+/g, "");
    for (const key in patient_data) {
        if (key.toLowerCase().replace(/\s+/g, "") === lower_field) {
            return patient_data[key];
        }
    }

    return null;
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
                            explanations.push(`Фактор '${factor_name}' неизвестен`);
                            matched = false;
                        } else if (Array.isArray(kb_values)) {
                            const kb_values_lower = kb_values.map(v => String(v).toLowerCase());
                            if (!kb_values_lower.includes(String(patient_value).toLowerCase())) {
                                explanations.push(`Фактор '${factor_name}' не совпадает (нужно: ${kb_values.join(', ')}, у пациента: ${patient_value})`);
                                matched = false;
                            } else {
                                explanations.push(`Фактор '${factor_name}' совпадает: ${patient_value}`);
                            }
                        } else {
                            if (String(patient_value).toLowerCase() !== String(kb_values).toLowerCase()) {
                                explanations.push(`Фактор '${factor_name}' не совпадает (нужно: ${kb_values}, у пациента: ${patient_value})`);
                                matched = false;
                            } else {
                                explanations.push(`Фактор '${factor_name}' совпадает: ${patient_value}`);
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
                                        explanations.push(`Характеристика '${combined_name}' неизвестна`);
                                        matched = false;
                                    } else if (!kb_values.map(v => v.toLowerCase()).includes(String(patient_value).toLowerCase())) {
                                        explanations.push(`Характеристика '${combined_name}' не совпадает (нужно: ${kb_values.join(', ')}, у пациента: ${patient_value})`);
                                        matched = false;
                                    } else {
                                        explanations.push(`Характеристика '${combined_name}' совпадает: ${patient_value}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

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
                                explanations.push(`Наблюдение '${obs_name}' значение: ${patient_val}`);
                            } else {
                                explanations.push(`Наблюдение '${obs_name}' неизвестно`);
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
                        explanations.push(`Наблюдение '${obs_name}' значение: ${patient_val}`);
                    } else {
                        explanations.push(`Наблюдение '${obs_name}' неизвестно`);
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
        if ("вариант лечения" in plan) {
            const treatment_options = plan["вариант лечения"];
            
            if (treatment_options && typeof treatment_options === 'object') {
                for (const treatment_key in treatment_options) {
                    const treatment = treatment_options[treatment_key];
                    
                    if (treatment && typeof treatment === 'object' && "медикаментозное" in treatment) {
                        const med = treatment["медикаментозное"];
                        
                        if (med && typeof med === 'object') {
                            if ("Действующее вещество" in med) {
                                const substances = med["Действующее вещество"];
                                if (substances && typeof substances === 'object') {
                                    const substance_names = Object.keys(substances);
                                    treatments.push(...substance_names.map(s => `Препарат: ${s}`));
                                }
                            }

                            if ("комбинация" in med && "Действующее вещество" in med["комбинация"]) {
                                const substances = med["комбинация"]["Действующее вещество"];
                                if (substances && typeof substances === 'object') {
                                    const substance_names = Object.keys(substances);
                                    treatments.push(`Комбинация препаратов: ${substance_names.join(', ')}`);
                                }
                            }

                            if ("группа" in med) {
                                const groups = med["группа"];
                                if (groups && typeof groups === 'object') {
                                    const group_names = Object.keys(groups);
                                    treatments.push(`Группы препаратов: ${group_names.join(', ')}`);
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
        return "Данные пациента отсутствуют или имеют неверный формат.";
    }

    const diagnosis = patient_data["Клинический диагноз"];
    if (!diagnosis) {
        return "Диагноз не указан в истории болезни.";
    }

    const [disease_name, disease_node] = find_disease_node(knowledge_base, diagnosis);
    if (!disease_node) {
        return `Заболевание '${diagnosis}' не найдено в базе знаний.`;
    }

    const result = [];

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
                            
                            if (instruction && typeof instruction === 'object' && "План лечебных действий" in instruction) {
                                const plan = instruction["План лечебных действий"];
                                const treatments = extract_treatment_plan(plan);

                                // Проверяем категорию пациента
                                let category_matched = false;
                                let factor_explanations = [];

                                if ("Категория пациента" in instruction) {
                                    const category = instruction["Категория пациента"];
                                    [category_matched, factor_explanations] = match_patient_factors(patient_data, category);
                                }

                                // Формируем вывод
                                if (category_matched) {
                                    result.push(`\n=== Подходящий вариант лечения ===`);
                                    result.push(`Диагноз: ${disease_name}`);
                                    result.push(`Вариант: ${variant_name}`);
                                    if (treatments.length > 0) {
                                        result.push("Рекомендуемое лечение:");
                                        result.push(...treatments);
                                    }
                                } else {
                                    result.push(`\n=== Неподходящий вариант (требует проверки) ===`);
                                    result.push(`Диагноз: ${disease_name}`);
                                    result.push(`Вариант: ${variant_name}`);
                                }

                                if (factor_explanations.length > 0) {
                                    result.push("\nФакторы пациента:");
                                    result.push(...factor_explanations);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (result.length === 0) {
        return "Не найдено подходящих вариантов лечения.";
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
        
        // Генерируем объяснение
        const explanation = generate_explanation(patient_data, window.knowledgeBase);
        
        // Показываем результаты
        const resultsDiv = document.getElementById('results');
        const analysisResultsDiv = document.getElementById('analysisResults');
        
        if (resultsDiv && analysisResultsDiv) {
            analysisResultsDiv.innerHTML = `
                <div class="analysis-result analysis-success">
                    <strong>Результат анализа:</strong>
                    <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px;">${explanation}</pre>
                </div>
                <div class="analysis-result">
                    <strong>Данные пациента:</strong>
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
                    <p>${error.message}</p>
                </div>
            `;
            
            resultsDiv.style.display = 'block';
        }
        
        if (window.showNotification) {
            window.showNotification("Ошибка при анализе данных: " + error.message, "error");
        }
    }
}

// Экспортируем главную функцию
window.analyzeData = analyzeData;

// Вспомогательная функция для отладки
function debugPatientData() {
    const patient_data = window.extract_patient_data ? window.extract_patient_data() : {};
    console.log("Данные пациента:", patient_data);
    console.log("База знаний:", window.knowledgeBase);
}