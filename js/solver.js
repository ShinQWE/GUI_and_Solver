// УНИВЕРСАЛЬНЫЙ РЕШАТЕЛЬ ДЛЯ ЛЮБЫХ КЛИНИЧЕСКИХ РЕКОМЕНДАЦИЙ

function analyzeData() {
    if (!window.knowledgeBase) {
        window.showNotification?.("Сначала загрузите базу знаний!", "error");
        return;
    }

    const patient_data = window.extract_patient_data?.() || {};
    
    if (Object.keys(patient_data).length === 0) {
        window.showNotification?.("Нет данных пациента! Заполните форму", "error");
        return;
    }

    try {
        console.log("🎯 ЗАПУСК УНИВЕРСАЛЬНОГО АНАЛИЗА");
        const explanation = generate_universal_explanation(patient_data, window.knowledgeBase);
        showAnalysisResults(explanation, patient_data);
        window.showNotification?.("Анализ завершен успешно!", "success");
    } catch (error) {
        console.error("❌ Ошибка анализа:", error);
        showErrorResults(error);
        window.showNotification?.("Ошибка при анализе: " + error.message, "error");
    }
}

function generate_universal_explanation(patient_data, knowledge_base) {
    if (!patient_data || Object.keys(patient_data).length === 0) {
        return "❌ Данные пациента отсутствуют или имеют неверный формат.";
    }

    const result = [];
    const patient_diagnoses = extract_patient_diagnoses(patient_data);
    
    if (patient_diagnoses.length === 0) {
        return "❌ Не удалось определить диагнозы пациента.";
    }

    // Краткая информация о пациенте
    result.push("👤 **ДАННЫЕ ПАЦИЕНТА**");
    result.push(`   Диагнозы: ${patient_diagnoses.join(', ')}`);
    if (patient_data["Возраст"]) result.push(`   Возраст: ${patient_data["Возраст"]} лет`);
    if (patient_data["Пол"]) result.push(`   Пол: ${patient_data["Пол"]}`);
    
    const key_factors = [];
    if (patient_data["Трансплантация печени"]) key_factors.push(`Трансплантация: ${patient_data["Трансплантация печени"]}`);
    if (patient_data["Цирроз печени"]) key_factors.push(`Цирроз: ${patient_data["Цирроз печени"]}`);
    if (patient_data["ПВТ (противовирусной терапии)"]) key_factors.push(`Предыдущее лечение: ${patient_data["ПВТ (противовирусной терапии)"]}`);
    if (key_factors.length > 0) result.push(`   Факторы: ${key_factors.join(', ')}`);
    result.push("");

    // Поиск рекомендаций
    const all_recommendations = find_all_recommendations(knowledge_base, patient_data, patient_diagnoses);
    const filtered_recommendations = filter_recommendations_by_diagnosis(all_recommendations, patient_diagnoses);
    const valid_recommendations = filtered_recommendations.filter(rec => !rec.critical_mismatch || rec.match_score > 60);
    
    if (valid_recommendations.length === 0) {
        result.push("❌ Не найдено подходящих клинических рекомендаций.");
        result.push("💡 **Рекомендации:**");
        result.push("   • Уточните диагноз и дополнительные параметры");
        result.push("   • Проведите дополнительное обследование");
    } else {
        // Группировка и сортировка рекомендаций
        const recommendations_by_diagnosis = {};
        valid_recommendations.forEach(rec => {
            if (!recommendations_by_diagnosis[rec.diagnosis]) recommendations_by_diagnosis[rec.diagnosis] = [];
            recommendations_by_diagnosis[rec.diagnosis].push(rec);
        });

        for (const diagnosis in recommendations_by_diagnosis) {
            recommendations_by_diagnosis[diagnosis].sort((a, b) => b.match_score - a.match_score);
        }

        // Компактный вывод рекомендаций
        for (const [diagnosis, recs] of Object.entries(recommendations_by_diagnosis)) {
            result.push(`\n🏥 **${diagnosis.toUpperCase()}**`);
            const top_recommendations = recs.slice(0, 3);
            
            top_recommendations.forEach((rec, index) => {
                const match_percent = Math.round(rec.match_score);
                let status_icon = "🟡";
                if (match_percent >= 90) status_icon = "🎯";
                else if (match_percent >= 70) status_icon = "✅";
                else if (match_percent <= 30) status_icon = "🔴";
                
                result.push(`\n${status_icon} **${rec.variant_name}** (совпадение: ${match_percent}%)`);
                
                if (rec.treatments && rec.treatments.length > 0) {
                    const main_treatments = rec.treatments.slice(0, 2);
                    main_treatments.forEach(treatment => {
                        if (treatment.type === 'combination' && treatment.drugs) {
                            result.push(`   💊 ${treatment.drugs.join(' + ')}`);
                        } else if (treatment.type === 'medication') {
                            result.push(`   💊 ${treatment.text}`);
                        } else if (treatment.type === 'goal') {
                            result.push(`   🎯 ${treatment.text}`);
                        } else if (treatment.type === 'surgical') {
                            result.push(`   🔪 ${treatment.text}`);
                        } else if (treatment.type === 'rehabilitation') {
                            result.push(`   🏃 ${treatment.text}`);
                        }
                    });
                    if (rec.treatments.length > 2) result.push(`   📋 ... и еще ${rec.treatments.length - 2} методов`);
                }
                
                if (rec.critical_mismatch) result.push(`   ⚠️ Критическое несоответствие критериям`);
                else if (rec.has_contradictions) result.push(`   ⚠️ Требуется уточнение данных`);
            });
        }
        
        // Итоговая рекомендация
        if (Object.keys(recommendations_by_diagnosis).length > 0) {
            result.push("\n💡 **ОСНОВНАЯ РЕКОМЕНДАЦИЯ**");
            const best_recommendations = [];
            
            for (const diagnosis in recommendations_by_diagnosis) {
                const best_rec = recommendations_by_diagnosis[diagnosis][0];
                if (best_rec.match_score >= 50 && !best_rec.critical_mismatch) {
                    best_recommendations.push({
                        diagnosis: diagnosis,
                        variant: best_rec.variant_name,
                        score: best_rec.match_score,
                        treatments: best_rec.treatments
                    });
                }
            }
            
            if (best_recommendations.length > 0) {
                best_recommendations.sort((a, b) => b.score - a.score);
                const best = best_recommendations[0];
                
                result.push(`   **${best.diagnosis}:** ${best.variant}`);
                
                if (best.treatments && best.treatments.length > 0) {
                    const main_treatment = best.treatments.find(t => 
                        t.type === 'combination' || t.type === 'medication'
                    ) || best.treatments[0];
                    
                    if (main_treatment.type === 'combination' && main_treatment.drugs) {
                        result.push(`   **Препараты:** ${main_treatment.drugs.join(' + ')}`);
                    } else if (main_treatment.text) {
                        result.push(`   **Лечение:** ${main_treatment.text}`);
                    }
                }
                
                result.push(`   **Уверенность:** ${Math.round(best.score)}%`);
                
                if (best_recommendations.length > 1) {
                    result.push(`\n💡 **ДОПОЛНИТЕЛЬНО**`);
                    for (let i = 1; i < Math.min(best_recommendations.length, 3); i++) {
                        const rec = best_recommendations[i];
                        result.push(`   • ${rec.diagnosis}: ${rec.variant} (${Math.round(rec.score)}%)`);
                    }
                }
            } else {
                result.push("   Требуется дополнительное обследование для уточнения критериев");
            }
        }
    }

    // Краткие общие рекомендации
    result.push("\n📋 **СЛЕДУЮЩИЕ ШАГИ**");
    
    const has_hepatitis = patient_diagnoses.some(d => d.toLowerCase().includes('хвгс') || d.toLowerCase().includes('гепатит') || d.toLowerCase().includes('hcv'));
    const has_hypertension = patient_diagnoses.some(d => d.toLowerCase().includes('гипертензи') || d.toLowerCase().includes('аг') || d.toLowerCase().includes('артериальн'));
    const has_heart_disease = patient_diagnoses.some(d => d.toLowerCase().includes('ибс') || d.toLowerCase().includes('ишемическ') || d.toLowerCase().includes('серд'));
    const has_migraine = patient_diagnoses.some(d => d.toLowerCase().includes('мигрень') || d.toLowerCase().includes('головн'));
    const has_fractures = patient_diagnoses.some(d => d.toLowerCase().includes('перелом') || d.toLowerCase().includes('травм') || d.toLowerCase().includes('вывих'));

    if (has_hepatitis) {
        result.push("   • Проконсультируйтесь с гепатологом");
        if (!patient_data["Анализ крови на гепатит С с определением генотипа_Результат"]) result.push("   • Уточните генотип вируса гепатита С");
        if (!patient_data["Цирроз печени"] && !patient_data["Трансплантация печени"]) result.push("   • Оцените степень фиброза печени (Фиброскан/Фибротест)");
    }
    
    if (has_hypertension) {
        result.push("   • Проконсультируйтесь с кардиологом");
        if (!patient_data["Артериальное давление"] || typeof patient_data["Артериальное давление"] === 'string') result.push("   • Проведите суточный мониторинг артериального давления");
        result.push("   • Оцените функцию почек и электролитный баланс");
    }
    
    if (has_heart_disease) {
        result.push("   • Выполните ЭКГ и ЭхоКГ");
        result.push("   • Оцените риск сердечно-сосудистых осложнений");
        if (patient_data["Возраст"] > 40) result.push("   • Рассмотрите нагрузочные тесты");
    }
    
    if (has_migraine) {
        result.push("   • Проконсультируйтесь с неврологом");
        result.push("   • Ведите дневник головной боли");
        if (patient_data["Приступ мигрени"] === 'тяжелый') result.push("   • Рассмотрите профилактическую терапию");
    }
    
    if (has_fractures) {
        result.push("   • Проконсультируйтесь с травматологом");
        result.push("   • Выполните контрольную рентгенографию");
        result.push("   • Начните раннюю реабилитацию");
    }
    
    if (!has_hepatitis && !has_hypertension && !has_heart_disease && !has_migraine && !has_fractures) {
        result.push("   • Проконсультируйтесь с профильным специалистом");
        result.push("   • Проведите дополнительное обследование");
    }
    
    result.push("   • Учитывайте индивидуальные особенности пациента");
    result.push("   • Мониторируйте эффективность лечения");

    return result.join("\n");
}

function extract_patient_diagnoses(patient_data) {
    const diagnoses = new Set();
    const possible_diagnosis_fields = ["Клинический диагноз", "Диагноз", "Основной диагноз", "Сопутствующий диагноз", "Заключительный диагноз", "диагноз"];
    
    console.log("🔍 Поиск диагнозов в данных:", patient_data);
    
    possible_diagnosis_fields.forEach(field => {
        if (patient_data[field]) {
            console.log(`Найдено поле ${field}:`, patient_data[field]);
            let diagnosis_value = patient_data[field];
            
            // Если значение - объект (может быть из-за структуры GUI)
            if (typeof diagnosis_value === 'object' && diagnosis_value !== null) {
                // Пытаемся извлечь значение из объекта
                if (diagnosis_value["Значение"] !== undefined) {
                    diagnosis_value = diagnosis_value["Значение"];
                    console.log(`Извлечено Значение из объекта:`, diagnosis_value);
                } else if (diagnosis_value["value"] !== undefined) {
                    diagnosis_value = diagnosis_value["value"];
                } else if (diagnosis_value["Текст"] !== undefined) {
                    diagnosis_value = diagnosis_value["Текст"];
                } else {
                    // Если объект, но нет понятных ключей, попробуем найти строку
                    const stringValues = [];
                    function extractStrings(obj) {
                        for (const key in obj) {
                            if (typeof obj[key] === 'string' && obj[key].trim().length > 0) {
                                stringValues.push(obj[key]);
                            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                extractStrings(obj[key]);
                            }
                        }
                    }
                    extractStrings(diagnosis_value);
                    if (stringValues.length > 0) {
                        diagnosis_value = stringValues[0];
                        console.log(`Извлечена строка из объекта:`, diagnosis_value);
                    }
                }
            }
            
            // Обработка полученного значения
            if (diagnosis_value) {
                if (Array.isArray(diagnosis_value)) {
                    diagnosis_value.forEach(diagnosis => {
                        if (diagnosis && typeof diagnosis === 'string' && diagnosis.trim()) {
                            diagnoses.add(diagnosis.trim());
                            console.log(`Добавлен диагноз из массива: ${diagnosis.trim()}`);
                        }
                    });
                } else if (typeof diagnosis_value === 'string' && diagnosis_value.trim()) {
                    diagnoses.add(diagnosis_value.trim());
                    console.log(`Добавлен диагноз: ${diagnosis_value.trim()}`);
                }
            }
        }
    });
    
    const result = Array.from(diagnoses).filter(d => d.length > 0);
    console.log("📋 Найденные диагнозы:", result);
    return result;
}

function find_diagnoses_in_object(obj, diagnoses) {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim() && (key.toLowerCase().includes('диагноз') || value.length > 10)) diagnoses.add(value.trim());
        else if (typeof value === 'object') find_diagnoses_in_object(value, diagnoses);
    }
}

function filter_recommendations_by_diagnosis(recommendations, patient_diagnoses) {
    if (!patient_diagnoses.length) return recommendations;
    
    const filtered = [];
    const diagnosis_mapping = {
        'хвгс': ['хронический вирусный гепатит c', 'гепатит', 'хвгс'],
        'цирроз печени': ['цирроз', 'печень', 'хвгс с цп'],
        'ибс': ['стабильная ибс', 'ишемическая болезнь сердца', 'стенокардия'],
        'аг': ['артериальная гипертензия', 'гипертензия', 'гипертония'],
        'мигрень': ['мигрень', 'головная боль'],
        'перелом лодыжки': ['переломы лодыжек', 'лодыжка', 'перелом'],
        'повреждение связок коленного сустава': ['повреждение связок коленного сустава', 'крестообразной связки', 'колен']
    };
    
    recommendations.forEach(rec => {
        const rec_diagnosis_lower = rec.diagnosis.toLowerCase();
        let should_include = false;
        
        for (const patient_diagnosis of patient_diagnoses) {
            const patient_diagnosis_lower = patient_diagnosis.toLowerCase();
            
            if (rec_diagnosis_lower.includes(patient_diagnosis_lower) || patient_diagnosis_lower.includes(rec_diagnosis_lower)) {
                should_include = true;
                break;
            }
            
            if (diagnosis_mapping[patient_diagnosis_lower]) {
                const mapped_keywords = diagnosis_mapping[patient_diagnosis_lower];
                const has_mapped_match = mapped_keywords.some(keyword => rec_diagnosis_lower.includes(keyword) || keyword.includes(rec_diagnosis_lower));
                if (has_mapped_match) {
                    should_include = true;
                    break;
                }
            }
            
            const patient_words = patient_diagnosis_lower.split(/\s+/).filter(w => w.length > 3);
            const rec_words = rec_diagnosis_lower.split(/\s+/).filter(w => w.length > 3);
            const keyword_match = patient_words.some(pw => rec_words.some(rw => pw.includes(rw) || rw.includes(pw)));
            if (keyword_match) {
                should_include = true;
                break;
            }
        }
        
        if (should_include) filtered.push(rec);
    });
    
    return filtered;
}

function find_all_recommendations(knowledge_base, patient_data, patient_diagnoses, current_path = "") {
    const recommendations = [];
    if (!knowledge_base || typeof knowledge_base !== 'object') return recommendations;
    
    for (const key in knowledge_base) {
        const value = knowledge_base[key];
        const new_path = current_path ? `${current_path}.${key}` : key;
        
        if (is_recommendation_structure(value)) {
            const recs = extract_recommendations_from_structure(value, patient_data, patient_diagnoses, new_path);
            recommendations.push(...recs);
        }
        
        if (typeof value === 'object' && value !== null) {
            const nested_recs = find_all_recommendations(value, patient_data, patient_diagnoses, new_path);
            recommendations.push(...nested_recs);
        }
    }
    
    return recommendations;
}

function is_recommendation_structure(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const keys = Object.keys(obj);
    
    const has_treatment_keywords = keys.some(key => {
        const keyLower = key.toLowerCase();
        return keyLower.includes('вариант') || keyLower.includes('инструкция') || keyLower.includes('лечение') || keyLower.includes('план') || keyLower.includes('рекомендация');
    });
    
    const has_nested_instructions = keys.some(key => {
        const nested = obj[key];
        if (nested && typeof nested === 'object') {
            return Object.keys(nested).some(nestedKey => {
                const nestedKeyLower = nestedKey.toLowerCase();
                return nestedKeyLower.includes('инструкция') || nestedKeyLower.includes('план');
            });
        }
        return false;
    });
    
    return has_treatment_keywords || has_nested_instructions;
}

function extract_recommendations_from_structure(structure, patient_data, patient_diagnoses, path) {
    const recommendations = [];
    if (!structure || typeof structure !== 'object') return recommendations;
    
    for (const key in structure) {
        const value = structure[key];
        
        if (typeof value === 'object' && is_treatment_variant_level(value)) {
            for (const variant_name in value) {
                const variant_data = value[variant_name];
                if (variant_data && typeof variant_data === 'object') {
                    const recs = process_treatment_variant(variant_data, variant_name, `${path}.${key}`, patient_data, patient_diagnoses);
                    recommendations.push(...recs);
                }
            }
        } else if (typeof value === 'object') {
            const nested_recs = extract_recommendations_from_structure(value, patient_data, patient_diagnoses, `${path}.${key}`);
            recommendations.push(...nested_recs);
        }
    }
    
    return recommendations;
}

function is_treatment_variant_level(obj) {
    if (!obj || typeof obj !== 'object') return false;
    for (const key in obj) {
        const value = obj[key];
        if (value && typeof value === 'object') {
            if (value['Инструкция'] || value['инструкция'] || value['Instruction'] || value['instruction'] || value['План лечебных действий'] || value['План']) return true;
            const nestedKeys = Object.keys(value);
            const hasNestedTreatment = nestedKeys.some(nestedKey => {
                const nestedKeyLower = nestedKey.toLowerCase();
                return nestedKeyLower.includes('лечение') || nestedKeyLower.includes('терапия');
            });
            if (hasNestedTreatment) return true;
        }
    }
    return false;
}

function process_treatment_variant(variant_data, variant_name, path, patient_data, patient_diagnoses) {
    const recommendations = [];
    if (!variant_data || typeof variant_data !== 'object') return recommendations;
    
    const instruction_keys = ['Инструкция', 'инструкция', 'Instruction', 'instruction'];
    let instructions = null;
    
    for (const instr_key of instruction_keys) {
        if (variant_data[instr_key]) {
            instructions = variant_data[instr_key];
            break;
        }
    }
    
    if (!instructions || typeof instructions !== 'object') return recommendations;
    
    for (const instr_key in instructions) {
        const instruction = instructions[instr_key];
        if (instruction && typeof instruction === 'object') {
            const match_result = evaluate_universal_match(patient_data, instruction, variant_name);
            const treatments = extract_universal_treatment(instruction);
            const diagnosis = extract_diagnosis_from_path(path, patient_diagnoses);
            
            if (treatments.length > 0 || match_result.score >= 40) {
                recommendations.push({
                    diagnosis: diagnosis,
                    variant_name: variant_name,
                    treatments: treatments,
                    match_score: match_result.score,
                    explanations: match_result.explanations,
                    has_contradictions: match_result.has_contradictions,
                    path: path
                });
            }
        }
    }
    
    return recommendations;
}

function evaluate_universal_match(patient_data, instruction, variant_name) {
    let match_score = 50;
    const explanations = [];
    let has_contradictions = false;
    let critical_mismatch = false;

    const category_keys = ['Категория пациента', 'категория', 'Category', 'category', 'Пациент', 'patient'];
    let patient_category = null;
    
    for (const cat_key of category_keys) {
        if (instruction[cat_key]) {
            patient_category = instruction[cat_key];
            break;
        }
    }
    
    if (patient_category && typeof patient_category === 'object') {
        explanations.push("👤 Учитывается категория пациента");
        
        const factor_keys = ['Фактор', 'фактор', 'Factor', 'factor', 'Критерии', 'criteria'];
        for (const factor_key of factor_keys) {
            if (patient_category[factor_key]) {
                const factors = patient_category[factor_key];
                const factor_match = evaluate_factors(patient_data, factors);
                match_score += factor_match.score;
                explanations.push(...factor_match.explanations);
                if (factor_match.has_contradictions) has_contradictions = true;
                if (factor_match.critical_mismatch) critical_mismatch = true;
            }
        }
        
        const observation_keys = ['Наблюдение', 'наблюдение', 'Observation', 'observation', 'Симптомы', 'symptoms'];
        for (const obs_key of observation_keys) {
            if (patient_category[obs_key]) {
                const observations = patient_category[obs_key];
                const obs_match = evaluate_observations(patient_data, observations);
                match_score += obs_match.score;
                explanations.push(...obs_match.explanations);
            }
        }
        
        if (patient_category['Возраст'] || patient_category['Age'] || patient_category['age']) {
            const age_match = evaluate_age(patient_data, patient_category);
            match_score += age_match.score;
            if (age_match.explanation) explanations.push(age_match.explanation);
            if (age_match.critical_mismatch) critical_mismatch = true;
        }
        
        const stage_keys = ['Стадия', 'стадия', 'Stage', 'stage', 'Состояние', 'condition'];
        for (const stage_key of stage_keys) {
            if (patient_category[stage_key]) {
                const stage_match = evaluate_stage(patient_data, patient_category[stage_key]);
                match_score += stage_match.score;
                explanations.push(...stage_match.explanations);
                if (stage_match.critical_mismatch) critical_mismatch = true;
            }
        }
    } else {
        explanations.push("ℹ️ Общий вариант (без специфической категории)");
    }
    
    if (critical_mismatch) {
        match_score = Math.max(0, match_score - 40);
        explanations.push("❌ Критическое несоответствие критериям (-40)");
    }
    
    const plan_keys = ['План лечебных действий', 'План', 'план', 'Treatment Plan', 'plan', 'Лечение', 'treatment'];
    let has_treatment_plan = false;
    
    for (const plan_key of plan_keys) {
        if (instruction[plan_key]) {
            has_treatment_plan = true;
            explanations.push("💊 Имеется план лечения");
            match_score += 20;
            break;
        }
    }
    
    if (has_contradictions) match_score = Math.max(0, match_score - 20);
    if (!has_treatment_plan) match_score = Math.max(0, match_score - 15);
    
    match_score = Math.min(100, Math.max(0, match_score));
    
    return { score: match_score, explanations, has_contradictions, critical_mismatch };
}

function evaluate_factors(patient_data, factors) {
    let score = 0;
    const explanations = [];
    let has_contradictions = false;
    let critical_mismatch = false;
    let factors_checked = 0;
    let factors_matched = 0;
    let factors_critical = 0;
    
    if (!factors || typeof factors !== 'object') return { score, explanations, has_contradictions, critical_mismatch };
    
    for (const factor_name in factors) {
        const factor_data = factors[factor_name];
        factors_checked++;
        const patient_value = extract_patient_value(patient_data, factor_name);
        const factor_evaluation = evaluate_single_factor(patient_value, factor_data, factor_name);
        
        score += factor_evaluation.score;
        explanations.push(...factor_evaluation.explanations);
        if (factor_evaluation.matched) factors_matched++;
        if (factor_evaluation.critical_mismatch) {
            critical_mismatch = true;
            factors_critical++;
        }
    }
    
    if (factors_checked > 0) {
        const match_rate = factors_matched / factors_checked;
        if (match_rate >= 0.8) score += 25;
        else if (match_rate >= 0.5) score += 15;
        else if (match_rate >= 0.3) score += 5;
    }
    
    if (factors_critical > 0) score = Math.max(0, score - factors_critical * 20);
    
    return { score, explanations, has_contradictions, critical_mismatch };
}

function evaluate_single_factor(patient_value, factor_data, factor_name) {
    let score = 0;
    const explanations = [];
    let matched = false;
    let critical_mismatch = false;
    
    if (patient_value === null || patient_value === undefined || patient_value === "") {
        explanations.push(`❓ Фактор '${factor_name}': неизвестен`);
        return { score, explanations, matched, critical_mismatch };
    }
    
    if (typeof factor_data === 'object') {
        const char_match = evaluate_factor_characteristics(patient_value, factor_data, factor_name);
        score += char_match.score;
        explanations.push(...char_match.explanations);
        matched = char_match.matched;
        critical_mismatch = char_match.critical_mismatch;
    } else if (typeof factor_data === 'string' || typeof factor_data === 'number') {
        if (patient_value == factor_data) {
            score += 10;
            matched = true;
            explanations.push(`✅ Фактор '${factor_name}': соответствует`);
        } else {
            score -= 5;
            explanations.push(`❌ Фактор '${factor_name}': не соответствует`);
        }
    } else {
        explanations.push(`❓ Фактор '${factor_name}': учтен`);
        score += 5;
    }
    
    return { score, explanations, matched, critical_mismatch };
}

function evaluate_factor_characteristics(patient_value, factor_data, factor_name) {
    let score = 0;
    const explanations = [];
    let matched = false;
    let critical_mismatch = false;
    
    if (factor_data['Числовое значение']) {
        const num_match = evaluate_numeric_factor(patient_value, factor_data['Числовое значение'], factor_name);
        score += num_match.score;
        explanations.push(...num_match.explanations);
        matched = num_match.matched;
        critical_mismatch = num_match.critical_mismatch;
    } else if (factor_data['Качественное значение']) {
        const qual_match = evaluate_qualitative_factor(patient_value, factor_data['Качественное значение'], factor_name);
        score += qual_match.score;
        explanations.push(...qual_match.explanations);
        matched = qual_match.matched;
    } else if (factor_data['Характеристика']) {
        explanations.push(`✅ Фактор '${factor_name}': учтены характеристики`);
        score += 10;
        matched = true;
    } else {
        explanations.push(`✅ Фактор '${factor_name}': учтен`);
        score += 5;
        matched = true;
    }
    
    return { score, explanations, matched, critical_mismatch };
}

function evaluate_numeric_factor(patient_value, numeric_data, factor_name) {
    let score = 0;
    const explanations = [];
    let matched = false;
    let critical_mismatch = false;
    
    const patient_num = Number(patient_value);
    if (isNaN(patient_num)) {
        explanations.push(`❓ Фактор '${factor_name}': нечисловое значение`);
        return { score, explanations, matched, critical_mismatch };
    }
    
    const min = numeric_data['нижняя граница'];
    const max = numeric_data['верхняя граница'];
    
    if (min !== undefined && max !== undefined) {
        if (patient_num >= min && patient_num <= max) {
            score += 15;
            matched = true;
            explanations.push(`✅ Фактор '${factor_name}': значение ${patient_num} в диапазоне ${min}-${max}`);
        } else {
            score -= 15;
            critical_mismatch = true;
            explanations.push(`❌ Фактор '${factor_name}': значение ${patient_num} вне диапазона ${min}-${max}`);
        }
    } else if (min !== undefined) {
        if (patient_num >= min) {
            score += 10;
            matched = true;
            explanations.push(`✅ Фактор '${factor_name}': значение ${patient_num} >= ${min}`);
        } else {
            score -= 10;
            critical_mismatch = true;
            explanations.push(`❌ Фактор '${factor_name}': значение ${patient_num} < ${min}`);
        }
    } else {
        explanations.push(`✅ Фактор '${factor_name}': значение ${patient_num}`);
        score += 5;
        matched = true;
    }
    
    return { score, explanations, matched, critical_mismatch };
}

function evaluate_qualitative_factor(patient_value, qualitative_data, factor_name) {
    let score = 0;
    const explanations = [];
    let matched = false;
    
    const patient_str = String(patient_value).toLowerCase();
    const qual_options = Object.keys(qualitative_data);
    
    for (const option of qual_options) {
        if (patient_str === option.toLowerCase()) {
            score += 12;
            matched = true;
            explanations.push(`✅ Фактор '${factor_name}': соответствует '${option}'`);
            break;
        }
    }
    
    if (!matched) {
        for (const option of qual_options) {
            if (patient_str.includes(option.toLowerCase()) || option.toLowerCase().includes(patient_str)) {
                score += 8;
                matched = true;
                explanations.push(`⚠️ Фактор '${factor_name}': частичное совпадение с '${option}'`);
                break;
            }
        }
    }
    
    if (!matched) {
        score -= 5;
        explanations.push(`❌ Фактор '${factor_name}': значение '${patient_value}' не соответствует вариантам`);
    }
    
    return { score, explanations, matched };
}

function evaluate_observations(patient_data, observations) {
    let score = 0;
    const explanations = [];
    
    if (!observations) return { score, explanations };
    
    if (Array.isArray(observations)) {
        observations.forEach(obs => {
            if (obs && typeof obs === 'object') {
                explanations.push("📊 Учтены наблюдения пациента");
                score += 5;
            }
        });
    } else if (typeof observations === 'object') {
        explanations.push("📊 Учтены наблюдения пациента");
        score += 10;
    }
    
    return { score, explanations };
}

function evaluate_age(patient_data, category) {
    let score = 0;
    let explanation = "";
    let critical_mismatch = false;
    
    const patient_age = patient_data["Возраст"];
    if (!patient_age) return { score, explanation, critical_mismatch };
    
    const age_ranges = [];
    
    function findAgeRanges(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
            const value = obj[key];
            if (key.toLowerCase().includes('возраст') || key.toLowerCase().includes('age')) {
                if (value && typeof value === 'object') {
                    if (value['Числовое значение'] && value['Числовое значение']['нижняя граница'] !== undefined) {
                        age_ranges.push({ min: value['Числовое значение']['нижняя граница'], max: value['Числовое значение']['верхняя граница'] || 999 });
                    } else if (value['нижняя граница'] !== undefined) {
                        age_ranges.push({ min: value['нижняя граница'], max: value['верхняя граница'] || 999 });
                    } else if (value['Качественное значение']) {
                        const qual_values = value['Качественное значение'];
                        for (const qual_key in qual_values) {
                            if (qual_key.toLowerCase().includes('пожил') || qual_key.toLowerCase().includes('старш')) age_ranges.push({ min: 65, max: 999, type: 'qualitative' });
                            else if (qual_key.toLowerCase().includes('взросл')) age_ranges.push({ min: 18, max: 64, type: 'qualitative' });
                            else if (qual_key.toLowerCase().includes('детск')) age_ranges.push({ min: 0, max: 17, type: 'qualitative' });
                        }
                    }
                }
            }
            if (typeof value === 'object') findAgeRanges(value, path + '.' + key);
        }
    }
    
    findAgeRanges(category);
    
    if (age_ranges.length > 0) {
        let has_match = false;
        for (const range of age_ranges) {
            if (patient_age >= range.min && patient_age <= range.max) {
                has_match = true;
                score += 25;
                explanation = `✅ Возраст ${patient_age} лет соответствует диапазону ${range.min}-${range.max} лет`;
                break;
            }
        }
        
        if (!has_match) {
            if (age_ranges.some(range => range.type !== 'qualitative')) {
                critical_mismatch = true;
                score = -30;
                explanation = `❌ Возраст ${patient_age} лет не соответствует диапазону`;
            } else {
                score = -15;
                explanation = `⚠️ Возраст ${patient_age} лет может не соответствовать категории`;
            }
        }
    } else {
        explanation = `ℹ️ Возраст ${patient_age} лет (ограничений нет)`;
        score += 10;
    }
    
    return { score, explanation, critical_mismatch };
}

function evaluate_stage(patient_data, stage_data) {
    let score = 0;
    const explanations = [];
    let critical_mismatch = false;
    
    if (!stage_data || typeof stage_data !== 'object') return { score, explanations, critical_mismatch };
    
    for (const stage_key in stage_data) {
        const stage_value = stage_data[stage_key];
        if (typeof stage_value === 'string' || Array.isArray(stage_value)) {
            const stage_text = Array.isArray(stage_value) ? stage_value.join(', ') : stage_value;
            explanations.push(`📋 Требуется: ${stage_text}`);
            score += 5;
        }
    }
    
    return { score, explanations, critical_mismatch };
}

function extract_universal_treatment(instruction) {
    const treatments = [];
    if (!instruction || typeof instruction !== 'object') return treatments;
    
    const plan_keys = ['План лечебных действий', 'План', 'план', 'Treatment Plan', 'plan'];
    let treatment_plan = null;
    
    for (const plan_key of plan_keys) {
        if (instruction[plan_key]) {
            treatment_plan = instruction[plan_key];
            break;
        }
    }
    
    if (!treatment_plan) return treatments;
    
    const treatment_keys = ['вариант лечения', 'лечение', 'treatment', 'Вариант лечения', 'Терапия', 'therapy'];
    for (const treat_key of treatment_keys) {
        if (treatment_plan[treat_key]) {
            const treatment_options = treatment_plan[treat_key];
            const extracted = extract_treatment_methods(treatment_options);
            treatments.push(...extracted);
        }
    }
    
    const goal_keys = ['Цель', 'цель', 'Goal', 'goal'];
    for (const goal_key of goal_keys) {
        if (treatment_plan[goal_key]) {
            const goals = extract_treatment_goals(treatment_plan[goal_key]);
            treatments.push(...goals);
        }
    }
    
    return treatments;
}

function extract_treatment_methods(treatment_data) {
    const treatments = [];
    if (!treatment_data || typeof treatment_data !== 'object') return treatments;
    
    for (const treatment_key in treatment_data) {
        const treatment = treatment_data[treatment_key];
        if (treatment && typeof treatment === 'object') {
            if (treatment['медикаментозное'] || treatment['medication']) {
                const med_data = treatment['медикаментозное'] || treatment['medication'];
                const med_treatments = extract_medication_treatment(med_data);
                treatments.push(...med_treatments);
            }
            
            if (treatment['хирургическое'] || treatment['surgical']) {
                const surgical_data = treatment['хирургическое'] || treatment['surgical'];
                const surgical_treatments = extract_surgical_treatment(surgical_data);
                treatments.push(...surgical_treatments);
            }
            
            if (treatment['иное'] || treatment['other']) {
                const other_data = treatment['иное'] || treatment['other'];
                const other_treatments = extract_other_treatment(other_data);
                treatments.push(...other_treatments);
            }
            
            if (treatment['метод реабилитации'] || treatment['rehabilitation']) {
                const rehab_data = treatment['метод реабилитации'] || treatment['rehabilitation'];
                const rehab_treatments = extract_rehabilitation_treatment(rehab_data);
                treatments.push(...rehab_treatments);
            }
        }
    }
    
    return treatments;
}

function extract_medication_treatment(med_data) {
    const treatments = [];
    if (!med_data || typeof med_data !== 'object') return treatments;
    
    if (med_data['Действующее вещество'] || med_data['Active Substance']) {
        const substances = med_data['Действующее вещество'] || med_data['Active Substance'];
        for (const substance_name in substances) {
            const substance_data = substances[substance_name];
            const details = [];
            
            if (substance_data && typeof substance_data === 'object') {
                if (substance_data['режим'] || substance_data['regimen']) details.push(`Режим: ${substance_data['режим'] || substance_data['regimen']}`);
                if (substance_data['дозировка'] || substance_data['dosage']) details.push(`Доза: ${substance_data['дозировка'] || substance_data['dosage']}`);
            }
            
            treatments.push({ type: 'medication', text: substance_name, details: details.length > 0 ? details : ['Стандартный режим приема'] });
        }
    }
    
    if (med_data['комбинация'] || med_data['combination']) {
        const combination = med_data['комбинация'] || med_data['combination'];
        if (combination && typeof combination === 'object') {
            if (combination['Действующее вещество'] || combination['Active Substance']) {
                const substances = combination['Действующее вещество'] || combination['Active Substance'];
                const substance_names = Object.keys(substances);
                if (substance_names.length > 0) {
                    treatments.push({ type: 'combination', text: 'Комбинация препаратов', drugs: substance_names, details: [`Состав: ${substance_names.join(' + ')}`] });
                }
            }
        }
    }
    
    if (med_data['Фарм-группа'] || med_data['Pharma Group']) {
        const groups = med_data['Фарм-группа'] || med_data['Pharma Group'];
        for (const group_name in groups) {
            treatments.push({ type: 'medication', text: group_name, details: ['Препараты выбора из указанной группы'] });
        }
    }
    
    return treatments;
}

function extract_surgical_treatment(surgical_data) {
    const treatments = [];
    if (!surgical_data || typeof surgical_data !== 'object') return treatments;
    
    for (const procedure_name in surgical_data) {
        const procedure_data = surgical_data[procedure_name];
        const details = [];
        
        if (procedure_data && typeof procedure_data === 'object') {
            if (procedure_data['уточнение'] || procedure_data['details']) {
                const clarifications = procedure_data['уточнение'] || procedure_data['details'];
                if (Array.isArray(clarifications)) details.push(...clarifications);
                else if (typeof clarifications === 'string') details.push(clarifications);
            }
        }
        
        treatments.push({ type: 'goal', text: `Хирургическое: ${procedure_name}`, details: details.length > 0 ? details : ['Плановое хирургическое вмешательство'] });
    }
    
    return treatments;
}

function extract_other_treatment(other_data) {
    const treatments = [];
    if (!other_data || typeof other_data !== 'object') return treatments;
    
    for (const method_name in other_data) {
        treatments.push({ type: 'other', text: method_name, details: ['Вспомогательный метод лечения'] });
    }
    
    return treatments;
}

function extract_rehabilitation_treatment(rehab_data) {
    const treatments = [];
    if (!rehab_data || typeof rehab_data !== 'object') return treatments;
    
    for (const method_name in rehab_data) {
        treatments.push({ type: 'rehabilitation', text: method_name, details: ['Метод реабилитации'] });
    }
    
    return treatments;
}

function extract_treatment_goals(goal_data) {
    const goals = [];
    if (!goal_data || typeof goal_data !== 'object') return goals;
    
    for (const goal_key in goal_data) {
        const goal = goal_data[goal_key];
        if (goal && typeof goal === 'object') {
            for (const action in goal) {
                const action_data = goal[action];
                if (action_data && typeof action_data === 'object') {
                    if (action_data['Наблюдение'] || action_data['Observation']) {
                        const observations = action_data['Наблюдение'] || action_data['Observation'];
                        for (const obs_name in observations) {
                            goals.push({ type: 'goal', text: `${action} ${obs_name}`, details: [`Достижение целевого состояния: ${obs_name}`] });
                        }
                    }
                    
                    if (action_data['результата-факта'] || action_data['result']) {
                        const result = action_data['результата-факта'] || action_data['result'];
                        for (const result_name in result) {
                            goals.push({ type: 'goal', text: `${action} ${result_name}`, details: [`Целевой результат: ${result_name}`] });
                        }
                    }
                } else if (typeof action_data === 'string') {
                    goals.push({ type: 'goal', text: `${action} ${action_data}`, details: [`Целевой показатель: ${action_data}`] });
                }
            }
        }
    }
    
    return goals;
}

function extract_diagnosis_from_path(path, patient_diagnoses) {
    const path_parts = path.split('.');
    for (const part of path_parts) {
        if (part.length > 3 && !part.includes('КлинРек') && !part.includes('ур') && !part.includes('Заболевание') && !part.includes('Вариант') && !part.includes('инструкция')) {
            return part;
        }
    }
    return patient_diagnoses[0] || "Неизвестный диагноз";
}

function extract_patient_value(patient_data, field_name) {
    if (!patient_data || typeof patient_data !== 'object') return null;
    if (field_name in patient_data && patient_data[field_name] !== null && patient_data[field_name] !== "") return patient_data[field_name];
    
    const lower_field = field_name.toLowerCase().replace(/\s+/g, "");
    for (const key in patient_data) {
        if (key.toLowerCase().replace(/\s+/g, "") === lower_field && patient_data[key] !== null && patient_data[key] !== "") {
            return patient_data[key];
        }
    }
    return null;
}

function showAnalysisResults(explanation, patient_data) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (resultsDiv && analysisResultsDiv) {
        const formattedExplanation = explanation.replace(/\n/g, '<br>');
        analysisResultsDiv.innerHTML = `
            <div class="analysis-result analysis-success">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 10px; border-left: 4px solid #28a745; font-family: Arial, sans-serif; line-height: 1.5;">
                    ${formattedExplanation}
                </div>
            </div>
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #666;">📊 Показать детальные данные</summary>
                <div style="margin-top: 10px;">
                    <strong>Данные для анализа:</strong>
                    <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; max-height: 200px; overflow-y: auto; font-size: 12px;">${JSON.stringify(patient_data, null, 2)}</pre>
                </div>
            </details>
        `;
        resultsDiv.style.display = 'block';
    }
}

function showErrorResults(error) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (resultsDiv && analysisResultsDiv) {
        analysisResultsDiv.innerHTML = `
            <div class="analysis-result analysis-error">
                <strong>Ошибка анализа:</strong>
                <p style="color: #dc3545;">${error.message}</p>
                <details style="margin-top: 10px;">
                    <summary>Подробности ошибки</summary>
                    <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px;">${error.stack}</pre>
                </details>
            </div>
        `;
        resultsDiv.style.display = 'block';
    }
}

window.analyzeData = analyzeData;