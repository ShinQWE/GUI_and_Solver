// УНИВЕРСАЛЬНЫЙ РЕШАТЕЛЬ ДЛЯ ЛЮБЫХ КЛИНИЧЕСКИХ РЕКОМЕНДАЦИЙ
console.log("✅ Solver.js загружен, версия: " + new Date().toISOString());
function analyzeData() {
    if (!window.knowledgeBase) {
        window.showNotification?.("Сначала загрузите базу знаний!", "error");
        return;
    }

    const patient_data = window.extract_patient_data?.() || {};
    
    // Сохраняем диагнозы для детального анализа
    const diagnosis = extractPatientDiagnosis(patient_data);
    window.patientDiagnoses = diagnosis ? [diagnosis] : [];
    
    console.log("=== ДЕБАГ ПЕРЕД АНАЛИЗОМ ===");
    console.log("Данные пациента:", patient_data);
    
    if (Object.keys(patient_data).length === 0) {
        window.showNotification?.("Нет данных пациента! Заполните форму", "error");
        return;
    }

    try {
        console.log("🎯 ЗАПУСК АНАЛИЗА");
        
        const explanation = generate_universal_explanation(patient_data, window.knowledgeBase);
        
        // Сохраняем для повторного использования
        window.lastExplanation = explanation;
        window.lastPatientData = patient_data;
        
        showAnalysisResults(explanation, patient_data);
        window.showNotification?.("Анализ завершен успешно!", "success");
    } catch (error) {
        console.error("❌ Ошибка анализа:", error);
        showErrorResults(error);
        window.showNotification?.("Ошибка при анализе: " + error.message, "error");
    }
}

// Новая функция для проверки наличия генотипа в форме
function checkIfGenotypeExistsInForm() {
    if (!window.allTabsData) return false;
    
    for (const tabName in window.allTabsData) {
        const tabData = window.allTabsData[tabName];
        
        // Проверяем плоские данные
        for (const fieldName in tabData.data) {
            const fieldNameLower = fieldName.toLowerCase();
            if (fieldNameLower.includes('генотип') || 
                fieldNameLower.includes('genotype') ||
                fieldNameLower.includes('анализ крови на гепатит')) {
                const value = tabData.data[fieldName];
                if (value && value !== '' && value !== 'не определен') {
                    return true;
                }
            }
        }
        
        // Проверяем иерархические данные
        if (tabData.hierarchicalData) {
            for (const parentField in tabData.hierarchicalData) {
                if (parentField.toLowerCase().includes('анализ крови на гепатит')) {
                    const hepatitisData = tabData.hierarchicalData[parentField];
                    if (hepatitisData && hepatitisData['Результат'] && 
                        hepatitisData['Результат'] !== '' && hepatitisData['Результат'] !== 'не определен') {
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
}

// Функция для поиска генотипа в данных пациента
function findGenotypeInPatientData(patientData) {
    if (!patientData) return null;
    
    // Ищем генотип в разных возможных полях
    const genotypeFields = [
        'Анализ крови на гепатит С с определением генотипа_Результат',
        'Генотип',
        'Генотип вируса',
        'Генотип HCV',
        'Генотип гепатита С'
    ];
    
    for (const field of genotypeFields) {
        if (patientData[field] && 
            patientData[field] !== '' && 
            patientData[field] !== 'не определен' &&
            patientData[field] !== null &&
            patientData[field] !== undefined) {
            
            // Если это массив, берем первое значение
            if (Array.isArray(patientData[field])) {
                return patientData[field][0] || null;
            }
            return String(patientData[field]);
        }
    }
    
    return null;
}

function generate_universal_explanation(patient_data, knowledge_base) {
    console.log("=== НАЧАЛО generate_universal_explanation ===");
    console.log("Данные пациента:", patient_data);
    
    if (!patient_data || Object.keys(patient_data).length === 0) {
        return "❌ Данные пациента отсутствуют или имеют неверный формат.";
    }

    const result = [];
    const patientDiagnosis = extractPatientDiagnosis(patient_data);
    
    if (!patientDiagnosis) {
        result.push("❌ Не удалось определить диагноз пациента.");
        return result.join("\n");
    }

    console.log("📋 Диагноз пациента:", patientDiagnosis);

    result.push(`🎯 **ДИАГНОЗ:** ${patientDiagnosis}`);
    result.push("");

    const klinrek = knowledge_base["КлинРек II ур"];
    if (!klinrek) {
        result.push("❌ База знаний имеет неверный формат");
        return result.join("\n");
    }

    const diseases = klinrek["Заболевание"];
    if (!diseases || !diseases[patientDiagnosis]) {
        result.push(`❌ В базе знаний нет рекомендаций для диагноза: ${patientDiagnosis}`);
        return result.join("\n");
    }

    const diseaseSection = diseases[patientDiagnosis];
    
    const patientGenotype = findGenotypeInPatientDataAdvanced(patient_data);
    const hasCirrhosis = detectCirrhosis(patient_data);
    const hasTransplant = detectTransplant(patient_data);
    const hasPVTExperience = detectPVTExperience(patient_data);
    
    let allCheckedVariants = [];
    let variantsWithoutCategory = [];
    
    const nodeTypes = [
        { key: "Стадия (Фаза)", priority: 3 },
        { key: "Вариант течения (функциональный класс)", priority: 2 },
        { key: "Функциональный класс заболевания", priority: 1 }
    ];
    
    for (const nodeTypeInfo of nodeTypes) {
        const nodeType = nodeTypeInfo.key;
        const priority = nodeTypeInfo.priority;
        
        const nodeData = diseaseSection[nodeType];
        if (!nodeData) continue;
        
        for (const [variantName, variantData] of Object.entries(nodeData)) {
            if (!variantData["Инструкция"]) continue;
            
            const genotypeSpecificMatch = checkGenotypeSpecificMatch(variantName, patientGenotype);
            const cirrhosisMatch = checkCirrhosisSpecificMatch(variantName, hasCirrhosis);
            const transplantMatch = checkTransplantSpecificMatch(variantName, hasTransplant);
            const pvtMatch = checkPVTSpecificMatch(variantName, hasPVTExperience);
            
            if (genotypeSpecificMatch === false || cirrhosisMatch === false || 
                transplantMatch === false || pvtMatch === false) {
                continue;
            }
            
            let matchScore = 50;
            if (genotypeSpecificMatch === true) matchScore += 30;
            if (cirrhosisMatch === true) matchScore += 20;
            if (transplantMatch === true) matchScore += 20;
            if (pvtMatch === true) matchScore += 15;
            matchScore += priority * 5;
            
            allCheckedVariants.push({
                variantName, nodeType, priority,
                instruction: variantData["Инструкция"],
                matchScore: matchScore,
                genotypeMatch: genotypeSpecificMatch,
                cirrhosisMatch: cirrhosisMatch,
                transplantMatch: transplantMatch,
                pvtMatch: pvtMatch
            });
        }
    }
    
    allCheckedVariants.sort((a, b) => b.matchScore - a.matchScore);
    
    let finalMatch = allCheckedVariants[0] || null;
    let otherVariants = allCheckedVariants.slice(1).filter(v => v.matchScore >= 50);
    
    if (!finalMatch) {
        result.push("❌ **НЕ НАЙДЕНО ПОДХОДЯЩЕГО ВАРИАНТА**");
        return result.join("\n");
    }
    
    // Вывод результата
    result.push(`👤 **${finalMatch.nodeType || "КАТЕГОРИЯ ПАЦИЕНТА"} (из базы знаний):**`);
    result.push(`**Выбранный вариант:** ${finalMatch.variantName}`);
    
    const matches = [];
    if (finalMatch.genotypeMatch === true && patientGenotype) {
        matches.push(`✅ Генотип ${patientGenotype} соответствует`);
    }
    if (finalMatch.cirrhosisMatch === true) {
        matches.push(`✅ Состояние печени соответствует`);
    }
    if (finalMatch.transplantMatch === true) {
        matches.push(`✅ Статус трансплантации соответствует`);
    }
    
    if (matches.length > 0) {
        result.push("**Соответствия:**");
        matches.forEach(m => result.push(`• ${m}`));
    }
    result.push("");
    
    if (otherVariants.length > 0) {
        result.push("📋 **ДРУГИЕ ПОДХОДЯЩИЕ ВАРИАНТЫ:**");
        otherVariants.slice(0, 3).forEach((variant, idx) => {
            result.push(`${idx + 1}. ${variant.variantName}`);
        });
        result.push("");
    }
    
    result.push("💊 **РЕКОМЕНДАЦИЯ ИЗ БАЗЫ ЗНАНИЙ:**");
    result.push(`**Вариант:** ${finalMatch.variantName}`);
    result.push("");
    
    const instruction = finalMatch.instruction;
    let hasSpecificRecommendations = false;
    
    if (instruction) {
        for (const instKey in instruction) {
            const inst = instruction[instKey];
            const treatmentPlan = inst["План лечебных действий"];
            
            if (treatmentPlan && treatmentPlan["вариант лечения"]) {
                const treatments = extractUniversalTreatments(treatmentPlan);
                if (treatments.length > 0) {
                    result.push("**Варианты лечения:**");
                    treatments.forEach((t, idx) => {
                        const clean = t.replace(/\*\*/g, '').trim();
                        result.push(`${idx + 1}. ${clean}`);
                    });
                    result.push("");
                    hasSpecificRecommendations = true;
                }
            }
            
            const goals = extractGoals(treatmentPlan);
            if (goals.length > 0) {
                result.push("**Цели лечения:**");
                goals.forEach((g, idx) => {
                    result.push(`${idx + 1}. ${g}`);
                });
                result.push("");
                hasSpecificRecommendations = true;
            }
        }
    }
    
    if (!hasSpecificRecommendations) {
        result.push("📋 **ОБЩИЕ РЕКОМЕНДАЦИИ:**");
        result.push("1. Выполнить назначенный план лечения");
        result.push("2. Соблюдать все врачебные рекомендации");
        result.push("3. Контролировать состояние в динамике");
        result.push("");
    }
    
    // ===== СОХРАНЯЕМ ДАННЫЕ ДЛЯ ДЕТАЛЬНОГО АНАЛИЗА (С ЛЕЧЕНИЕМ ДЛЯ КАЖДОГО ВАРИАНТА) =====
    
    // Функция для извлечения лечения из инструкции варианта
    function extractTreatmentsForVariant(variantInstruction) {
        const treatmentsList = [];
        if (!variantInstruction) return treatmentsList;
        
        for (const instKey in variantInstruction) {
            const inst = variantInstruction[instKey];
            const treatmentPlan = inst["План лечебных действий"];
            if (treatmentPlan && treatmentPlan["вариант лечения"]) {
                const extracted = extractUniversalTreatments(treatmentPlan);
                treatmentsList.push(...extracted);
            }
        }
        return treatmentsList;
    }
    
    window.lastStructuredData = {
        diagnosis: patientDiagnosis,
        patientData: patient_data,
        selectedVariant: {
            name: finalMatch.variantName,
            score: finalMatch.matchScore,
            nodeType: finalMatch.nodeType,
            matches: matches,
            treatments: extractTreatmentsForVariant(finalMatch.instruction)
        },
        otherVariants: otherVariants.map(v => ({
            name: v.variantName,
            score: v.matchScore,
            nodeType: v.nodeType,
            treatments: extractTreatmentsForVariant(v.instruction)
        })),
        allVariants: allCheckedVariants.map(v => ({
            name: v.variantName,
            score: v.matchScore,
            nodeType: v.nodeType,
            isSelected: v === finalMatch,
            treatments: extractTreatmentsForVariant(v.instruction)
        }))
    };
    
    return result.join("\n");
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function normalizePatientDataForHepatitis(patientData) {
    const normalized = { ...patientData };
    
    // Нормализуем значение цирроза
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('цирроз') || keyLower.includes('цп')) {
            if (value === 'отсутствует' || value === 'нет' || value === false) {
                normalized.hasCirrhosis = false;
            } else if (value === 'есть' || value === 'да' || value === true) {
                normalized.hasCirrhosis = true;
            }
        }
        
        // Нормализуем трансплантацию
        if (keyLower.includes('трансплантац')) {
            if (value === 'не проводилась' || value === 'нет' || value === false) {
                normalized.hasTransplant = false;
            } else if (value === 'проводилась' || value === 'да' || value === true) {
                normalized.hasTransplant = true;
            }
        }
    }
    
    return normalized;
}

function findGenotypeInPatientDataAdvanced(patientData) {
    // Список всех возможных полей для генотипа
    const genotypeFields = [
        'Анализ крови на гепатит С с определением генотипа_Результат',
        'Генотип',
        'Генотип вируса',
        'Генотип HCV',
        'Генотип гепатита С',
        'Результат'
    ];
    
    for (const field of genotypeFields) {
        const value = patientData[field];
        if (value) {
            let val = Array.isArray(value) ? value[0] : value;
            if (typeof val === 'string') {
                const lower = val.toLowerCase().trim();
                if (lower === '1a') return '1a';
                if (lower === '1b') return '1b';
                if (lower === '2') return '2';
                if (lower === '3') return '3';
                if (lower.includes('1a')) return '1a';
                if (lower.includes('1b')) return '1b';
            }
        }
    }
    
    return null;
}

function detectCirrhosis(patientData) {
    // Проверяем все возможные поля
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('цирроз') || keyLower.includes('цп')) {
            if (value === 'отсутствует' || value === 'нет' || value === false || value === '') {
                return false;
            }
            if (value === 'есть' || value === 'да' || value === true) {
                return true;
            }
        }
        
        // Проверяем значение как строку
        if (typeof value === 'string' && (value.toLowerCase().includes('цирроз') || value.toLowerCase().includes('цп'))) {
            if (value.toLowerCase().includes('отсутствует') || value.toLowerCase().includes('нет')) {
                return false;
            }
            return true;
        }
    }
    
    // По умолчанию считаем, что цирроза нет (если не указано иное)
    return false;
}

function detectTransplant(patientData) {
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('трансплантац')) {
            if (value === 'не проводилась' || value === 'нет' || value === false || value === '') {
                return false;
            }
            if (value === 'проводилась' || value === 'да' || value === true) {
                return true;
            }
        }
        
        // Проверяем операции в прошлом
        if (keyLower.includes('операции') || keyLower.includes('хирургическое')) {
            if (typeof value === 'string' && value.toLowerCase().includes('трансплантац')) {
                return true;
            }
            if (Array.isArray(value) && value.some(v => String(v).toLowerCase().includes('трансплантац'))) {
                return true;
            }
        }
    }
    
    return false;
}

function detectPVTExperience(patientData) {
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('пвт') || keyLower.includes('противовирусн') || 
            (keyLower.includes('опыт') && keyLower.includes('терапии'))) {
            
            if (value === 'отсутствует' || value === 'нет' || value === false) {
                return false;
            }
            if (value === 'имеется' || value === 'да' || value === true) {
                return true;
            }
            
            if (Array.isArray(value)) {
                const hasPositive = value.some(v => {
                    const str = String(v).toLowerCase();
                    return str.includes('был') || str.includes('проводилась') || str.includes('имеется');
                });
                if (hasPositive) return true;
            }
        }
    }
    
    return false;
}

function checkGenotypeSpecificMatch(variantName, patientGenotype) {
    const variantLower = variantName.toLowerCase();
    
    // Если в варианте не упоминается генотип - пропускаем (не мешает)
    if (!variantLower.includes('генотип') && !variantLower.includes('genotype') &&
        !variantLower.includes('1a') && !variantLower.includes('1b') && 
        !variantLower.includes('2') && !variantLower.includes('3')) {
        return null; // нейтрально
    }
    
    // Если у пациента нет генотипа, но вариант требует его указания
    if (!patientGenotype) {
        return false; // не подходит
    }
    
    // Проверяем совпадение
    if (variantLower.includes(patientGenotype.toLowerCase())) {
        return true; // точное совпадение
    }
    
    // Специальные случаи
    if (patientGenotype === '1b' && variantLower.includes('1b')) return true;
    if (patientGenotype === '1a' && variantLower.includes('1a')) return true;
    if (patientGenotype === '1' && (variantLower.includes('1a') || variantLower.includes('1b'))) return true;
    
    return false;
}

function checkCirrhosisSpecificMatch(variantName, hasCirrhosis) {
    const variantLower = variantName.toLowerCase();
    
    // Если в варианте не упоминается цирроз
    if (!variantLower.includes('цирроз') && !variantLower.includes('цп') && !variantLower.includes('без цп')) {
        return null;
    }
    
    // Проверяем наличие цирроза
    const requiresCirrhosis = variantLower.includes('с цп') || variantLower.includes('с цирроз');
    const requiresNoCirrhosis = variantLower.includes('без цп') || variantLower.includes('без цирроза');
    
    if (requiresCirrhosis && hasCirrhosis) return true;
    if (requiresNoCirrhosis && !hasCirrhosis) return true;
    
    return false;
}

function checkTransplantSpecificMatch(variantName, hasTransplant) {
    const variantLower = variantName.toLowerCase();
    
    if (!variantLower.includes('трансплантац')) return null;
    
    const requiresTransplant = variantLower.includes('после трансплантации') || variantLower.includes('с трансплантацией');
    const requiresNoTransplant = variantLower.includes('без трансплантации') || variantLower.includes('не проводилась');
    
    if (requiresTransplant && hasTransplant) return true;
    if (requiresNoTransplant && !hasTransplant) return true;
    
    return false;
}

function checkPVTSpecificMatch(variantName, hasPVTExperience) {
    const variantLower = variantName.toLowerCase();
    
    if (!variantLower.includes('пвт') && !variantLower.includes('противовирусн') && !variantLower.includes('опыт')) {
        return null;
    }
    
    const requiresExperience = variantLower.includes('с опытом') || variantLower.includes('не ответивш');
    const requiresNoExperience = variantLower.includes('без опыта') || variantLower.includes('наивн');
    
    if (requiresExperience && hasPVTExperience) return true;
    if (requiresNoExperience && !hasPVTExperience) return true;
    
    return null;
}
// ДОБАВЬТЕ ЭТИ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:

function getConfidenceLevel(score) {
    // Убедимся, что скор нормализован
    const normalizedScore = normalizeScore(score);
    
    if (normalizedScore >= 90) return "✅ Отлично подходит";
    if (normalizedScore >= 75) return "✅ Хорошо подходит";
    if (normalizedScore >= 60) return "⚠️ Частично подходит (требует уточнения)";
    if (normalizedScore >= 40) return "⚠️ Ограниченно подходит";
    return "❌ Не подходит";
}

function countCriteria(variantName) {
    if (!variantName) return 0;
    
    let criteriaCount = 0;
    
    // Разбиваем название на значимые слова
    const words = variantName.split(/[\s,()\-–—]+/).filter(word => {
        if (!word || word.length < 2) return false;
        
        // Исключаем служебные слова
        const stopWords = ['с', 'и', 'без', 'при', 'на', 'по', 'для', 'у', 'в', 'из', 'от', 'до', 'имеется'];
        return !stopWords.includes(word.toLowerCase());
    });
    
    criteriaCount = words.length;
    
    // Бонусы за специфичные медицинские термины
    const medicalTerms = {
        'генотип': 5,
        'цирроз': 4,
        'трансплантац': 4,
        'пвт': 3,
        'степень': 3,
        'стадия': 3,
        'тяжел': 3,
        'легк': 2,
        'средн': 2,
        'хроническ': 2,
        'острый': 2,
        'мигрень': 2,
        'ибс': 2,
        'гепатит': 2
    };
    
    const lowerName = variantName.toLowerCase();
    for (const [term, bonus] of Object.entries(medicalTerms)) {
        if (lowerName.includes(term)) {
            criteriaCount += bonus;
        }
    }
    
    // Бонус за числовые спецификации (генотипы 1a, 1b и т.д.)
    if (/\b\d+[a-z]?\b/i.test(variantName)) {
        criteriaCount += 5;
    }
    
    return criteriaCount;
}

// НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:

// УДАЛЯЕТ ДУБЛИКАТЫ И СТРУКТУРИРУЕТ ВЫВОД
function extractAllTreatments(treatmentPlan) {
    const allTreatments = [];
    
    if (!treatmentPlan) return allTreatments;
    
    // 1. Ищем варианты лечения
    if (treatmentPlan["вариант лечения"]) {
        const treatmentOptions = treatmentPlan["вариант лечения"];
        
        for (const [optionKey, option] of Object.entries(treatmentOptions)) {
            if (!option) continue;
            
            // Извлекаем лечение из этого варианта
            const treatments = extractTreatmentsFromOption(option);
            allTreatments.push(...treatments);
        }
    }
    
    return allTreatments;
}

// ИЗВЛЕКАЕТ ЛЕЧЕНИЕ ИЗ ОДНОГО ВАРИАНТА
function extractTreatmentsFromOption(option) {
    const treatments = [];
    
    if (!option) return treatments;
    
    // Проверяем медикаментозное лечение
    if (option["медикаментозное"]) {
        const med = option["медикаментозное"];
        
        // Комбинация препаратов (для гепатита)
        if (med["комбинация"] && med["комбинация"]["Действующее вещество"]) {
            const drugs = Object.keys(med["комбинация"]["Действующее вещество"]);
            if (drugs.length > 0) {
                treatments.push(`**Комбинация препаратов:** ${drugs.join(" + ")}`);
            }
        }
        
        // Отдельные действующие вещества
        if (med["Действующее вещество"]) {
            const substances = Object.keys(med["Действующее вещество"]);
            if (substances.length > 0) {
                // Добавляем режим приема, если есть
                const details = [];
                for (const drug of substances) {
                    const drugData = med["Действующее вещество"][drug];
                    if (drugData && drugData["режим"]) {
                        details.push(`${drug} (${drugData["режим"]})`);
                    } else {
                        details.push(drug);
                    }
                }
                treatments.push(`**Препараты:** ${details.join(", ")}`);
            }
        }
        
        // Фарм-группы
        if (med["Фарм-группа"]) {
            const groups = Object.keys(med["Фарм-группа"]);
            if (groups.length > 0) {
                treatments.push(`**Фармакологические группы:** ${groups.join(", ")}`);
            }
        }
    }
    
    // Хирургическое лечение
    if (option["хирургическое"]) {
        const surgical = option["хирургическое"];
        const procedures = Object.keys(surgical);
        if (procedures.length > 0) {
            procedures.forEach(procedure => {
                const procData = surgical[procedure];
                if (procData && procData["уточнение"] && Array.isArray(procData["уточнение"])) {
                    treatments.push(`**Хирургическое вмешательство:** ${procedure} (${procData["уточнение"].join("; ")})`);
                } else {
                    treatments.push(`**Хирургическое вмешательство:** ${procedure}`);
                }
            });
        }
    }
    
    // Другие методы
    if (option["иное"]) {
        const other = option["иное"];
        const methods = Object.keys(other);
        if (methods.length > 0) {
            treatments.push(`**Другие методы:** ${methods.join(", ")}`);
        }
    }
    
    return treatments;
}


// ИЗВЛЕКАЕТ ДОПОЛНИТЕЛЬНУЮ ИНФОРМАЦИЮ
function extractAdditionalInfo(treatmentPlan) {
    const info = [];
    
    if (!treatmentPlan) return info;
    
    // Описание лечения
    if (treatmentPlan["описание лечения в зависимости от обстоятельств"]) {
        const desc = treatmentPlan["описание лечения в зависимости от обстоятельств"];
        if (desc["описание"] && Array.isArray(desc["описание"])) {
            info.push(...desc["описание"]);
        }
    }
    
    // Место проведения
    if (treatmentPlan["место проведения"]) {
        info.push(`Место проведения: ${treatmentPlan["место проведения"]}`);
    }
    
    // Временные аспекты
    if (treatmentPlan["Временной аспект"]) {
        const time = treatmentPlan["Временной аспект"];
        if (typeof time === 'object') {
            for (const [key, value] of Object.entries(time)) {
                if (typeof value === 'string') {
                    info.push(`${key}: ${value}`);
                }
            }
        }
    }
    
    return info;
}

// ИЗВЛЕКАЕТ КОНКРЕТНЫЕ РЕКОМЕНДАЦИИ ИЗ ИНСТРУКЦИИ
function extractSpecificRecommendations(instruction) {
    const recommendations = [];
    
    if (!instruction) return recommendations;
    
    // Уточнения
    if (instruction["уточнение"] && Array.isArray(instruction["уточнение"])) {
        instruction["уточнение"].forEach(item => {
            if (item.toLowerCase().includes('рекоменду') || 
                item.toLowerCase().includes('следует') ||
                item.toLowerCase().includes('необходимо') ||
                item.toLowerCase().includes('применять') ||
                item.toLowerCase().includes('целевой') ||
                item.toLowerCase().includes('поддерживать') ||
                item.toLowerCase().includes('контролировать')) {
                recommendations.push(item);
            }
        });
    }
    
    // Из описания лечения
    if (instruction["План лечебных действий"] && 
        instruction["План лечебных действий"]["описание лечения в зависимости от обстоятельств"]) {
        const desc = instruction["План лечебных действий"]["описание лечения в зависимости от обстоятельств"];
        if (desc["описание"] && Array.isArray(desc["описание"])) {
            desc["описание"].forEach(item => {
                if (item.toLowerCase().includes('рекоменду') || 
                    item.toLowerCase().includes('рекомендовано') ||
                    item.toLowerCase().includes('целесообразно') ||
                    item.toLowerCase().includes('показано')) {
                    recommendations.push(item);
                }
            });
        }
    }
    
    return recommendations;
}

// УДАЛЯЕТ ДУБЛИКАТЫ ИЗ МАССИВА
function removeDuplicates(array) {
    const seen = new Set();
    const result = [];
    
    for (const item of array) {
        // Создаем "ключ" для сравнения (убираем маркдаун и лишние пробелы)
        const key = item.replace(/\*\*/g, '').replace(/\*/g, '').trim().toLowerCase();
        
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    
    return result;
}

// НОВАЯ УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОИСКА ЛЕЧЕНИЙ
function extractUniversalTreatments(treatmentPlan) {
    const treatments = [];
    
    if (!treatmentPlan || typeof treatmentPlan !== 'object') {
        console.log("❌ Нет плана лечения или неверный формат");
        return treatments;
    }
    
    console.log("🔍 УНИВЕРСАЛЬНЫЙ поиск лечения в:", Object.keys(treatmentPlan));
    
    // 1. Прямой поиск в верхнем уровне
    function searchDirectly(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        
        // Проверяем Действующее вещество
        if (obj["Действующее вещество"]) {
            const substances = obj["Действующее вещество"];
            const substanceNames = Object.keys(substances);
            
            if (substanceNames.length > 0) {
                const details = [];
                for (const drug of substanceNames) {
                    const drugData = substances[drug];
                    if (drugData && drugData["режим"]) {
                        details.push(`${drug} (${drugData["режим"]})`);
                    } else {
                        details.push(drug);
                    }
                }
                treatments.push(`**Препараты:** ${details.join(", ")}`);
            }
        }
        
        // Проверяем Фарм-группа
        if (obj["Фарм-группа"]) {
            const groups = obj["Фарм-группа"];
            const groupNames = Object.keys(groups);
            
            if (groupNames.length > 0) {
                treatments.push(`**Фарм-группы:** ${groupNames.join(", ")}`);
                
                // Ищем действующие вещества внутри фарм-групп
                for (const groupName of groupNames) {
                    const groupData = groups[groupName];
                    if (groupData && groupData["Действующее вещество"]) {
                        const substances = Object.keys(groupData["Действующее вещество"]);
                        if (substances.length > 0) {
                            treatments.push(`**Действующее вещество (${groupName}):** ${substances.join(", ")}`);
                        }
                    }
                }
            }
        }
        
        // Проверяем медикаментозное
        if (obj["медикаментозное"]) {
            searchDirectly(obj["медикаментозное"], path + "медикаментозное.");
        }
        
        // Проверяем вариант лечения
        if (obj["вариант лечения"]) {
            const treatmentOptions = obj["вариант лечения"];
            for (const [optionKey, option] of Object.entries(treatmentOptions)) {
                if (option && typeof option === 'object') {
                    searchDirectly(option, path + `вариант лечения.${optionKey}.`);
                }
            }
        }
        
        // Рекурсивный поиск во вложенных объектах
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null && 
                !["Действующее вещество", "Фарм-группа", "медикаментозное", "вариант лечения"].includes(key)) {
                if (path.split('.').length < 5) { // Ограничиваем глубину
                    searchDirectly(value, path + key + '.');
                }
            }
        }
    }
    
    // Запускаем поиск
    searchDirectly(treatmentPlan);
    
    // 2. Если ничего не нашли, ищем через медикаментозное
    if (treatments.length === 0 && treatmentPlan["медикаментозное"]) {
        console.log("🔍 Ищем в медикаментозное напрямую");
        const med = treatmentPlan["медикаментозное"];
        searchDirectly(med, "медикаментозное.");
    }
    
    // 3. Если все еще ничего, ищем в любом объекте
    if (treatments.length === 0) {
        console.log("🔍 Глубокий поиск во всей структуре");
        function deepSearch(obj) {
            if (!obj || typeof obj !== 'object') return;
            
            for (const [key, value] of Object.entries(obj)) {
                // Ищем любые лекарственные названия
                if (typeof value === 'object' && value !== null) {
                    if (Object.keys(value).some(k => 
                        k.toLowerCase().includes('препарат') || 
                        k.toLowerCase().includes('лекарство') ||
                        k.toLowerCase().includes('вещество') ||
                        k.toLowerCase().includes('медикамент'))) {
                        console.log("🔍 Найдено что-то похожее на лекарства в:", key);
                        searchDirectly(value, key + '.');
                    }
                    deepSearch(value);
                }
            }
        }
        deepSearch(treatmentPlan);
    }
    
    // Убираем дубликаты
    const uniqueTreatments = [];
    const seen = new Set();
    
    for (const treatment of treatments) {
        // Нормализуем строку для сравнения
        const cleanTreatment = treatment
            .replace(/\*\*/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        
        if (!seen.has(cleanTreatment) && cleanTreatment.length > 5) {
            seen.add(cleanTreatment);
            uniqueTreatments.push(treatment);
        }
    }
    
    console.log("📋 Извлеченные лечения:", uniqueTreatments);
    return uniqueTreatments;
}

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПОИСКА ЛЕЧЕНИЙ В ОБЪЕКТЕ
function searchForTreatmentsInObject(obj, depth = 0) {
    const results = [];
    
    if (!obj || typeof obj !== 'object' || depth > 5) {
        return results;
    }
    
    // БАЗОВЫЕ СЛУЧАИ: находим конкретные рекомендации
    
    // 1. Комбинация препаратов (гепатит C)
    if (obj["комбинация"] && obj["комбинация"]["Действующее вещество"]) {
        const drugs = Object.keys(obj["комбинация"]["Действующее вещество"]);
        if (drugs.length > 0) {
            results.push(`**Комбинация препаратов:** ${drugs.join(" + ")}`);
        }
    }
    
    // 2. Отдельные действующие вещества
    if (obj["Действующее вещество"]) {
        const substances = Object.keys(obj["Действующее вещество"]);
        if (substances.length > 0) {
            const details = [];
            // Проверяем есть ли режим приема
            substances.forEach(substance => {
                const substanceData = obj["Действующее вещество"][substance];
                if (substanceData && substanceData["режим"]) {
                    details.push(`${substance} (${substanceData["режим"]})`);
                } else {
                    details.push(substance);
                }
            });
            results.push(`**Препараты:** ${details.join(", ")}`);
        }
    }
    
    // 3. Фарм-группы
    if (obj["Фарм-группа"]) {
        const groups = Object.keys(obj["Фарм-группа"]);
        if (groups.length > 0) {
            results.push(`**Фарм-группы:** ${groups.join(", ")}`);
        }
    }
    
    // 4. Хирургические вмешательства
    if (obj["хирургическое"]) {
        const procedures = Object.keys(obj["хирургическое"]);
        if (procedures.length > 0) {
            procedures.forEach(procedure => {
                const procData = obj["хирургическое"][procedure];
                if (procData && procData["уточнение"] && Array.isArray(procData["уточнение"])) {
                    results.push(`**Хирургическое:** ${procedure}: ${procData["уточнение"].join(", ")}`);
                } else {
                    results.push(`**Хирургическое:** ${procedure}`);
                }
            });
        }
    }
    
    // 5. Другие методы лечения
    if (obj["иное"]) {
        const otherMethods = Object.keys(obj["иное"]);
        if (otherMethods.length > 0) {
            results.push(`**Другие методы:** ${otherMethods.join(", ")}`);
        }
    }
    
    // 6. Конкретные названия методов
    const specificMethodNames = [
        'медикаментозное', 'хирургическое', 'иное', 'препарат 1-й линии',
        'органические нитраты короткого действия', 'анальгетики', 'антиэметики'
    ];
    
    specificMethodNames.forEach(methodName => {
        if (obj[methodName]) {
            const nestedResults = searchForTreatmentsInObject(obj[methodName], depth + 1);
            if (nestedResults.length > 0) {
                results.push(...nestedResults);
            }
        }
    });
    
    // РЕКУРСИВНЫЙ ПОИСК ВО ВЛОЖЕННЫХ ОБЪЕКТАХ
    for (const key in obj) {
        if (key !== 'вариант лечения' && // Уже обработали выше
            typeof obj[key] === 'object' && 
            obj[key] !== null) {
            const nestedResults = searchForTreatmentsInObject(obj[key], depth + 1);
            if (nestedResults.length > 0) {
                results.push(...nestedResults);
            }
        }
    }
    
    return results;
}

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОИСКА ЦЕЛЕЙ
function extractUniversalGoals(treatmentPlan) {
    const goals = [];
    
    if (!treatmentPlan || !treatmentPlan["Цель"]) {
        return goals;
    }
    
    const goalData = treatmentPlan["Цель"];
    
    // Перебираем все цели (может быть "1", "2", и т.д.)
    for (const [goalKey, goalValue] of Object.entries(goalData)) {
        if (!goalValue || typeof goalValue !== 'object') continue;
        
        // Ищем во всех полях цели
        for (const [action, actionData] of Object.entries(goalValue)) {
            if (typeof actionData === 'object') {
                // Например: "создать условия": {"для": ["..."]}
                for (const [subAction, subData] of Object.entries(actionData)) {
                    if (Array.isArray(subData)) {
                        subData.forEach(item => {
                            goals.push(`${action} ${subAction} ${item}`);
                        });
                    } else if (typeof subData === 'string') {
                        goals.push(`${action} ${subAction} ${subData}`);
                    }
                }
            } else if (typeof actionData === 'string') {
                goals.push(`${action} ${actionData}`);
            }
        }
    }
    
    return goals;
}

// Вспомогательная функция для подсчета критериев (остается без изменений)
function countCriteria(variantName) {
    if (!variantName) return 0;
    
    let criteriaCount = 0;
    
    // Разбиваем название на значимые слова
    const words = variantName.split(/[\s,()\-–—]+/).filter(word => {
        if (!word || word.length < 2) return false;
        
        // Исключаем служебные слова
        const stopWords = ['с', 'и', 'без', 'при', 'на', 'по', 'для', 'у', 'в', 'из', 'от', 'до'];
        return !stopWords.includes(word.toLowerCase());
    });
    
    criteriaCount = words.length;
    
    // Бонусы за специфичные медицинские термины
    const medicalTerms = {
        'генотип': 5,
        'цирроз': 4,
        'трансплантац': 4,
        'пвт': 3,
        'степень': 3,
        'стадия': 3,
        'тяжел': 3,
        'легк': 2,
        'средн': 2,
        'хроническ': 2,
        'острый': 2
    };
    
    const lowerName = variantName.toLowerCase();
    for (const [term, bonus] of Object.entries(medicalTerms)) {
        if (lowerName.includes(term)) {
            criteriaCount += bonus;
        }
    }
    
    // Бонус за числовые спецификации (генотипы 1a, 1b и т.д.)
    if (/\b\d+[a-z]?\b/i.test(variantName)) {
        criteriaCount += 5;
    }
    
    return criteriaCount;
}

// ДОБАВЬТЕ эти вспомогательные функции:

// ИЗВЛЕКАЕТ ЦЕЛИ ЛЕЧЕНИЯ (ГАРАНТИРОВАННО РАБОТАЕТ)
// ИЗВЛЕКАЕТ ЦЕЛИ ЛЕЧЕНИЯ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
function extractGoals(treatmentPlan) {
    const goals = [];
    const seen = new Set();
    
    if (!treatmentPlan) {
        return goals;
    }
    
    let goalData = treatmentPlan["Цель"];
    
    if (!goalData && treatmentPlan["вариант лечения"]) {
        for (const optionKey in treatmentPlan["вариант лечения"]) {
            const option = treatmentPlan["вариант лечения"][optionKey];
            if (option && option["Цель"]) {
                goalData = option["Цель"];
                break;
            }
        }
    }
    
    if (!goalData) {
        return goals;
    }
    
    function extractText(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
            if (key === "единица измерения" || key === "нижняя граница" || key === "верхняя граница") {
                continue;
            }
            
            if (key === "упражнение" && Array.isArray(value)) {
                value.forEach(ex => {
                    if (typeof ex === 'string' && ex.trim() && ex.trim().length > 5) {
                        const clean = ex.trim();
                        const normalized = clean.toLowerCase().replace(/\s+/g, ' ');
                        if (!seen.has(normalized)) {
                            seen.add(normalized);
                            goals.push(clean);
                        }
                    }
                });
            }
            else if (key === "обучение ходьбе" && typeof value === 'object') {
                if (value["упражнение"] && Array.isArray(value["упражнение"])) {
                    value["упражнение"].forEach(ex => {
                        if (typeof ex === 'string' && ex.trim() && ex.trim().length > 5) {
                            const clean = ex.trim();
                            const normalized = clean.toLowerCase().replace(/\s+/g, ' ');
                            if (!seen.has(normalized)) {
                                seen.add(normalized);
                                goals.push(clean);
                            }
                        }
                    });
                }
            }
            else if (typeof value === 'string' && value.trim() && value.trim().length > 5) {
                const clean = value.trim();
                const normalized = clean.toLowerCase().replace(/\s+/g, ' ');
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    goals.push(clean);
                }
            }
            else if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'string' && item.trim() && item.trim().length > 5) {
                        const clean = item.trim();
                        const normalized = clean.toLowerCase().replace(/\s+/g, ' ');
                        if (!seen.has(normalized)) {
                            seen.add(normalized);
                            goals.push(clean);
                        }
                    }
                });
            }
            else if (typeof value === 'object' && value !== null) {
                extractText(value);
            }
        }
    }
    
    extractText(goalData);
    
    const cleanedGoals = goals.map(goal => {
        return goal
            .replace(/вариант лечения \d+ /g, '')
            .replace(/метод реабилитации /g, '')
            .replace(/домашняя реабилитация по программе периода иммобилизации \(врач ФРМ\/ЛФК составляет программу реабилитации\) /g, '')
            .replace(/методика /g, '')
            .replace(/пошаговый алгоритм назначения /g, '')
            .replace(/этап \d+ /g, '')
            .replace(/упражнение: /g, '')
            .trim();
    }).filter(goal => goal.length > 5);
    
    const finalGoals = [];
    const finalSeen = new Set();
    
    for (const goal of cleanedGoals) {
        const normalized = goal.toLowerCase().replace(/\s+/g, ' ');
        if (!finalSeen.has(normalized)) {
            finalSeen.add(normalized);
            const formatted = goal.charAt(0).toUpperCase() + goal.slice(1);
            finalGoals.push(formatted);
        }
    }
    
    return finalGoals;
}

function extractSpecificRecommendations(instruction) {
    const recommendations = [];
    
    if (!instruction || typeof instruction !== 'object') return recommendations;
    
    // Рекурсивный поиск рекомендаций
    function searchRecommendations(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Ищем ключевые слова
                const lowerValue = value.toLowerCase();
                if (lowerValue.includes('рекоменду') || 
                    lowerValue.includes('следует') ||
                    lowerValue.includes('необходимо') ||
                    lowerValue.includes('целесообразно') ||
                    lowerValue.includes('показано') ||
                    lowerValue.includes('рекомендация')) {
                    recommendations.push(value);
                }
            } else if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'string') {
                        const lowerItem = item.toLowerCase();
                        if (lowerItem.includes('рекоменду') || 
                            lowerItem.includes('следует') ||
                            lowerItem.includes('необходимо')) {
                            recommendations.push(item);
                        }
                    }
                });
            } else if (typeof value === 'object') {
                searchRecommendations(value);
            }
        }
    }
    
    searchRecommendations(instruction);
    return recommendations;
}

function extractTreatments(treatmentOptions) {
    const treatments = [];
    
    if (!treatmentOptions || typeof treatmentOptions !== 'object') {
        return treatments;
    }
    
    for (const [key, option] of Object.entries(treatmentOptions)) {
        if (option["медикаментозное"]) {
            const med = option["медикаментозное"];
            
            // Комбинация препаратов
            if (med["комбинация"]) {
                const combo = med["комбинация"];
                if (combo["Действующее вещество"]) {
                    const drugs = Object.keys(combo["Действующее вещество"]);
                    if (drugs.length > 0) {
                        treatments.push(`**Комбинация препаратов:** ${drugs.join(" + ")}`);
                    }
                }
            }
            
            // Отдельные препараты
            if (med["Действующее вещество"]) {
                const substances = med["Действующее вещество"];
                for (const [drugName, drugData] of Object.entries(substances)) {
                    if (drugData && typeof drugData === 'object') {
                        if (drugData["режим"]) {
                            treatments.push(`**${drugName}:** ${drugData["режим"]}`);
                        } else {
                            treatments.push(`**${drugName}**`);
                        }
                    } else {
                        treatments.push(`**${drugName}**`);
                    }
                }
            }
            
            // Фарм-группы
            if (med["Фарм-группа"]) {
                const groups = Object.keys(med["Фарм-группа"]);
                if (groups.length > 0) {
                    treatments.push(`**Фарм-группы:** ${groups.join(", ")}`);
                }
            }
        }
        
        if (option["хирургическое"]) {
            const surgical = option["хирургическое"];
            const procedures = Object.keys(surgical);
            if (procedures.length > 0) {
                treatments.push(`**Хирургические вмешательства:** ${procedures.join(", ")}`);
            }
        }
        
        if (option["иное"]) {
            const other = option["иное"];
            if (other["метод реабилитации"]) {
                const methods = Object.keys(other["метод реабилитации"]);
                treatments.push(`**Методы реабилитации:** ${methods.join(", ")}`);
            }
        }
    }
    
    return treatments;
}
// ДОБАВЬТЕ эту функцию для подсчета критериев:
function countCriteria(variantName) {
    let criteriaCount = 0;
    
    // Подсчитываем слова в названии варианта (чем больше слов, тем более специфичный)
    const words = variantName.split(/[\s,()]+/).filter(word => 
        word.length > 2 && 
        !['с', 'и', 'без', 'при', 'на', 'по', 'для'].includes(word.toLowerCase())
    );
    
    criteriaCount = words.length;
    
    // Бонусные критерии за специфичность
    if (variantName.toLowerCase().includes('генотип')) criteriaCount += 3;
    if (variantName.includes('1a') || variantName.includes('1b') || variantName.includes('2')) criteriaCount += 5;
    if (variantName.toLowerCase().includes('цирроз') || variantName.includes('ЦП')) criteriaCount += 2;
    if (variantName.toLowerCase().includes('трансплантац')) criteriaCount += 2;
    if (variantName.toLowerCase().includes('пвт')) criteriaCount += 2;
    
    return criteriaCount;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ПРОВЕРКИ КАТЕГОРИИ ПАЦИЕНТА
// ============================================
function checkPatientCategory(patientCategory, patientData) {
    console.log("🔍 Проверка категории пациента:", JSON.stringify(patientCategory, null, 2));
    console.log("📋 Данные пациента:", patientData);
    
    const result = {
        matches: true,
        details: [],
        missing: []
    };

    if (!patientCategory) {
        console.log("✅ Категория не указана - считаем подходящей");
        return result;
    }

    // 1. ПРОВЕРКА НАБЛЮДЕНИЙ
    if (patientCategory["Наблюдение"]) {
        const observations = patientCategory["Наблюдение"];
        console.log("🔍 Наблюдения в категории:", observations);
        
        if (Array.isArray(observations)) {
            observations.forEach(obs => {
                for (const [obsName, obsValue] of Object.entries(obs)) {
                    console.log(`🔍 Проверяем наблюдение: "${obsName}" =`, obsValue);
                    let normalizedObsName = obsName;
                    
                    if (obsValue["Характеристика"]) {
                        checkCharacteristics(normalizedObsName, obsValue["Характеристика"], patientData, result);
                    } 
                    else if (obsValue["Качественное значение"]) {
                        checkQualitativeValue(normalizedObsName, obsValue["Качественное значение"], patientData, result);
                    }
                    else if (obsValue["Числовое значение"]) {
                        checkNumericValue(normalizedObsName, obsValue["Числовое значение"], patientData, result);
                    }
                    else {
                        deepSearchInObject(obsValue, normalizedObsName, patientData, result);
                    }
                }
            });
        } else if (typeof observations === 'object') {
            for (const [obsName, obsValue] of Object.entries(observations)) {
                console.log(`🔍 Проверяем наблюдение (объект): "${obsName}" =`, obsValue);
                let normalizedObsName = obsName;
                
                if (obsValue["Характеристика"]) {
                    checkCharacteristics(normalizedObsName, obsValue["Характеристика"], patientData, result);
                } else if (obsValue["Качественное значение"]) {
                    checkQualitativeValue(normalizedObsName, obsValue["Качественное значение"], patientData, result);
                } else if (obsValue["Числовое значение"]) {
                    checkNumericValue(normalizedObsName, obsValue["Числовое значение"], patientData, result);
                }
            }
        }
    }

    // 2. ПРОВЕРКА ФАКТОРОВ (с нормализацией для ЭПC/ЭПС)
    if (patientCategory["Фактор"]) {
        const factors = patientCategory["Фактор"];
        console.log("🔍 Факторы в категории:", factors);
        
        for (const [factorName, factorValue] of Object.entries(factors)) {
            console.log(`🔍 Проверяем фактор: "${factorName}" =`, factorValue);
            
            // НОРМАЛИЗУЕМ ИМЯ ФАКТОРА
            let normalizedFactorName = factorName;
            
            if (factorName === "Чувствительность к развитию ЭПС") {
                normalizedFactorName = "Чувствительность к развитию ЭПC";
            }
            if (factorName === "Чувствительность к развитию ЭПC") {
                normalizedFactorName = "Чувствительность к развитию ЭПC";
            }
            if (factorName === "Опыт терапии") {
                normalizedFactorName = "Опыт терапии";
            }
            if (factorName === "антипсихотиком (АТХ: N05A)") {
                normalizedFactorName = "антипсихотиком (АТХ: N05A)";
            }
            
            if (factorValue["Характеристика"]) {
                checkCharacteristics(normalizedFactorName, factorValue["Характеристика"], patientData, result);
            }
            else if (factorValue["Числовое значение"]) {
                checkNumericValue(normalizedFactorName, factorValue["Числовое значение"], patientData, result);
            }
            else if (factorValue["качественное значение"]) {
                checkQualitativeValue(normalizedFactorName, factorValue["качественное значение"], patientData, result);
            }
            else if (factorValue["Качественное значение"]) {
                checkQualitativeValue(normalizedFactorName, factorValue["Качественное значение"], patientData, result);
            }
            else {
                deepSearchInObject(factorValue, normalizedFactorName, patientData, result);
            }
        }
    }

    // 3. ПРОВЕРКА СТАДИИ
    if (patientCategory["Стадия"]) {
        const stage = patientCategory["Стадия"];
        console.log("🔍 Стадия в категории:", stage);
        
        for (const [stageName, stageValue] of Object.entries(stage)) {
            console.log(`🔍 Проверяем стадию: "${stageName}" =`, stageValue);
            
            if (stageValue["заболевания"] && Array.isArray(stageValue["заболевания"])) {
                const diseases = stageValue["заболевания"];
                const patientDiagnosis = patientData["Клинический диагноз"] || 
                                        patientData["Диагноз"] || 
                                        patientData["Основной диагноз"];
                
                if (patientDiagnosis) {
                    const hasMatch = diseases.some(disease => 
                        patientDiagnosis.toLowerCase().includes(disease.toLowerCase()) ||
                        disease.toLowerCase().includes(patientDiagnosis.toLowerCase())
                    );
                    
                    if (hasMatch) {
                        result.details.push(`✅ Стадия: соответствует ${stageName}`);
                    }
                }
            }
        }
    }

    // 4. ПРОВЕРКА ВРЕМЕННЫХ АСПЕКТОВ
    if (patientCategory["Временной аспект"]) {
        const timeAspect = patientCategory["Временной аспект"];
        console.log("🔍 Временной аспект:", timeAspect);
        result.details.push(`✅ Временной аспект учтен`);
    }

    console.log(`📊 Результат проверки: matches=${result.matches}, найдено совпадений: ${result.details.length}, несоответствий: ${result.missing.length}`);
    return result;
}

// ============================================
// ФУНКЦИЯ ПРОВЕРКИ ХАРАКТЕРИСТИК
// ============================================
function checkCharacteristics(parentName, characteristics, patientData, result) {
    if (!characteristics) return;
    
    console.log(`🔍 Проверка характеристик для ${parentName}:`, JSON.stringify(characteristics, null, 2));
    
    // НОРМАЛИЗУЕМ parentName
    let normalizedParentName = parentName;
    
    if (parentName === "Опыт терапии") {
        console.log(`🔍 Особый случай: Опыт терапии`);
        normalizedParentName = "Опыт терапии";
    }
    
    if (parentName === "антипсихотиком (АТХ: N05A)") {
        console.log(`🔍 Особый случай: антипсихотиком (АТХ: N05A)`);
        normalizedParentName = "антипсихотиком (АТХ: N05A)";
    }
    
    const charArray = Array.isArray(characteristics) ? characteristics : [characteristics];
    
    charArray.forEach(char => {
        for (const [charName, charValue] of Object.entries(char)) {
            console.log(`🔍 Характеристика: "${charName}" =`, JSON.stringify(charValue, null, 2));
            
            // Поиск значения
            let patientValue = null;
            
            if (normalizedParentName === "антипсихотиком (АТХ: N05A)" || 
                charName === "антипсихотиком (АТХ: N05A)") {
                
                const searchKeywords = ["антипсихотиком", "n05a", "опыт терапии", "антипсихотик"];
                for (const [key, value] of Object.entries(patientData)) {
                    if (!value || value === '' || (Array.isArray(value) && value.length === 0)) continue;
                    const keyLower = key.toLowerCase();
                    for (const keyword of searchKeywords) {
                        if (keyLower.includes(keyword)) {
                            patientValue = Array.isArray(value) ? value[0] : value;
                            console.log(`✅ Найдено значение для антипсихотика в поле "${key}":`, patientValue);
                            break;
                        }
                    }
                    if (patientValue) break;
                }
            } else {
                patientValue = findPatientValue(normalizedParentName, charName, patientData);
            }
            
            console.log(`📊 Значение пациента для ${normalizedParentName} ${charName}: "${patientValue}"`);
            
            if (!patientValue) {
                result.missing.push(`${normalizedParentName} ${charName}: не указано в данных пациента`);
                result.matches = false;
                continue;
            }
            
            if (charValue["Качественное значение"]) {
                const allowedValues = Object.keys(charValue["Качественное значение"]);
                console.log(`📋 Допустимые значения (Качественное значение):`, allowedValues);
                checkValueWithSynonyms(normalizedParentName, charName, patientValue, allowedValues, result);
            }
            else if (charValue["качественное значение"]) {
                let allowedValues = charValue["качественное значение"];
                if (!Array.isArray(allowedValues)) {
                    allowedValues = [String(allowedValues)];
                }
                console.log(`📋 Допустимые значения (качественное значение):`, allowedValues);
                checkValueWithSynonyms(normalizedParentName, charName, patientValue, allowedValues, result);
            }
            else if (charValue["Числовое значение"]) {
                checkNumericValue(normalizedParentName + " " + charName, charValue["Числовое значение"], patientData, result);
            }
            else {
                console.log(`⚠️ Неизвестный тип значения для ${charName}`);
            }
        }
    });
}

// НОВАЯ ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЛОКАЛИЗАЦИИ С СИНОНИМАМИ
function checkLocationWithSynonyms(parentName, patientValue, allowedValues, result) {
    if (!patientValue) {
        result.missing.push(`${parentName} Локализация: не указана`);
        result.matches = false;
        return;
    }
    
    const patientValueLower = String(patientValue).toLowerCase().trim();
    
    // Словарь синонимов для локализаций
    const locationSynonyms = {
        "медиальная лодыжка": ["медиальная лодыжка", "внутренняя лодыжка", "медиальная"],
        "внутренняя лодыжка": ["внутренняя лодыжка", "медиальная лодыжка", "внутренняя"],
        "латеральная лодыжка": ["латеральная лодыжка", "наружная лодыжка", "латеральная"],
        "наружная лодыжка": ["наружная лодыжка", "латеральная лодыжка", "наружная"]
    };
    
    // Проверяем точное совпадение
    let found = false;
    
    for (const allowed of allowedValues) {
        const allowedLower = String(allowed).toLowerCase().trim();
        
        // Прямое совпадение
        if (allowedLower === patientValueLower) {
            found = true;
            result.details.push(`✅ ${parentName} Локализация: ${patientValue} соответствует`);
            return;
        }
        
        // Проверка по синонимам
        for (const [key, synonyms] of Object.entries(locationSynonyms)) {
            if (allowedLower.includes(key) || key.includes(allowedLower)) {
                if (synonyms.some(syn => patientValueLower.includes(syn) || syn.includes(patientValueLower))) {
                    found = true;
                    result.details.push(`✅ ${parentName} Локализация: ${patientValue} соответствует (синоним для ${allowed})`);
                    return;
                }
            }
        }
        
        // Частичное совпадение
        if (allowedLower.includes(patientValueLower) || patientValueLower.includes(allowedLower)) {
            found = true;
            result.details.push(`⚠️ ${parentName} Локализация: ${patientValue} частично соответствует (требуется: ${allowed})`);
            return;
        }
    }
    
    if (!found) {
        result.matches = false;
        result.missing.push(`${parentName} Локализация: "${patientValue}" не соответствует (требуется: ${allowedValues.join(", ")})`);
    }
}

// ============================================
// ФУНКЦИЯ ПРОВЕРКИ КАЧЕСТВЕННОГО ЗНАЧЕНИЯ
// ============================================
function checkQualitativeValue(fieldName, qualValue, patientData, result) {
    let allowedValues = [];
    
    if (Array.isArray(qualValue)) {
        allowedValues = qualValue;
    } else if (typeof qualValue === 'object') {
        allowedValues = Object.keys(qualValue);
    } else {
        allowedValues = [String(qualValue)];
    }
    
    const patientValue = findPatientValueSimple(fieldName, patientData);
    console.log(`🔍 checkQualitativeValue: field="${fieldName}", patientValue="${patientValue}", allowed=${allowedValues}`);
    
    if (!patientValue) {
        result.missing.push(`${fieldName}: не указано в данных пациента`);
        result.matches = false;
        return;
    }
    
    // НОРМАЛИЗУЕМ значение пациента для сравнения
    let normalizedPatientValue = String(patientValue).toLowerCase().trim();
    
    // Для чувствительности к ЭПС: "имеется" = "высокая"
    if (fieldName.toLowerCase().includes("чувствительность") && 
        (normalizedPatientValue === "имеется" || normalizedPatientValue === "есть" || normalizedPatientValue === "да")) {
        normalizedPatientValue = "высокая";
        console.log(`🔄 Нормализовано: "${patientValue}" -> "высокая"`);
    }
    
    // Для эффективности: "недостаточная эффективность" оставляем как есть
    if (fieldName.toLowerCase().includes("эффективность") && 
        normalizedPatientValue === "недостаточная эффективность") {
        // уже правильно
    }
    
    // Проверяем точное совпадение
    const exactMatch = allowedValues.some(val => 
        String(val).toLowerCase().trim() === normalizedPatientValue
    );
    
    if (exactMatch) {
        result.details.push(`✅ ${fieldName}: ${patientValue} соответствует`);
        return;
    }
    
    // Проверяем частичное совпадение
    const partialMatch = allowedValues.some(val => {
        const valNorm = String(val).toLowerCase().trim();
        return valNorm.includes(normalizedPatientValue) || normalizedPatientValue.includes(valNorm);
    });
    
    if (partialMatch) {
        result.details.push(`⚠️ ${fieldName}: ${patientValue} частично соответствует (требуется: ${allowedValues.join(", ")})`);
        result.matches = true;
    } else {
        result.matches = false;
        result.missing.push(`${fieldName}: "${patientValue}" не соответствует (требуется: ${allowedValues.join(", ")})`);
    }
}


// ============================================
// ФУНКЦИЯ ПРОВЕРКИ ЧИСЛОВОГО ЗНАЧЕНИЯ
// ============================================
function checkNumericValue(fieldName, numData, patientData, result) {
    const patientValue = findPatientValueSimple(fieldName, patientData);
    
    if (!patientValue) {
        result.missing.push(`${fieldName}: не указано`);
        result.matches = false;
        return;
    }
    
    const patientNum = Number(patientValue);
    if (isNaN(patientNum)) {
        result.missing.push(`${fieldName}: значение "${patientValue}" не является числом`);
        result.matches = false;
        return;
    }
    
    const min = numData["нижняя граница"];
    const max = numData["верхняя граница"];
    
    if (min !== undefined && max !== undefined) {
        if (patientNum >= min && patientNum <= max) {
            result.details.push(`✅ ${fieldName}: ${patientNum} в диапазоне ${min}-${max}`);
        } else {
            result.matches = false;
            result.missing.push(`${fieldName}: ${patientNum} вне диапазона ${min}-${max}`);
        }
    } else if (min !== undefined) {
        if (patientNum >= min) {
            result.details.push(`✅ ${fieldName}: ${patientNum} >= ${min}`);
        } else {
            result.matches = false;
            result.missing.push(`${fieldName}: ${patientNum} < ${min}`);
        }
    } else if (max !== undefined) {
        if (patientNum <= max) {
            result.details.push(`✅ ${fieldName}: ${patientNum} <= ${max}`);
        } else {
            result.matches = false;
            result.missing.push(`${fieldName}: ${patientNum} > ${max}`);
        }
    } else {
        result.details.push(`✅ ${fieldName}: ${patientNum}`);
    }
}

// ПРОВЕРКА ЗНАЧЕНИЯ ПРОТИВ СПИСКА ДОПУСТИМЫХ
function checkValueAgainstAllowed(fieldName, patientValue, allowedValues, result) {
    if (!patientValue) {
        result.missing.push(`${fieldName}: не указано`);
        result.matches = false;
        return;
    }
    
    const patientValueLower = String(patientValue).toLowerCase().trim();
    
    // Проверяем точное совпадение
    const exactMatch = allowedValues.some(val => 
        String(val).toLowerCase().trim() === patientValueLower
    );
    
    if (exactMatch) {
        result.details.push(`✅ ${fieldName}: ${patientValue} соответствует`);
        return;
    }
    
    // Проверяем частичное совпадение
    const partialMatch = allowedValues.some(val => {
        const valLower = String(val).toLowerCase().trim();
        return valLower.includes(patientValueLower) || patientValueLower.includes(valLower);
    });
    
    if (partialMatch) {
        result.details.push(`⚠️ ${fieldName}: ${patientValue} частично соответствует`);
    } else {
        result.matches = false;
        result.missing.push(`${fieldName}: "${patientValue}" не соответствует (требуется: ${allowedValues.join(", ")})`);
    }
}

// ============================================
// УЛУЧШЕННАЯ ФУНКЦИЯ ПОИСКА ЗНАЧЕНИЯ
// ============================================
function findPatientValue(parentName, charName, patientData) {
    console.log(`🔍 Ищем значение для parent="${parentName}", char="${charName}"`);
    
    // 1. ПРЯМОЙ ПОИСК
    const directKey = `${parentName}_${charName}`;
    if (patientData[directKey] !== undefined && patientData[directKey] !== null && patientData[directKey] !== '') {
        console.log(`✅ Найдено прямое совпадение: ${directKey} =`, patientData[directKey]);
        return patientData[directKey];
    }
    
    // 2. ПОИСК ПО КЛЮЧЕВЫМ СЛОВАМ
    const searchTerms = [];
    const parentWords = parentName.toLowerCase().split(/[\s_]+/);
    const charWords = charName.toLowerCase().split(/[\s_]+/);
    searchTerms.push(...parentWords);
    searchTerms.push(...charWords);
    
    const meaningfulTerms = searchTerms.filter(t => t.length >= 3);
    
    for (const [key, value] of Object.entries(patientData)) {
        if (!value || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const keyLower = key.toLowerCase();
        for (const term of meaningfulTerms) {
            if (keyLower.includes(term)) {
                console.log(`✅ Найдено по термину "${term}": ${key} =`, value);
                return Array.isArray(value) ? value[0] : value;
            }
        }
    }
    
    // 3. СПЕЦИАЛЬНЫЕ МАППИНГИ
    const specialMappings = {
        "Чувствительность к развитию ЭПС": ["чувствительность", "эпс", "эпc", "чувствительность к развитию эпс"],
        "Чувствительность к развитию ЭПC": ["чувствительность", "эпс", "эпc", "чувствительность к развитию эпс"],
        "антипсихотиком (АТХ: N05A)": ["антипсихотиком", "n05a", "опыт терапии", "антипсихотик"],
        "Опыт терапии": ["опыт терапии", "антипсихотиком", "n05a"],
        "Психотическая симптоматика": ["психотическая", "симптоматика"],
        "АПП": ["апп", "антипсихотик"]
    };
    
    const combinedKey = `${parentName} ${charName}`.toLowerCase();
    
    for (const [field, keywords] of Object.entries(specialMappings)) {
        if (combinedKey.includes(field.toLowerCase()) || 
            field.toLowerCase().includes(combinedKey) ||
            parentName.toLowerCase().includes(field.toLowerCase()) ||
            charName.toLowerCase().includes(field.toLowerCase())) {
            
            for (const [key, value] of Object.entries(patientData)) {
                const keyLower = key.toLowerCase();
                for (const keyword of keywords) {
                    if (keyLower.includes(keyword)) {
                        console.log(`✅ Найдено по спецмаппингу "${field}": ${key} =`, value);
                        return Array.isArray(value) ? value[0] : value;
                    }
                }
            }
        }
    }
    
    // 4. ПОИСК ПО ЧАСТИЧНОМУ СОВПАДЕНИЮ
    for (const [key, value] of Object.entries(patientData)) {
        if (!value || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes(parentName.toLowerCase()) || 
            parentName.toLowerCase().includes(keyLower) ||
            keyLower.includes(charName.toLowerCase()) ||
            charName.toLowerCase().includes(keyLower)) {
            console.log(`✅ Найдено по частичному совпадению: ${key} =`, value);
            return Array.isArray(value) ? value[0] : value;
        }
    }
    
    console.log(`❌ Не найдено значение для ${parentName} ${charName}`);
    return null;
}

// УЛУЧШЕННАЯ ФУНКЦИЯ ПРОВЕРКИ ХАРАКТЕРИСТИК
function checkCharacteristics(parentName, characteristics, patientData, result) {
    if (!characteristics) return;
    
    console.log(`🔍 Проверка характеристик для ${parentName}:`, JSON.stringify(characteristics, null, 2));
    
    const charArray = Array.isArray(characteristics) ? characteristics : [characteristics];
    
    charArray.forEach(char => {
        for (const [charName, charValue] of Object.entries(char)) {
            console.log(`🔍 Характеристика: "${charName}" =`, JSON.stringify(charValue, null, 2));
            
            // Ищем значение в данных пациента
            const patientValue = findPatientValue(parentName, charName, patientData);
            console.log(`📊 Значение пациента для ${parentName} ${charName}: "${patientValue}"`);
            
            if (!patientValue) {
                result.missing.push(`${parentName} ${charName}: не указано в данных пациента`);
                result.matches = false;
                continue;
            }
            
            if (charValue["Качественное значение"]) {
                const allowedValues = Object.keys(charValue["Качественное значение"]);
                console.log(`📋 Допустимые значения (Качественное значение):`, allowedValues);
                checkValueWithSynonyms(parentName, charName, patientValue, allowedValues, result);
            }
            else if (charValue["качественное значение"]) {
                let allowedValues = charValue["качественное значение"];
                if (!Array.isArray(allowedValues)) {
                    allowedValues = [String(allowedValues)];
                }
                console.log(`📋 Допустимые значения (качественное значение):`, allowedValues);
                checkValueWithSynonyms(parentName, charName, patientValue, allowedValues, result);
            }
            else if (charValue["Числовое значение"]) {
                checkNumericValue(parentName + " " + charName, charValue["Числовое значение"], patientData, result);
            }
            else {
                console.log(`⚠️ Неизвестный тип значения для ${charName}`);
            }
        }
    });
}

// ============================================
// ФУНКЦИЯ ПРОВЕРКИ ЗНАЧЕНИЯ С СИНОНИМАМИ
// ============================================
function checkValueWithSynonyms(parentName, charName, patientValue, allowedValues, result) {
    const fieldName = `${parentName} ${charName}`;
    
    if (!patientValue) {
        result.missing.push(`${fieldName}: не указано`);
        result.matches = false;
        return;
    }
    
    // НОРМАЛИЗУЕМ значение пациента
    let normalizedPatientValue = String(patientValue).toLowerCase().trim();
    
    // Для чувствительности к ЭПС: "имеется" = "высокая"
    if ((parentName.toLowerCase().includes("чувствительность") || charName.toLowerCase().includes("чувствительность")) &&
        (normalizedPatientValue === "имеется" || normalizedPatientValue === "есть" || normalizedPatientValue === "да")) {
        normalizedPatientValue = "высокая";
        console.log(`🔄 Нормализовано в checkValueWithSynonyms: "${patientValue}" -> "высокая"`);
    }
    
    console.log(`🔍 Проверка ${fieldName}: значение="${normalizedPatientValue}", допустимые=${allowedValues}`);
    
    // РАСШИРЕННЫЙ СЛОВАРЬ СИНОНИМОВ
    const synonyms = {
        "чувствительность": {
            "высокая": ["высокая", "имеется", "есть", "да", "повышена", "высокая чувствительность", "чувствительность высокая"],
            "отсутствует": ["отсутствует", "нет", "низкая", "не имеется", "отсутствие", "нет чувствительности"]
        },
        "эффективность": {
            "недостаточная эффективность": ["недостаточная эффективность", "неэффективность", "не эффективно", "нет эффекта", "недостаточная", "эффект отсутствует"],
            "хорошая эффективность": ["хорошая эффективность", "эффективно", "есть эффект", "положительный эффект"]
        },
        "психотическая симптоматика": {
            "острая": ["острая", "острый", "остро", "острая симптоматика"],
            "сохраняющаяся": ["сохраняющаяся", "сохраняется", "персистирующая", "стойкая"],
            "резистентная к терапии": ["резистентная", "резистентна", "терапия не помогает", "устойчивая"]
        }
    };
    
    // Определяем тип поля
    let fieldType = "общее";
    const combinedName = `${parentName} ${charName}`.toLowerCase();
    
    if (combinedName.includes("чувствительность") || combinedName.includes("эпс") || combinedName.includes("эпc")) {
        fieldType = "чувствительность";
    }
    if (combinedName.includes("эффективность") || combinedName.includes("опыт терапии") || combinedName.includes("антипсихотиком")) {
        fieldType = "эффективность";
    }
    if (combinedName.includes("психотическая") || combinedName.includes("симптоматика")) {
        fieldType = "психотическая симптоматика";
    }
    
    // Проверяем точное совпадение
    for (const allowed of allowedValues) {
        const allowedLower = String(allowed).toLowerCase().trim();
        if (allowedLower === normalizedPatientValue) {
            result.details.push(`✅ ${fieldName}: ${patientValue} соответствует`);
            return;
        }
    }
    
    // Проверяем по синонимам
    if (fieldType !== "общее" && synonyms[fieldType]) {
        for (const [key, synList] of Object.entries(synonyms[fieldType])) {
            const allowedMatch = allowedValues.some(allowed => {
                const allowedLower = String(allowed).toLowerCase().trim();
                return allowedLower.includes(key) || key.includes(allowedLower);
            });
            
            if (allowedMatch) {
                if (synList.some(syn => normalizedPatientValue.includes(syn) || syn.includes(normalizedPatientValue))) {
                    result.details.push(`✅ ${fieldName}: ${patientValue} соответствует (синоним для ${key})`);
                    return;
                }
            }
        }
    }
    
    // Проверяем частичное совпадение
    for (const allowed of allowedValues) {
        const allowedLower = String(allowed).toLowerCase().trim();
        if (allowedLower.includes(normalizedPatientValue) || normalizedPatientValue.includes(allowedLower)) {
            result.details.push(`⚠️ ${fieldName}: ${patientValue} частично соответствует (требуется: ${allowed})`);
            return;
        }
    }
    
    result.matches = false;
    result.missing.push(`${fieldName}: "${patientValue}" не соответствует (требуется: ${allowedValues.join(", ")})`);
}


// ============================================
// УЛУЧШЕННАЯ ФУНКЦИЯ ПОИСКА ПРОСТОГО ЗНАЧЕНИЯ
// ============================================
function findPatientValueSimple(fieldName, patientData) {
      // ЗАЩИТА ОТ МАССИВОВ В САМОМ НАЧАЛЕ
    if (Array.isArray(patientData)) {
        patientData = patientData[0] || {};
    }
    if (!fieldName) return null;
    
    console.log(`🔍 findPatientValueSimple: ищем "${fieldName}"`);
    
    // 1. Прямой поиск
    if (patientData[fieldName] !== undefined && patientData[fieldName] !== null && patientData[fieldName] !== '') {
        const value = patientData[fieldName];
        console.log(`✅ Прямое совпадение: ${fieldName} =`, value);
        return Array.isArray(value) ? value[0] : value;
    }
    
    // 2. Поиск по частичному совпадению
    const fieldLower = fieldName.toLowerCase().replace(/[\s_]/g, '');
    const fieldWords = fieldLower.split(/[\s_]+/).filter(w => w.length >= 3);
    
    for (const [key, value] of Object.entries(patientData)) {
        if (!value || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const keyLower = key.toLowerCase();
        
        for (const word of fieldWords) {
            if (keyLower.includes(word)) {
                console.log(`✅ Частичное совпадение по слову "${word}": ${key} =`, value);
                return Array.isArray(value) ? value[0] : value;
            }
        }
        
        const keyNorm = keyLower.replace(/[\s_]/g, '');
        if (keyNorm.includes(fieldLower) || fieldLower.includes(keyNorm)) {
            console.log(`✅ Частичное совпадение (нормализованное): ${key} =`, value);
            return Array.isArray(value) ? value[0] : value;
        }
    }
    
    // 3. СПЕЦИАЛЬНЫЕ СЛУЧАИ
    const specialCases = {
        "Чувствительность к развитию ЭПС": ["чувствительность", "эпс", "эпc"],
        "Чувствительность к развитию ЭПC": ["чувствительность", "эпс", "эпc"],
        "антипсихотиком (АТХ: N05A)": ["антипсихотиком", "n05a", "опыт терапии"],
        "Опыт терапии": ["опыт терапии", "антипсихотиком"],
        "ПВТ": ["пвт", "противовирусной терапии"],
        "Психотическая симптоматика": ["психотическая", "симптоматика"],
        "АПП": ["апп", "антипсихотик"]
    };
    
    for (const [specialField, keywords] of Object.entries(specialCases)) {
        if (fieldName.toLowerCase().includes(specialField.toLowerCase()) || 
            specialField.toLowerCase().includes(fieldName.toLowerCase())) {
            for (const [key, value] of Object.entries(patientData)) {
                const keyLower = key.toLowerCase();
                for (const keyword of keywords) {
                    if (keyLower.includes(keyword)) {
                        console.log(`✅ Спецслучай "${specialField}": ${key} =`, value);
                        return Array.isArray(value) ? value[0] : value;
                    }
                }
            }
        }
    }
    
    console.log(`❌ Не найдено значение для ${fieldName}`);
    return null;
}
// ГЛУБОКИЙ ПОИСК В ОБЪЕКТЕ
function deepSearchInObject(obj, context, patientData, result) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
        if (key === "Качественное значение") {
            checkQualitativeValue(context, value, patientData, result);
        } else if (key === "Числовое значение") {
            checkNumericValue(context, value, patientData, result);
        } else if (key === "Характеристика") {
            checkCharacteristics(context, value, patientData, result);
        } else if (typeof value === 'object') {
            deepSearchInObject(value, context + " " + key, patientData, result);
        }
    }
}

// ФУНКЦИЯ ДЛЯ РАСЧЕТА СКОРА С НОРМАЛИЗАЦИЕЙ
function calculateMatchScoreWithNormalization(matchResult, variantName, patientData) {
    // БАЗОВЫЙ СКОР
    let matchScore = 50;
    
    // 1. БАЗОВОЕ СООТВЕТСТВИЕ
    if (matchResult.matches) {
        matchScore += 20;
    } else {
        matchScore -= 30;
    }
    
    // 2. ДЕТАЛИЗАЦИЯ
    if (matchResult.details && matchResult.details.length > 0) {
        matchScore += Math.min(10, matchResult.details.length * 2);
    }
    
    // 3. НЕСООТВЕТСТВИЯ
    if (matchResult.missing && matchResult.missing.length > 0) {
        matchScore -= Math.min(40, matchResult.missing.length * 8);
    }
    
    // 4. СПЕЦИФИЧНОСТЬ ВАРИАНТА
    const specificityBonus = countCriteriaNormalized(variantName);
    matchScore += specificityBonus;
    
    // 5. СПЕЦИФИЧНЫЕ КРИТЕРИИ
    const specificCriteriaBonus = evaluateSpecificCriteria(variantName, patientData);
    matchScore += specificCriteriaBonus;
    
    // 6. НОРМАЛИЗАЦИЯ
    matchScore = normalizeScore(matchScore);
    
    console.log(`📈 Скор для "${variantName}": ${matchScore}%`);
    
    return matchScore;
}

// НОРМАЛИЗАЦИЯ СКОРА
function normalizeScore(score) {
    return Math.round(Math.max(0, Math.min(100, score)));
}

// ПОДСЧЕТ КРИТЕРИЕВ В НАЗВАНИИ ВАРИАНТА
function countCriteriaNormalized(variantName) {
    if (!variantName) return 0;
    
    let criteriaCount = 0;
    
    const words = variantName.split(/[\s,()\-–—]+/).filter(word => {
        if (!word || word.length < 2) return false;
        const stopWords = ['с', 'и', 'без', 'при', 'на', 'по', 'для', 'у', 'в', 'из', 'от', 'до', 'имеется'];
        return !stopWords.includes(word.toLowerCase());
    });
    
    criteriaCount = Math.min(5, words.length);
    
    const medicalTerms = {
        'генотип': 2, 'цирроз': 2, 'трансплантац': 2, 'пвт': 1,
        'степень': 1, 'стадия': 1, 'тяжел': 1, 'легк': 1,
        'средн': 1, 'хроническ': 1, 'острый': 1
    };
    
    const lowerName = variantName.toLowerCase();
    for (const [term, bonus] of Object.entries(medicalTerms)) {
        if (lowerName.includes(term)) {
            criteriaCount += bonus;
        }
    }
    
    return Math.min(15, criteriaCount);
}

// ОЦЕНКА СПЕЦИФИЧНЫХ КРИТЕРИЕВ
function evaluateSpecificCriteria(variantName, patientData) {
    let bonus = 0;
    
    // ПРОВЕРКА ГЕНОТИПА ДЛЯ ГЕПАТИТА
    if (variantName.toLowerCase().includes('гепатит') || variantName.toLowerCase().includes('hcv')) {
        const patientGenotype = findGenotypeInPatientData(patientData);
        const variantGenotype = getGenotypeFromVariantName(variantName);
        
        if (patientGenotype && variantGenotype) {
            if (patientGenotype === variantGenotype) {
                bonus += 25;
                console.log(`✅ Совпадение генотипа: ${patientGenotype} = ${variantGenotype} (+25)`);
            } else {
                bonus -= 40;
                console.log(`❌ Несовпадение генотипа: ${patientGenotype} ≠ ${variantGenotype} (-40)`);
            }
        }
    }
    
    // ПРОВЕРКА ВЫРАЖЕННОСТИ ДЛЯ МИГРЕНИ — ИСПРАВЛЕНА
    if (variantName.toLowerCase().includes('мигрень')) {
        let patientSeverity = patientData["Приступ мигрени"] || patientData["Выраженность"];
        
        // ЗАЩИТА: если это массив, берём первый элемент
        if (Array.isArray(patientSeverity)) {
            patientSeverity = patientSeverity[0];
        }
        
        // ЗАЩИТА: если это объект, пытаемся извлечь значение
        if (patientSeverity && typeof patientSeverity === 'object') {
            patientSeverity = patientSeverity["Значение"] || Object.values(patientSeverity)[0];
        }
        
        const variantSeverity = getSeverityFromVariantName(variantName);
        
        if (patientSeverity && variantSeverity) {
            // ЗАЩИТА: преобразуем в строку перед вызовом toLowerCase()
            const severityStr = String(patientSeverity).toLowerCase();
            if (severityStr.includes(variantSeverity)) {
                bonus += 20;
                console.log(`✅ Совпадение выраженности мигрени: ${patientSeverity} (+20)`);
            }
        }
    }
    
    return bonus;
}
function checkFactor(factorName, factorValue, patientData) {
    console.log(`🔍 Проверка фактора "${factorName}":`, {
        'Ожидается': factorValue,
        'Тип значения': typeof factorValue
    });
    
    // Получаем значение пациента
    const patientValue = extractPatientValue(factorName, patientData);
    console.log(`Значение у пациента для "${factorName}":`, patientValue);
    
    // 1. ПРОВЕРКА: Если в базе знаний требуется ОТСУТСТВИЕ чего-либо
    // Например: "отсутствует", "не проводилась", "нет"
    const requiresAbsence = checkIfRequiresAbsence(factorValue);
    
    if (requiresAbsence) {
        console.log(`✅ Для "${factorName}" требуется отсутствие`);
        
        // Если у пациента нет значения или значение указывает на отсутствие
        if (!patientValue || patientValue === "" || patientValue === "undefined") {
            console.log(`✅ У пациента не указано "${factorName}" - считаем отсутствием`);
            return { 
                matches: true, 
                message: `${factorName}: не указано (требуется отсутствие) ✅` 
            };
        }
        
        // Проверяем, не указано ли у пациента что это есть
        const patientHasIt = checkIfPatientHasIt(patientValue, factorName);
        if (!patientHasIt) {
            return { 
                matches: true, 
                message: `${factorName}: ${patientValue} (отсутствует) ✅` 
            };
        } else {
            return { 
                matches: false, 
                message: `${factorName}: ${patientValue} (а должно отсутствовать) ❌` 
            };
        }
    }
    
    // 2. ПРОВЕРКА: Если у пациента нет значения
    if (!patientValue || patientValue === "" || patientValue === "undefined") {
        console.log(`⚠️ У пациента нет значения для "${factorName}"`);
        
        // Если требуется конкретное значение (не отсутствие)
        return { 
            matches: false, 
            message: `${factorName}: не указано (требуется: ${JSON.stringify(factorValue)}) ❌` 
        };
    }
    
    // 3. ПРОВЕРКА РАЗНЫХ ТИПОВ ЗНАЧЕНИЙ (остается как было)
    if (typeof factorValue === 'object' && factorValue !== null) {
        if (factorValue["качественное значение"]) {
            const expectedValues = factorValue["качественное значение"];
            if (Array.isArray(expectedValues)) {
                return checkArrayMatch(factorName, patientValue, expectedValues);
            }
        }
        
        if (factorValue["Качественное значение"]) {
            const qualValues = factorValue["Качественное значение"];
            const expectedValues = Object.keys(qualValues);
            return checkArrayMatch(factorName, patientValue, expectedValues);
        }
        
        if (factorValue["Характеристика"]) {
            return { 
                matches: true, 
                message: `${factorName}: характеристики учтены ✅` 
            };
        }
        
        // Вложенный объект (например, "Опыт терапии": {"ПВТ (противовирусной терапии)": {"отсутствует": {}}})
        for (const [key, nestedValue] of Object.entries(factorValue)) {
            if (typeof nestedValue === 'object') {
                const nestedCheck = checkFactor(key, nestedValue, patientData);
                if (!nestedCheck.matches) {
                    return nestedCheck;
                }
                return { 
                    matches: true, 
                    message: `${factorName}: ${nestedCheck.message}` 
                };
            }
        }
    } 
    
    else if (Array.isArray(factorValue)) {
        return checkArrayMatch(factorName, patientValue, factorValue);
    }
    
    else if (typeof factorValue === 'string') {
        if (patientValue.toLowerCase().includes(factorValue.toLowerCase()) ||
            factorValue.toLowerCase().includes(patientValue.toLowerCase())) {
            return { 
                matches: true, 
                message: `${factorName}: ${patientValue} (совпадает с "${factorValue}") ✅` 
            };
        } else {
            return { 
                matches: false, 
                message: `${factorName}: ${patientValue} ≠ "${factorValue}" ❌` 
            };
        }
    }
    
    return { 
        matches: true, 
        message: `${factorName}: учтено ✅` 
    };
}

// ДОБАВЬТЕ эти вспомогательные функции:

function checkIfRequiresAbsence(factorValue) {
    // Проверяем, требует ли фактор ОТСУТСТВИЯ чего-либо
    
    if (typeof factorValue === 'string') {
        const lowerValue = factorValue.toLowerCase();
        return lowerValue.includes('отсутствует') || 
               lowerValue.includes('не проводилась') || 
               lowerValue.includes('нет') ||
               lowerValue.includes('без');
    }
    
    if (Array.isArray(factorValue)) {
        return factorValue.some(item => {
            if (typeof item === 'string') {
                const lowerItem = item.toLowerCase();
                return lowerItem.includes('отсутствует') || 
                       lowerItem.includes('не проводилась') || 
                       lowerItem.includes('нет') ||
                       lowerItem.includes('без');
            }
            return false;
        });
    }
    
    if (typeof factorValue === 'object' && factorValue !== null) {
        // Проверяем "качественное значение" массив
        if (factorValue["качественное значение"]) {
            const expectedValues = factorValue["качественное значение"];
            if (Array.isArray(expectedValues)) {
                return expectedValues.some(item => {
                    if (typeof item === 'string') {
                        const lowerItem = item.toLowerCase();
                        return lowerItem.includes('отсутствует') || 
                               lowerItem.includes('не проводилась') || 
                               lowerItem.includes('нет') ||
                               lowerItem.includes('без');
                    }
                    return false;
                });
            }
        }
        
        // Проверяем "Качественное значение" объект
        if (factorValue["Качественное значение"]) {
            const qualValues = factorValue["Качественное значение"];
            const expectedValues = Object.keys(qualValues);
            return expectedValues.some(item => {
                const lowerItem = item.toLowerCase();
                return lowerItem.includes('отсутствует') || 
                       lowerItem.includes('не проводилась') || 
                       lowerItem.includes('нет') ||
                       lowerItem.includes('без');
            });
        }
    }
    
    return false;
}

function checkIfPatientHasIt(patientValue, factorName) {
    // Проверяем, указывает ли значение пациента на наличие чего-либо
    
    if (!patientValue) return false;
    
    const lowerValue = patientValue.toLowerCase();
    
    // Если в значении есть указание на наличие
    if (lowerValue.includes('есть') || 
        lowerValue.includes('имеется') || 
        lowerValue.includes('да') ||
        lowerValue.includes('присутствует') ||
        lowerValue.includes('проводилась') ||
        lowerValue.includes('положительный')) {
        return true;
    }
    
    // Если это конкретное заболевание или состояние
    if (lowerValue.includes('цирроз') || 
        lowerValue.includes('трансплантац') ||
        lowerValue.includes('оперирован')) {
        return true;
    }
    
    return false;
}

function checkArrayMatch(factorName, patientValue, expectedArray) {
    const patientLower = patientValue.toLowerCase();
    
    const found = expectedArray.some(expected => {
        if (!expected) return false;
        const expectedLower = String(expected).toLowerCase();
        
        // Проверяем разные варианты совпадения
        return patientLower.includes(expectedLower) ||
               expectedLower.includes(patientLower) ||
               patientLower === expectedLower;
    });
    
    if (found) {
        return { 
            matches: true, 
            message: `${factorName}: ${patientValue} (совпадает) ✅` 
        };
    } else {
        return { 
            matches: false, 
            message: `${factorName}: ${patientValue} ≠ ${expectedArray.join(" или ")} ❌` 
        };
    }
}

// ДОБАВЬТЕ эту вспомогательную функцию:
function checkArrayMatch(factorName, patientValue, expectedArray) {
    const found = expectedArray.some(expected => {
        if (!expected) return false;
        
        const patientLower = patientValue.toLowerCase();
        const expectedLower = String(expected).toLowerCase();
        
        // Проверяем разные варианты совпадения
        return patientLower.includes(expectedLower) ||
               expectedLower.includes(patientLower) ||
               patientLower === expectedLower;
    });
    
    if (found) {
        return { 
            matches: true, 
            message: `${factorName}: ${patientValue} (совпадает с одним из: ${expectedArray.join(", ")}) ✅` 
        };
    } else {
        return { 
            matches: false, 
            message: `${factorName}: ${patientValue} ≠ ${expectedArray.join(" или ")} ❌` 
        };
    }
}

function checkObservation(obsName, obsValue, patientData) {
    // Упрощенная проверка наблюдений
    return { matches: true, message: `${obsName}: наблюдение учтено` };
}

function extractPatientValue(fieldName, patientData) {
    if (!patientData) {
        console.log(`❌ Нет данных пациента для поиска "${fieldName}"`);
        return "";
    }
    
    // Нормализуем имя поля для поиска
    const fieldNameLower = fieldName.toLowerCase().replace(/\s+/g, '').replace(/[^а-яa-z0-9]/g, '');
    
    // 1. Прямой поиск
    if (patientData[fieldName] !== undefined) {
        const value = patientData[fieldName];
        console.log(`✅ Найдено прямое совпадение для "${fieldName}":`, value);
        return Array.isArray(value) ? value[0] : String(value);
    }
    
    // 2. Поиск по частичному совпадению
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase().replace(/\s+/g, '').replace(/[^а-яa-z0-9]/g, '');
        
        if (keyLower.includes(fieldNameLower) || fieldNameLower.includes(keyLower)) {
            console.log(`✅ Найдено частичное совпадение "${key}" для "${fieldName}":`, value);
            return Array.isArray(value) ? value[0] : String(value);
        }
    }
    
    // 3. Поиск по ключевым словам
    const keywords = {
        'цирроз': ['цирроз', 'cirrhosis', 'цп'],
        'трансплантац': ['трансплантац', 'transplant'],
        'генотип': ['генотип', 'genotype'],
        'пвт': ['пвт', 'противовирусн', 'antiviral'],
        'опыт': ['опыт', 'experience', 'терапии']
    };
    
    for (const [keyword, variations] of Object.entries(keywords)) {
        if (fieldNameLower.includes(keyword)) {
            for (const [key, value] of Object.entries(patientData)) {
                const keyLower = key.toLowerCase();
                if (variations.some(variation => keyLower.includes(variation))) {
                    console.log(`✅ Найдено по ключевому слову "${keyword}" в "${key}":`, value);
                    return Array.isArray(value) ? value[0] : String(value);
                }
            }
        }
    }
    
    console.log(`❌ Не найдено поле "${fieldName}" в данных пациента`);
    console.log("Доступные поля:", Object.keys(patientData));
    return "";
}

function extractTreatments(treatmentPlan) {
    const treatments = [];
    
    if (!treatmentPlan) {
        return treatments;
    }
    
    // 1. Сначала ищем "вариант лечения"
    if (treatmentPlan["вариант лечения"]) {
        const treatmentOptions = treatmentPlan["вариант лечения"];
        
        // Перебираем все варианты (может быть "1", "2", "3" и т.д.)
        for (const [optionKey, option] of Object.entries(treatmentOptions)) {
            if (!option) continue;
            
            // УНИВЕРСАЛЬНЫЙ ПОИСК лекарств в любой структуре
            const foundDrugs = findDrugsInObject(option);
            if (foundDrugs.length > 0) {
                treatments.push(...foundDrugs);
            }
        }
    }
    
    return treatments;
}

// Новая универсальная функция поиска лекарств
function findDrugsInObject(obj) {
    const results = [];
    
    if (!obj || typeof obj !== 'object') {
        return results;
    }
    
    // Ищем комбинацию препаратов
    if (obj["комбинация"] && obj["комбинация"]["Действующее вещество"]) {
        const drugs = Object.keys(obj["комбинация"]["Действующее вещество"]);
        if (drugs.length > 0) {
            results.push(`**Комбинация препаратов:** ${drugs.join(" + ")}`);
        }
    }
    
    // Ищем отдельные действующие вещества
    if (obj["Действующее вещество"]) {
        const substances = Object.keys(obj["Действующее вещество"]);
        if (substances.length > 0) {
            results.push(`**Действующее вещество:** ${substances.join(", ")}`);
        }
    }
    
    // Ищем в медикаментозном разделе
    if (obj["медикаментозное"]) {
        const medResults = findDrugsInObject(obj["медикаментозное"]);
        results.push(...medResults);
    }
    
    // Ищем фарм-группы
    if (obj["Фарм-группа"]) {
        const groups = Object.keys(obj["Фарм-группа"]);
        if (groups.length > 0) {
            results.push(`**Фарм-группы:** ${groups.join(", ")}`);
        }
    }
    
    // Рекурсивно ищем во вложенных объектах
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            const nestedResults = findDrugsInObject(obj[key]);
            results.push(...nestedResults);
        }
    }
    
    return results;
}

// Новая функция для проверки подходит ли рекомендация
function isRecommendationSuitable(recommendation, patientData, patientGenotype) {
    // Базовые критерии
    if (recommendation.match_score < 50 || recommendation.critical_mismatch) {
        return false;
    }
    
    // Проверяем соответствие генотипу (если есть)
    if (patientGenotype) {
        const genotypeMatch = checkGenotypeMatch(recommendation, patientData);
        if (!genotypeMatch) {
            console.log(`❌ Рекомендация "${recommendation.variant_name}" не подходит: генотип не совпадает`);
            return false;
        }
    } else {
        // Если генотип не указан, пропускаем специфичные к генотипу рекомендации
        const isGenotypeSpecific = recommendation.variant_name && (
            recommendation.variant_name.toLowerCase().includes('генотип') ||
            recommendation.variant_name.toLowerCase().includes('genotype') ||
            recommendation.variant_name.includes('1a') ||
            recommendation.variant_name.includes('1b') ||
            recommendation.variant_name.includes('2') ||
            recommendation.variant_name.includes('3') ||
            recommendation.variant_name.includes('4')
        );
        
        if (isGenotypeSpecific) {
            console.log(`⚠️ Пропускаем "${recommendation.variant_name}": требует указания генотипа`);
            return false;
        }
    }
    
    return true;
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

function calculateMatchScoreWithNormalization(matchResult, variantName, patientData) {
    // БАЗОВЫЙ СКОР
    let matchScore = 50;
    
    // 1. БАЗОВОЕ СООТВЕТСТВИЕ
    if (matchResult.matches) {
        matchScore += 20; // За общее соответствие
    } else {
        matchScore -= 30; // Штраф за несоответствие
    }
    
    // 2. ДЕТАЛИЗАЦИЯ (ограниченное влияние)
    if (matchResult.details && matchResult.details.length > 0) {
        // Максимум +10% за детали
        matchScore += Math.min(10, matchResult.details.length * 2);
    }
    
    // 3. НЕСООТВЕТСТВИЯ (большой штраф)
    if (matchResult.missing && matchResult.missing.length > 0) {
        matchScore -= Math.min(40, matchResult.missing.length * 8);
    }
    
    // 4. СПЕЦИФИЧНОСТЬ ВАРИАНТА (ограниченный бонус)
    const specificityBonus = countCriteriaNormalized(variantName);
    matchScore += specificityBonus;
    
    // 5. ПРОВЕРКА СПЕЦИФИЧНЫХ КРИТЕРИЕВ (например, генотип для гепатита)
    const specificCriteriaBonus = evaluateSpecificCriteria(variantName, patientData);
    matchScore += specificCriteriaBonus;
    
    // 6. НОРМАЛИЗАЦИЯ К 100%
    matchScore = normalizeScore(matchScore);
    
    console.log(`📈 Скор для "${variantName}": ${matchScore}% (до нормализации: ${matchScore})`);
    
    return matchScore;
}

function normalizeScore(score) {
    // Гарантируем, что скор будет в диапазоне 0-100%
    const normalized = Math.max(0, Math.min(100, score));
    
    // Округляем до целого числа
    return Math.round(normalized);
}

function countCriteriaNormalized(variantName) {
    if (!variantName) return 0;
    
    let criteriaCount = 0;
    
    // Разбиваем название на значимые слова
    const words = variantName.split(/[\s,()\-–—]+/).filter(word => {
        if (!word || word.length < 2) return false;
        
        // Исключаем служебные слова
        const stopWords = ['с', 'и', 'без', 'при', 'на', 'по', 'для', 'у', 'в', 'из', 'от', 'до', 'имеется'];
        return !stopWords.includes(word.toLowerCase());
    });
    
    // Базовый подсчет слов (максимум 5 баллов)
    criteriaCount = Math.min(5, words.length);
    
    // Бонусы за специфичные медицинские термины (максимум 10 баллов)
    const medicalTerms = {
        'генотип': 2,
        'цирроз': 2,
        'трансплантац': 2,
        'пвт': 1,
        'степень': 1,
        'стадия': 1,
        'тяжел': 1,
        'легк': 1,
        'средн': 1,
        'хроническ': 1,
        'острый': 1
    };
    
    const lowerName = variantName.toLowerCase();
    for (const [term, bonus] of Object.entries(medicalTerms)) {
        if (lowerName.includes(term)) {
            criteriaCount += bonus;
        }
    }
    
    // Ограничиваем общий бонус 15 баллами
    return Math.min(15, criteriaCount);
}

// function evaluateSpecificCriteria(variantName, patientData) {
//     let bonus = 0;
    
//     // ПРОВЕРКА ГЕНОТИПА ДЛЯ ГЕПАТИТА
//     if (variantName.toLowerCase().includes('гепатит') || variantName.toLowerCase().includes('hcv')) {
//         const patientGenotype = findGenotypeInPatientData(patientData);
//         const variantGenotype = getGenotypeFromVariantName(variantName);
        
//         if (patientGenotype && variantGenotype) {
//             if (patientGenotype === variantGenotype) {
//                 bonus += 25; // Большой бонус за точное совпадение генотипа
//                 console.log(`✅ Совпадение генотипа: ${patientGenotype} = ${variantGenotype} (+25)`);
//             } else {
//                 bonus -= 40; // Большой штраф за несовпадение
//                 console.log(`❌ Несовпадение генотипа: ${patientGenotype} ≠ ${variantGenotype} (-40)`);
//             }
//         }
//     }
    
//     // ПРОВЕРКА ВЫРАЖЕННОСТИ ДЛЯ МИГРЕНИ
//     if (variantName.toLowerCase().includes('мигрень')) {
//         const patientSeverity = patientData["Приступ мигрени"] || patientData["Выраженность"];
//         const variantSeverity = getSeverityFromVariantName(variantName);
        
//         if (patientSeverity && variantSeverity) {
//             if (patientSeverity.toLowerCase().includes(variantSeverity)) {
//                 bonus += 20;
//                 console.log(`✅ Совпадение выраженности мигрени: ${patientSeverity} (+20)`);
//             }
//         }
//     }
    
//     return bonus;
// }

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

function checkGenotypeMatch(recommendation, patientData) {
    // Получаем генотип из данных пациента
    const patientGenotype = findGenotypeInPatientData(patientData);
    
    // Если генотип не указан, считаем рекомендацию подходящей
    if (!patientGenotype || patientGenotype === '' || patientGenotype === 'не определен') {
        console.log("Генотип не указан, считаем рекомендацию подходящей");
        return true;
    }
    
    const patientGenotypeStr = String(patientGenotype).toLowerCase().trim();
    const variantName = recommendation.variant_name ? recommendation.variant_name.toLowerCase() : '';
    
    console.log("Проверка генотипа:", {
        patientGenotype: patientGenotypeStr,
        variantName: variantName
    });
    
    // Проверяем, упоминается ли генотип в названии варианта
    const hasGenotypeSpecification = 
        variantName.includes('генотип') || 
        variantName.includes('genotype') ||
        variantName.includes('1a') || 
        variantName.includes('1b') ||
        variantName.includes('2') || 
        variantName.includes('3') ||
        variantName.includes('4') || 
        variantName.includes('5') || 
        variantName.includes('6');
    
    if (!hasGenotypeSpecification) {
        // Вариант не специфичен к генотипу - подходит
        console.log("Вариант не специфичен к генотипу - подходит");
        return true;
    }
    
    // Проверяем соответствие генотипа
    if (variantName.includes('1a') && patientGenotypeStr.includes('1a')) {
        console.log("✓ Совпадение генотипа 1a");
        return true;
    }
    if (variantName.includes('1b') && patientGenotypeStr.includes('1b')) {
        console.log("✓ Совпадение генотипа 1b");
        return true;
    }
    if (variantName.includes('2') && patientGenotypeStr.includes('2')) return true;
    if (variantName.includes('3') && patientGenotypeStr.includes('3')) return true;
    if (variantName.includes('4') && patientGenotypeStr.includes('4')) return true;
    if (variantName.includes('5') && patientGenotypeStr.includes('5')) return true;
    if (variantName.includes('6') && patientGenotypeStr.includes('6')) return true;
    
    // Если генотип указан, но не совпадает - не подходит
    console.log(`❌ Несовпадение генотипа: вариант для ${variantName.includes('1a') ? '1a' : variantName.includes('1b') ? '1b' : 'другого'}, у пациента ${patientGenotypeStr}`);
    return false;
}

function getDetailedAnalysis() {
    if (!window.lastStructuredData) {
        if (window.lastExplanation) {
            return window.lastExplanation + "\n\n---\n*Детальный анализ не доступен*";
        }
        return "❌ Детальный анализ не доступен. Сначала выполните анализ.";
    }
    
    const data = window.lastStructuredData;
    const result = [];
    
    result.push("📊 **ДЕТАЛЬНЫЙ АНАЛИЗ**");
    result.push("");
    
    // ===== 1. ДАННЫЕ ПАЦИЕНТА =====
    result.push("👤 **ПАЦИЕНТ**");
    result.push(`• ${data.diagnosis}`);
    if (data.patientData["Возраст"]) result.push(`• ${data.patientData["Возраст"]} лет`);
    if (data.patientData["Сведения паспортные_Пол"]) {
        result.push(`• ${data.patientData["Сведения паспортные_Пол"] === "м" ? "Мужчина" : "Женщина"}`);
    }
    
    // Выводим ключевые данные пациента
    const hr = data.patientData["Частота сердечных сокращений"];
    if (hr) result.push(`• ЧСС: ${hr} уд/мин`);
    
    const genotype = data.patientData["Анализ крови на гепатит С с определением генотипа_Результат"];
    if (genotype) result.push(`• Генотип: ${genotype}`);
    
    result.push("");
    
    // ===== 2. ВСЕ РАССМОТРЕННЫЕ ВАРИАНТЫ =====
    result.push("📋 **РАССМОТРЕННЫЕ ВАРИАНТЫ**");
    result.push("");
    
    data.allVariants.forEach((variant, idx) => {
        const isSelected = variant.isSelected;
        const icon = isSelected ? "✅" : "📌";
        const score = Math.round(variant.score);
        
        // Формат: "название (раздел базы знаний)"
        let nodeTypeShort = variant.nodeType;
        nodeTypeShort = nodeTypeShort.replace(" (функциональный класс)", "");
        nodeTypeShort = nodeTypeShort.replace("Вариант течения", "Вариант течения");
        
        result.push(`${icon} ${idx + 1}. **${variant.name}** (${nodeTypeShort})`);
        
        // Процент совпадения с пояснением
        let scoreText = "";
        if (score >= 90) scoreText = "Отлично подходит";
        else if (score >= 75) scoreText = "Хорошо подходит";
        else if (score >= 60) scoreText = "Частично подходит";
        else if (score >= 40) scoreText = "Ограниченно подходит";
        else scoreText = "Не подходит";
        
        result.push(`   • Совпадение: ${scoreText} (${score}%)`);
        
        // ===== ЧЕГО НЕ ХВАТАЕТ ДО 100% =====
        let missingItems = [];
        
        if (data.diagnosis === "Стабильная ИБС") {
            if (hr && hr > 60) {
                missingItems.push(`ЧСС ${hr} > целевого 60 уд/мин`);
            }
            if (score === 60 && !isSelected && variant.name.includes("приступ")) {
                missingItems.push(`отсутствуют жалобы на боль в грудной клетке`);
            }
        }
        
        if (data.diagnosis === "Хронический вирусный гепатит C") {
            if (!data.patientData["Цирроз печени"] || data.patientData["Цирроз печени"] === "") {
                missingItems.push(`не указано наличие цирроза`);
            }
            if (!data.patientData["Трансплантация печени"] || data.patientData["Трансплантация печени"] === "") {
                missingItems.push(`не указана трансплантация печени`);
            }
        }
        
        if (missingItems.length > 0) {
            result.push(`   • ⚠️ Требуется уточнение: ${missingItems.join(", ")}`);
        }
        
        // ===== ПРИЧИНЫ ВЫБОРА (для основного варианта) =====
        if (isSelected) {
            let reasons = [];
            
            if (data.diagnosis === "Стабильная ИБС") {
                if (hr && hr <= 90) {
                    reasons.push("отсутствие острого приступа");
                    reasons.push("стабильное течение стенокардии");
                }
                if (variant.name.includes("I–II ФК")) {
                    reasons.push("соответствие функциональному классу I–II");
                }
            }
            
            if (data.diagnosis === "Хронический вирусный гепатит C") {
                if (variant.genotypeMatch === true) reasons.push("генотип соответствует");
                if (variant.cirrhosisMatch === true) reasons.push("состояние печени соответствует");
                if (variant.transplantMatch === true) reasons.push("статус трансплантации соответствует");
                if (variant.pvtMatch === true) reasons.push("опыт ПВТ соответствует");
            }
            
            // Если нет специфических причин, добавляем общие
            if (reasons.length === 0 && data.selectedVariant.matches && data.selectedVariant.matches.length > 0) {
                data.selectedVariant.matches.forEach(m => {
                    let cleanMatch = m.replace(/^[✅❌⚠️•]\s*/, "");
                    reasons.push(cleanMatch);
                });
            }
            
            if (reasons.length > 0) {
                result.push(`   • ✅ Причины выбора:`);
                reasons.forEach(r => result.push(`     - ${r}`));
            }
        }
        
        // ===== ПРИЧИНЫ ОТКЛОНЕНИЯ (для альтернативных вариантов) =====
        if (!isSelected) {
            if (variant.name.includes("приступ") && data.diagnosis === "Стабильная ИБС") {
                result.push(`   • ❌ Не выбран: отсутствуют жалобы на боль в грудной клетке`);
            } else if (score < 60) {
                result.push(`   • ❌ Не выбран: низкое совпадение (${score}%)`);
            } else if (score >= 60 && score < 90) {
                result.push(`   • ⚠️ Альтернативный вариант (может применяться при противопоказаниях)`);
            } else if (score >= 90) {
                result.push(`   • ⚠️ Высокое совпадение, но выбран более специфичный вариант`);
            }
        }
        
        // ===== ЛЕЧЕНИЕ ДЛЯ КАЖДОГО ВАРИАНТА =====
        let variantTreatments = [];
        
        if (isSelected && data.selectedVariant.treatments && data.selectedVariant.treatments.length > 0) {
            variantTreatments = data.selectedVariant.treatments;
        } else if (!isSelected && variant.treatments && variant.treatments.length > 0) {
            variantTreatments = variant.treatments;
        }
        
        if (variantTreatments.length > 0) {
            result.push(`   • 💊 Лечение:`);
            variantTreatments.slice(0, 3).forEach(t => {
                let clean = t.replace(/\*\*/g, '').trim();
                if (clean.length > 70) clean = clean.substring(0, 70) + "...";
                result.push(`     - ${clean}`);
            });
            if (variantTreatments.length > 3) {
                result.push(`     - и еще ${variantTreatments.length - 3}...`);
            }
        }
        
        result.push("");
    });
    
    // ===== 3. РЕКОМЕНДАЦИИ ВРАЧУ =====
    result.push("📋 **РЕКОМЕНДАЦИИ ВРАЧУ**");
    
    if (data.diagnosis === "Стабильная ИБС") {
        if (hr && hr > 60) {
            result.push(`• Целевой уровень ЧСС: менее 60 уд/мин (текущий: ${hr})`);
            result.push("• Рекомендуется титрование дозы бета-блокатора");
        }
        result.push("• Контроль артериального давления");
        result.push("• Оценка липидного профиля");
    } else if (data.diagnosis === "Хронический вирусный гепатит C") {
        result.push("• Перед началом терапии оценить функцию печени");
        result.push("• Контроль вирусной нагрузки через 4 и 12 недель");
        result.push("• Мониторинг побочных эффектов");
    } else {
        result.push("• Проверить противопоказания к рекомендованным препаратам");
        result.push("• Учесть сопутствующие заболевания пациента");
        result.push("• Определить индивидуальные дозировки");
    }
    
    result.push("");
    result.push("---");
    result.push("*Для возврата к краткому виду нажмите «Вернуться к анализу»*");
    
    return result.join("\n");
}
// Вспомогательная функция для извлечения генотипа из названия варианта
function getGenotypeFromVariantName(variantName) {
    const name = variantName.toLowerCase();
    if (name.includes('1a')) return '1a';
    if (name.includes('1b')) return '1b';
    if (name.includes('2')) return '2';
    if (name.includes('3')) return '3';
    if (name.includes('4')) return '4';
    if (name.includes('5')) return '5';
    if (name.includes('6')) return '6';
    return null;
}

function getSeverityFromVariantName(variantName) {
    const name = variantName.toLowerCase();
    if (name.includes('легк')) return 'легк';
    if (name.includes('средн')) return 'средн';
    if (name.includes('тяжел')) return 'тяжел';
    return null;
}

// Функция для поиска лучшей рекомендации по генотипу
function findBestRecommendationForGenotype(recommendationsByDiagnosis, patientGenotype) {
    let bestRec = null;
    let bestScore = 0;
    
    for (const diagnosis in recommendationsByDiagnosis) {
        const recs = recommendationsByDiagnosis[diagnosis];
        
        for (const rec of recs) {
            // Проверяем соответствие генотипу
            const genotypeMatch = checkGenotypeMatch(rec, { 
                'Анализ крови на гепатит С с определением генотипа_Результат': patientGenotype 
            });
            
            if (genotypeMatch && rec.match_score > bestScore && !rec.critical_mismatch) {
                bestScore = rec.match_score;
                bestRec = rec;
            }
        }
    }
    
    return bestRec;
}

function toggleDetailedView() {
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (!analysisResultsDiv) return;
    
    const detailedExplanation = getDetailedAnalysis();
    
    // Преобразуем разметку в HTML
    const htmlExplanation = detailedExplanation
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/🏆/g, '<span style="color: #f1c40f;">🏆</span>')
        .replace(/📋/g, '<span style="color: #3498db;">📋</span>')
        .replace(/🔍/g, '<span style="color: #9b59b6;">🔍</span>')
        .replace(/👤/g, '<span style="color: #9b59b6;">👤</span>')
        .replace(/⚠️/g, '<span style="color: #f39c12;">⚠️</span>')
        .replace(/✓/g, '<span style="color: #27ae60;">✓</span>')
        .replace(/✗/g, '<span style="color: #e74c3c;">✗</span>');
    
    analysisResultsDiv.innerHTML = `
        <div class="analysis-result detailed-view">
            <div style="
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                border-left: 4px solid #3498db;
            ">
                ${htmlExplanation}
            </div>
            
            <div style="text-align: center;">
                <button onclick="toggleBriefView()" class="toggle-btn" 
                    style="
                        background-color: #45a049;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                    📋 Вернуться к краткому виду
                </button>
            </div>
        </div>
    `;
}

function toggleBriefView() {
    // Вызываем исходный анализ для краткого вида
    if (window.lastExplanation && window.lastPatientData) {
        showAnalysisResults(window.lastExplanation, window.lastPatientData);
    } else {
        window.analyzeData();
    }
}

function toggleBriefView() {
    // Вызываем исходный анализ для краткого вида
    window.analyzeData();
}

function showAnalysisResults(explanation, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (!resultsDiv || !analysisResultsDiv) {
        console.error("❌ Не найдены элементы для отображения результатов");
        showNotification("❌ Не найдено место для отображения результатов", "error");
        return;
    }
    
    // Преобразуем разметку в HTML
    const htmlExplanation = explanation
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/🎯/g, '<span style="color: #e74c3c; font-size: 1.2em;">🎯</span>')
        .replace(/💊/g, '<span style="color: #27ae60; font-size: 1.2em;">💊</span>')
        .replace(/📋/g, '<span style="color: #3498db; font-size: 1.2em;">📋</span>')
        .replace(/✅/g, '<span style="color: #27ae60;">✅</span>')
        .replace(/⚠️/g, '<span style="color: #f39c12;">⚠️</span>')
        .replace(/❌/g, '<span style="color: #e74c3c;">❌</span>')
        .replace(/\•/g, '•');
    
    // Получаем все введённые данные
    const allEnteredData = window.extract_patient_data();
    
    // Определяем, какие поля НЕ были использованы в анализе
    const usedFields = [];
    if (window.lastStructuredData) {
        // Поля, которые использовались в анализе (диагноз, возраст, пол и т.д.)
        if (patientData["Клинический диагноз"]) usedFields.push("Клинический диагноз");
        if (patientData["Возраст"]) usedFields.push("Возраст");
        if (patientData["Сведения паспортные_Пол"]) usedFields.push("Сведения паспортные_Пол");
        if (patientData["Пол"]) usedFields.push("Пол");
        if (patientData["Частота сердечных сокращений"]) usedFields.push("Частота сердечных сокращений");
        if (patientData["Психотическая симптоматика"]) usedFields.push("Психотическая симптоматика");
        if (patientData["Чувствительность к развитию ЭПC"]) usedFields.push("Чувствительность к развитию ЭПC");
        if (patientData["Анализ крови на гепатит С с определением генотипа_Результат"]) usedFields.push("Генотип");
    }
    
    // Дополнительные поля (не использованные в анализе)
    const additionalFields = Object.keys(allEnteredData).filter(key => 
        !usedFields.includes(key) && 
        key !== "Клинический диагноз" &&
        allEnteredData[key] !== null &&
        allEnteredData[key] !== undefined &&
        allEnteredData[key] !== ""
    );
    
    // Создаём HTML для дополнительных полей
    let additionalFieldsHtml = "";
    if (additionalFields.length > 0) {
        let fieldsList = "";
        additionalFields.forEach(field => {
            let value = allEnteredData[field];
            if (Array.isArray(value)) value = value.join(", ");
            let fieldName = field.replace(/_/g, " ").replace(/Опыт терапии Опыт терапии /g, "Опыт терапии: ");
            fieldsList += `<div style="margin-bottom: 5px;">• <strong>${fieldName}:</strong> ${value}</div>`;
        });
        
        additionalFieldsHtml = `
            <details style="margin-top: 15px; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                <summary style="cursor: pointer; color: #666; font-weight: bold;">📋 Дополнительные данные (не влияют на анализ)</summary>
                <div style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 5px; border: 1px solid #eee;">
                    ${fieldsList}
                    <div style="margin-top: 8px; font-size: 12px; color: #999;">
                        ⚠️ Эти данные сохранены в истории болезни, но не используются для выбора лечения при данном диагнозе
                    </div>
                </div>
            </details>
        `;
    }
    
    analysisResultsDiv.innerHTML = `
        <div class="analysis-result" style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
            ">
                <div style="
                    border-left: 4px solid #e74c3c;
                    padding-left: 15px;
                    margin-bottom: 20px;
                ">
                    ${htmlExplanation}
                </div>
                
                ${additionalFieldsHtml}
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="toggleDetailedView()" class="toggle-btn" 
                        style="
                            background-color: #3498db;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            margin-right: 10px;
                        ">
                        📊 Показать детали анализа
                    </button>
                    
                    <button onclick="saveAllData()" class="save-btn"
                        style="
                            background-color: #27ae60;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                        💾 Сохранить историю
                    </button>
                </div>
            </div>
            
            <details style="
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin-top: 15px;
                border: 1px solid #ddd;
            ">
                <summary style="
                    cursor: pointer;
                    color: #666;
                    font-weight: bold;
                ">📄 Исходные данные пациента (для проверки)</summary>
                <div style="margin-top: 10px;">
                    <pre style="
                        white-space: pre-wrap;
                        background: #fff;
                        padding: 15px;
                        border-radius: 4px;
                        margin-top: 10px;
                        max-height: 200px;
                        overflow-y: auto;
                        font-size: 12px;
                        border: 1px solid #eee;
                    ">
${JSON.stringify(patientData, null, 2)}
                    </pre>
                </div>
            </details>
        </div>
    `;
    
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// Функция для перевода score в понятный текст
function translateScore(score) {
    if (score >= 90) return "✅ Отлично подходит";
    if (score >= 75) return "✅ Хорошо подходит";
    if (score >= 60) return "⚠️ Частично подходит (требует уточнения)";
    if (score >= 40) return "⚠️ Ограниченно подходит";
    return "❌ Не подходит";
}

// Функция для извлечения текста лечения
function extractTreatmentText(recommendation) {
    if (!recommendation.treatments || recommendation.treatments.length === 0) {
        return "Лечение не указано";
    }
    
    const treatment = recommendation.treatments.find(t => 
        t.type === 'combination' || t.type === 'medication'
    ) || recommendation.treatments[0];
    
    if (treatment.type === 'combination' && treatment.drugs) {
        return treatment.drugs.join(' + ');
    }
    
    return treatment.text || "Лечение не указано";
}

// Функция для поиска генотипа (улучшенная)
function findGenotypeInPatientData(patientData) {
    if (!patientData) return null;
    
    // Ищем в разных полях
    const possibleFields = [
        'Анализ крови на гепатит С с определением генотипа_Результат',
        'Генотип',
        'Генотип вируса',
        'Генотип HCV',
        'Генотип гепатита С',
        'Результат'
    ];
    
    for (const field of possibleFields) {
        if (patientData[field]) {
            let value = patientData[field];
            
            // Если массив - берем первый элемент
            if (Array.isArray(value)) {
                value = value[0];
            }
            
            // Преобразуем в строку и проверяем на генотип
            const strValue = String(value).trim().toLowerCase();
            
            if (strValue.includes('1a') || strValue === '1a') return '1a';
            if (strValue.includes('1b') || strValue === '1b') return '1b';
            if (strValue.includes('2') || strValue === '2') return '2';
            if (strValue.includes('3') || strValue === '3') return '3';
            if (strValue.includes('4') || strValue === '4') return '4';
            if (strValue === '1') return '1'; // Общий для 1
        }
    }
    
    return null;
}

function extractPatientDiagnosis(patientData) {
    if (!patientData) return null;
    
    // Пробуем разные возможные поля
    const possibleFields = [
        "Клинический диагноз",
        "Диагноз", 
        "Основной диагноз",
        "Сопутствующий диагноз"
    ];
    
    for (const field of possibleFields) {
        if (patientData[field]) {
            const value = patientData[field];
            
            // Приводим к строке
            let diagnosisStr = "";
            if (Array.isArray(value)) {
                diagnosisStr = value[0]; // Берем первый диагноз
            } else {
                diagnosisStr = String(value);
            }
            
            // Убираем лишние пробелы
            diagnosisStr = diagnosisStr.trim();
            
            // Приводим к стандартному виду для поиска в базе знаний
            return normalizeDiagnosis(diagnosisStr);
        }
    }
    
    return null;
}

// Новая функция для нормализации диагноза
function normalizeDiagnosis(diagnosis) {
    if (!diagnosis) return null;
    
    const lowerDiagnosis = diagnosis.toLowerCase().trim();
    
    // Маппинг различных написаний
    const diagnosisMapping = {
        'стабильная ибс': 'Стабильная ИБС',
        'ибс': 'Стабильная ИБС', 
        'ишемическая болезнь сердца': 'Стабильная ИБС',
        'мигрень': 'Мигрень',
        'хронический вирусный гепатит c': 'Хронический вирусный гепатит C',
        'хвгс': 'Хронический вирусный гепатит C',
        'артериальная гипертензия': 'Артериальная гипертензия',
        'аг': 'Артериальная гипертензия',
        'переломы лодыжек': 'Переломы лодыжек',
        'перелом лодыжки': 'Переломы лодыжек',
        'повреждение связок коленного сустава': 'Повреждение связок коленного сустава',
        'переломы ключицы и лопатки': 'Переломы ключицы и лопатки',
        'переломы проксимального отдела бедренной кости': 'Переломы проксимального отдела бедренной кости',
        'переломы проксимального отдела костей голени': 'Переломы проксимального отдела костей голени',
        'повреждения тазового кольца': 'Повреждения тазового кольца',
        'переломы надколенника': 'Переломы надколенника',
        'вывих шейного позвонка': 'Вывих шейного позвонка'
    };
    
    // Ищем точное соответствие
    for (const [key, value] of Object.entries(diagnosisMapping)) {
        if (lowerDiagnosis.includes(key) || key.includes(lowerDiagnosis)) {
            return value;
        }
    }
    
    // Если не нашли в маппинге, пытаемся найти в базе знаний
    return capitalizeFirstLetter(diagnosis);
}

// Вспомогательная функция
function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function extractImprovedGoals(treatmentPlan) {
    const goals = [];
    
    if (!treatmentPlan || !treatmentPlan["Цель"]) {
        return goals;
    }
    
    const goalData = treatmentPlan["Цель"];
    
    for (const [goalKey, goalValue] of Object.entries(goalData)) {
        if (!goalValue || typeof goalValue !== 'object') continue;
        
        for (const [action, actionData] of Object.entries(goalValue)) {
            if (typeof actionData === 'object') {
                // Пример: "снизить": {"Наблюдение": {"Частота сердечных сокращений": {...}}}
                for (const [subAction, subData] of Object.entries(actionData)) {
                    if (subAction === "Наблюдение" && typeof subData === 'object') {
                        for (const [observationName, observationData] of Object.entries(subData)) {
                            let goalText = `${action} ${observationName.toLowerCase()}`;
                            
                            if (observationData && typeof observationData === 'object') {
                                if (observationData["Числовое значение"]) {
                                    const numData = observationData["Числовое значение"];
                                    if (numData["нижняя граница"] && numData["верхняя граница"]) {
                                        goalText += ` до ${numData["нижняя граница"]}-${numData["верхняя граница"]} ${numData["единица измерения"] || ''}`;
                                    } else if (numData["нижняя граница"]) {
                                        goalText += ` до ${numData["нижняя граница"]} ${numData["единица измерения"] || ''}`;
                                    }
                                }
                            }
                            
                            goals.push(goalText);
                        }
                    } else if (typeof subData === 'string') {
                        goals.push(`${action} ${subAction} ${subData}`);
                    }
                }
            } else if (typeof actionData === 'string') {
                goals.push(`${action} ${actionData}`);
            }
        }
    }
    
    return goals;
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

// ТЕСТОВАЯ ФУНКЦИЯ - можно вызвать из консоли
window.testSolver = function() {
    console.log("=== ТЕСТ РЕШАТЕЛЯ ===");
    
    // Тестовые данные
    const testData = {
        "Клинический диагноз": "Хронический вирусный гепатит C",
        "Возраст": 45,
        "Анализ крови на гепатит С с определением генотипа_Результат": ["1b"],
        "Опыт терапии_Опыт терапии_ПВТ (противовирусной терапии)": ["отсутствует"]
    };
    
    console.log("Тестовые данные:", testData);
    
    // Проверяем extractPatientValue
    console.log("\n🔍 Проверка extractPatientValue:");
    console.log("Цирроз печени:", extractPatientValue("Цирроз печени", testData));
    console.log("Трансплантация печени:", extractPatientValue("Трансплантация печени", testData));
    console.log("Генотип:", extractPatientValue("Генотип", testData));
    console.log("ПВТ:", extractPatientValue("ПВТ", testData));
    
    return "Тест завершен";
};

window.testKnowledgeBase = function() {
    if (!window.knowledgeBase) {
        console.log("❌ База знаний не загружена");
        return;
    }
    
    console.log("=== ПРОВЕРКА БАЗЫ ЗНАНИЙ ===");
    console.log("Структура базы знаний:");
    
    const klinrek = window.knowledgeBase["КлинРек II ур"];
    if (!klinrek) {
        console.log("❌ Нет раздела 'КлинРек II ур'");
        return;
    }
    
    const diseases = klinrek["Заболевание"];
    if (!diseases) {
        console.log("❌ Нет раздела 'Заболевание'");
        return;
    }
    
    console.log("Доступные диагнозы:");
    for (const disease in diseases) {
        console.log(`- ${disease}`);
        
        if (disease === "Хронический вирусный гепатит C") {
            console.log("  Варианты течения:");
            const variants = diseases[disease]["Вариант течения (функциональный класс)"];
            for (const variant in variants) {
                console.log(`  * ${variant}`);
            }
        }
    }
    
    return "Проверка завершена";
};

// ============================================
// СИСТЕМА ОТСЛЕЖИВАНИЯ НЕДОСТАЮЩИХ ПОЛЕЙ (ПОЛНАЯ ВЕРСИЯ)
// ============================================

// Хранилище для недостающих полей
let missingFieldsTracker = {
    fields: [],
    lastAnalysisTime: null
};

// Функция проверки заполненности полей (универсальная)
function ultimateCheckIfPatientHasField(fieldName, patientData) {
    if (!patientData) return false;
    
    // Маппинг: как называются поля в UI -> как они хранятся в данных
    const fieldMapping = {
        "Цирроз печени": {
            searchKeys: ["Сопутствующий диагноз", "сопутствующий диагноз", "Цирроз"],
            expectedValue: "Цирроз печени"
        },
        "Генотип вируса": {
            searchKeys: ["Анализ крови на гепатит С с определением генотипа_Результат", "генотип", "Генотип"],
            checkValue: true
        },
        "Опыт противовирусной терапии (ПВТ)": {
            searchKeys: ["Опыт терапии_Опыт терапии_ПВТ (противовирусной терапии)", "Опыт терапии_ПВТ", "ПВТ"],
            checkValue: true
        },
        "Трансплантация печени": {
            searchKeys: ["Операции в прошлом", "трансплантация"],
            expectedValue: "трансплантация"
        },
        "Локализация перелома": {
            searchKeys: ["Локализация", "локализация"],
            checkValue: true
        },
        "Тип повреждения": {
            searchKeys: ["Тип повреждения", "тип повреждения"],
            checkValue: true
        },
        "Выраженность приступа": {
            searchKeys: ["Выраженность", "Приступ мигрени"],
            checkValue: true
        }
    };
    
    const mapping = fieldMapping[fieldName];
    if (!mapping) {
        // Если нет специального маппинга, ищем по ключу
        for (const [key, value] of Object.entries(patientData)) {
            if (key.toLowerCase().includes(fieldName.toLowerCase())) {
                if (value && value !== '' && value !== '-- Выберите значение --') {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Ищем по всем возможным ключам
    for (const searchKey of mapping.searchKeys) {
        const value = patientData[searchKey];
        if (value !== undefined && value !== null && value !== '') {
            let actualValue = value;
            if (Array.isArray(value)) {
                if (value.length === 0) continue;
                actualValue = value[0];
            }
            
            const valueStr = String(actualValue).toLowerCase().trim();
            
            // Если есть ожидаемое значение
            if (mapping.expectedValue) {
                const expectedLower = mapping.expectedValue.toLowerCase();
                if (valueStr.includes(expectedLower) || expectedLower.includes(valueStr)) {
                    return true;
                }
                if (valueStr && valueStr !== '' && valueStr !== 'не указан') {
                    return true;
                }
            }
            // Если нет ожидаемого значения, просто проверяем что не пусто
            else if (valueStr && valueStr !== '' && valueStr !== '-- выберите значение --') {
                return true;
            }
        }
    }
    
    return false;
}

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ НЕДОСТАЮЩИХ ПОЛЕЙ
// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ НЕДОСТАЮЩИХ ПОЛЕЙ (ИСПРАВЛЕННАЯ)
function extractMissingFieldsFromAnalysis(explanationText, patientData) {
    const missingFields = [];
    
    if (!explanationText || !window.knowledgeBase) return missingFields;
    
    // 1. Определяем диагноз
    let diagnosis = "";
    const diagnosisMatch = explanationText.match(/🎯 \*\*ДИАГНОЗ:\*\* (.+?)(?:\n|$)/);
    if (diagnosisMatch) {
        diagnosis = diagnosisMatch[1].trim();
    }
    
    if (!diagnosis) return missingFields;
    
    // ===== СПЕЦИАЛЬНЫЕ СЛУЧАИ: для некоторых диагнозов не показываем предупреждения =====
    
    // Для переломов лодыжек - если выбран вариант с реабилитацией
    if (diagnosis === "Переломы лодыжек") {
        if (explanationText.includes("домашняя реабилитация")) {
            return [];
        }
    }
    
    // Для стабильной ИБС - если выбран вариант стенокардии
    if (diagnosis === "Стабильная ИБС") {
        if (explanationText.includes("стабильная стенокардия")) {
            return [];
        }
    }
    
    // Для гепатита C - если выбран специфичный вариант под генотип
    if (diagnosis === "Хронический вирусный гепатит C") {
        if (explanationText.includes("генотип") && explanationText.includes("Выбранный вариант")) {
            return [];
        }
    }
    
    // Для шизофрении - если выбран любой вариант
    if (diagnosis === "Шизофрения") {
        if (explanationText.includes("Выбранный вариант")) {
            return [];
        }
    }
    
    console.log("🔍 Диагноз из текста:", diagnosis);
    
    // 2. Ищем все критерии в базе знаний для этого диагноза
    const klinrek = window.knowledgeBase["КлинРек II ур"];
    if (!klinrek) return missingFields;
    
    const diseases = klinrek["Заболевание"];
    if (!diseases || !diseases[diagnosis]) return missingFields;
    
    const diseaseSection = diseases[diagnosis];
    
    // 3. Собираем все возможные поля, которые могут влиять на выбор рекомендации
    const allCriteria = {};
    
    function extractCriteriaFromNode(node, path = "") {
        if (!node || typeof node !== 'object') return;
        
        if (node["Категория пациента"]) {
            const category = node["Категория пациента"];
            
            if (category["Наблюдение"]) {
                const observations = category["Наблюдение"];
                if (Array.isArray(observations)) {
                    observations.forEach(obs => {
                        for (const obsName in obs) {
                            if (!allCriteria[obsName]) {
                                allCriteria[obsName] = {
                                    description: `Укажите ${obsName.toLowerCase()}`,
                                    searchKeys: [obsName, obsName.toLowerCase()]
                                };
                            }
                        }
                    });
                } else if (typeof observations === 'object') {
                    for (const obsName in observations) {
                        if (!allCriteria[obsName]) {
                            allCriteria[obsName] = {
                                description: `Укажите ${obsName.toLowerCase()}`,
                                searchKeys: [obsName, obsName.toLowerCase()]
                            };
                        }
                    }
                }
            }
            
            if (category["Фактор"]) {
                const factors = category["Фактор"];
                for (const factorName in factors) {
                    if (!allCriteria[factorName]) {
                        let description = `Укажите ${factorName.toLowerCase()}`;
                        if (factorName === "Опыт терапии") {
                            description = "Укажите опыт терапии (был/не был, эффективность)";
                        }
                        if (factorName.includes("Чувствительность")) {
                            description = "Укажите чувствительность (имеется/отсутствует)";
                        }
                        allCriteria[factorName] = {
                            description: description,
                            searchKeys: [factorName, factorName.toLowerCase()]
                        };
                    }
                }
            }
        }
        
        for (const key in node) {
            if (typeof node[key] === 'object' && node[key] !== null) {
                extractCriteriaFromNode(node[key], path + "." + key);
            }
        }
    }
    
    const nodeTypes = ["Стадия (Фаза)", "Вариант течения (функциональный класс)", "Функциональный класс заболевания"];
    for (const nodeType of nodeTypes) {
        if (diseaseSection[nodeType]) {
            extractCriteriaFromNode(diseaseSection[nodeType]);
        }
    }
    
    // 4. Проверяем только критические поля
    const criticalFields = ["Чувствительность к развитию ЭПС", "Психотическая симптоматика", "Опыт терапии"];
    
    for (const [criteriaName, criteriaInfo] of Object.entries(allCriteria)) {
        const isCritical = criticalFields.some(cf => 
            criteriaName.includes(cf) || cf.includes(criteriaName)
        );
        
        if (!isCritical) continue;
        
        const hasValue = checkIfFieldHasValueUniversal(criteriaName, criteriaInfo.searchKeys, patientData);
        
        if (!hasValue) {
            const alreadyAdded = missingFields.some(f => f.displayName === criteriaName);
            if (!alreadyAdded) {
                missingFields.push({
                    displayName: criteriaName,
                    description: criteriaInfo.description,
                    isMissing: true,
                    searchKeys: criteriaInfo.searchKeys
                });
            }
        }
    }
    
    return missingFields;
}

// УНИВЕРСАЛЬНАЯ ПРОВЕРКА ЗАПОЛНЕННОСТИ ПОЛЯ
function checkIfFieldHasValueUniversal(fieldName, searchKeys, patientData) {
    if (!patientData) return false;
    
    // Нормализуем имя поля для поиска
    const normalizedFieldName = fieldName.toLowerCase().replace(/[\s_]/g, '');
    
    // 1. Прямой поиск по ключу
    for (const [key, value] of Object.entries(patientData)) {
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) continue;
        
        const keyLower = key.toLowerCase();
        
        // Проверяем точное совпадение
        if (keyLower === normalizedFieldName) {
            return true;
        }
        
        // Проверяем по searchKeys
        for (const searchKey of searchKeys) {
            if (keyLower.includes(searchKey.toLowerCase())) {
                return true;
            }
        }
    }
    
    // 2. Поиск по значениям (например, если поле в иерархических данных)
    for (const [key, value] of Object.entries(patientData)) {
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) continue;
        
        const keyLower = key.toLowerCase();
        
        // Проверяем, содержит ли ключ что-то из searchKeys
        for (const searchKey of searchKeys) {
            if (keyLower.includes(searchKey.toLowerCase())) {
                // Дополнительно проверяем, что значение не пустое
                let actualValue = value;
                if (Array.isArray(value)) {
                    actualValue = value[0];
                }
                if (actualValue && actualValue !== '' && actualValue !== '-- Выберите значение --') {
                    return true;
                }
            }
        }
    }
    
    // 3. Специальные случаи для известных полей
    const specialCases = {
        "чувствительность": ["чувствительность", "эпс", "эпc"],
        "опыт терапии": ["опыт терапии", "антипсихотиком", "n05a"],
        "психотическая": ["психотическая", "симптоматика"],
        "возраст": ["возраст"],
        "генотип": ["генотип", "анализ крови"],
        "цирроз": ["цирроз", "цп"]
    };
    
    for (const [specialField, keywords] of Object.entries(specialCases)) {
        if (normalizedFieldName.includes(specialField)) {
            for (const [key, value] of Object.entries(patientData)) {
                const keyLower = key.toLowerCase();
                for (const keyword of keywords) {
                    if (keyLower.includes(keyword)) {
                        let actualValue = value;
                        if (Array.isArray(value)) {
                            actualValue = value[0];
                        }
                        if (actualValue && actualValue !== '' && actualValue !== '-- Выберите значение --') {
                            return true;
                        }
                    }
                }
            }
        }
    }
    
    return false;
}

// ДОБАВЛЕНИЕ СПЕЦИАЛЬНЫХ ПОЛЕЙ ДЛЯ КОНКРЕТНЫХ ДИАГНОЗОВ
function addSpecialFieldsForDiagnosis(diagnosis, patientData, missingFields) {
    const diagnosisLower = diagnosis.toLowerCase();
    
    // Для гепатита C
    if (diagnosisLower.includes("гепатит") || diagnosisLower.includes("hcv") || diagnosisLower.includes("хвгс")) {
        const specialFields = [
            { name: "Генотип вируса", desc: "Укажите результат анализа на генотип (1a, 1b, 2, 3)", keys: ["генотип", "анализ крови"] },
            { name: "Цирроз печени", desc: "Укажите, есть ли цирроз печени", keys: ["цирроз", "цп"] },
            { name: "Опыт ПВТ", desc: "Укажите опыт противовирусной терапии", keys: ["пвт", "противовирусной"] }
        ];
        
        for (const field of specialFields) {
            const hasValue = checkIfFieldHasValueUniversal(field.name, field.keys, patientData);
            if (!hasValue && !missingFields.some(f => f.displayName === field.name)) {
                missingFields.push({
                    displayName: field.name,
                    description: field.desc,
                    isMissing: true,
                    searchKeys: field.keys
                });
            }
        }
    }
    
    // Для шизофрении
    if (diagnosisLower.includes("шизофрения")) {
        const specialFields = [
            { name: "Психотическая симптоматика", desc: "Укажите характер симптоматики (острая/сохраняющаяся)", keys: ["психотическая", "симптоматика"] },
            { name: "Опыт терапии антипсихотиками", desc: "Укажите опыт терапии", keys: ["опыт терапии", "антипсихотиком"] },
            { name: "Чувствительность к ЭПС", desc: "Укажите чувствительность к ЭПС", keys: ["чувствительность", "эпс"] }
        ];
        
        for (const field of specialFields) {
            const hasValue = checkIfFieldHasValueUniversal(field.name, field.keys, patientData);
            if (!hasValue && !missingFields.some(f => f.displayName === field.name)) {
                missingFields.push({
                    displayName: field.name,
                    description: field.desc,
                    isMissing: true,
                    searchKeys: field.keys
                });
            }
        }
    }
    
    // Для переломов лодыжек
    if (diagnosisLower.includes("переломы лодыжек")) {
        const specialFields = [
            { name: "Локализация перелома", desc: "Укажите локализацию (медиальная/латеральная)", keys: ["локализация", "лодыжка"] },
            { name: "Тип повреждения", desc: "Укажите тип (со смещением/без смещения)", keys: ["тип повреждения", "смещение"] }
        ];
        
        for (const field of specialFields) {
            const hasValue = checkIfFieldHasValueUniversal(field.name, field.keys, patientData);
            if (!hasValue && !missingFields.some(f => f.displayName === field.name)) {
                missingFields.push({
                    displayName: field.name,
                    description: field.desc,
                    isMissing: true,
                    searchKeys: field.keys
                });
            }
        }
    }
}

// Функция для отображения панели с недостающими полями
function showMissingFieldsPanel(missingFields) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (!resultsDiv || !analysisResultsDiv) return;
    if (!missingFields || missingFields.length === 0) return;
    
    // Удаляем старую панель, если есть
    const oldPanel = document.getElementById('missingFieldsPanel');
    if (oldPanel) oldPanel.remove();
    
    // Создаем новую панель
    const panelHTML = `
        <div id="missingFieldsPanel" style="
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 15px 20px;
            margin: 0 0 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        ">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
                <h3 style="margin: 0; color: #e67e22;">Недостаточно данных для точного выбора варианта</h3>
            </div>
            <p style="margin: 0 0 12px 0; color: #666;">
                Для получения точной рекомендации заполните следующие поля:
            </p>
            <ul style="margin: 0 0 15px 0; padding-left: 20px;">
                ${missingFields.map(field => `
                    <li style="margin-bottom: 8px;">
                        <strong style="color: #e67e22;">${field.displayName}</strong>
                        <span style="color: #666;"> — ${field.description}</span>
                    </li>
                `).join('')}
            </ul>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="highlightMissingBtn" style="
                    background: #ff9800;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    🔍 Перейти к незаполненным полям
                </button>
                <button id="refreshAnalysisBtn" style="
                    background: #4caf50;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    🔄 Обновить анализ после заполнения
                </button>
            </div>
        </div>
    `;
    
    // Вставляем панель в начало
    analysisResultsDiv.insertAdjacentHTML('afterbegin', panelHTML);
    
    // Добавляем обработчики
    const highlightBtn = document.getElementById('highlightMissingBtn');
    if (highlightBtn) {
        highlightBtn.addEventListener('click', () => {
            highlightMissingFieldsByList(missingFields);
        });
    }
    
    const refreshBtn = document.getElementById('refreshAnalysisBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (window.analyzeData) window.analyzeData();
        });
    }
}

// Подсветка полей по списку
function highlightMissingFieldsByList(missingFields) {
    missingFields.forEach(field => {
        highlightFieldByName(field.displayName);
    });
}

// Подсветка конкретного поля по названию
function highlightFieldByName(fieldName) {
    const fieldMapping = {
        'Цирроз печени': { tab: 'Общие сведения', selectors: ['Сопутствующий диагноз', 'сопутствующий диагноз'] },
        'Генотип вируса': { tab: 'Сведения в динамике', selectors: ['Анализ крови на гепатит С с определением генотипа', 'генотип'] },
        'Опыт противовирусной терапии (ПВТ)': { tab: 'Сведения в динамике', selectors: ['Опыт терапии', 'ПВТ'] },
        'Трансплантация печени': { tab: 'Общие сведения', selectors: ['Операции в прошлом', 'трансплантация'] },
        'Локализация перелома': { tab: 'Расширенный клинический диагноз', selectors: ['Локализация', 'локализация'] },
        'Тип повреждения': { tab: 'Расширенный клинический диагноз', selectors: ['Тип повреждения', 'тип повреждения'] },
        'Выраженность приступа': { tab: 'Жалобы', selectors: ['Приступ мигрени', 'Выраженность'] }
    };
    
    const mapping = fieldMapping[fieldName];
    if (!mapping) return;
    
    // Переключаемся на вкладку
    switchToTab(mapping.tab);
    
    // Ищем элемент
    setTimeout(() => {
        const activeContent = document.querySelector('.tab-contents');
        if (!activeContent) return;
        
        for (const selector of mapping.selectors) {
            let element = null;
            
            // Ищем по name
            element = activeContent.querySelector(`[name*="${selector}" i]`);
            
            // Ищем по тексту метки
            if (!element) {
                const labels = activeContent.querySelectorAll('label');
                for (const label of labels) {
                    if (label.textContent.toLowerCase().includes(selector.toLowerCase())) {
                        const parent = label.parentElement;
                        element = parent.querySelector('input, select, textarea');
                        break;
                    }
                }
            }
            
            if (element) {
                const originalBorder = element.style.border;
                const originalBg = element.style.backgroundColor;
                
                element.style.transition = 'all 0.3s ease';
                element.style.border = '2px solid #ff9800';
                element.style.backgroundColor = '#fff3e0';
                element.style.boxShadow = '0 0 5px rgba(255, 152, 0, 0.5)';
                
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                setTimeout(() => {
                    element.style.border = originalBorder;
                    element.style.backgroundColor = originalBg;
                    element.style.boxShadow = '';
                }, 3000);
                
                break;
            }
        }
    }, 200);
}

// Переключение на вкладку
function switchToTab(tabName) {
    const headers = document.querySelectorAll('.tab-header');
    for (const header of headers) {
        if (header.innerText.trim() === tabName) {
            header.click();
            break;
        }
    }
}

// Сохраняем оригинальную функцию
const originalShowAnalysisResults = window.showAnalysisResults || function(explanation, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (analysisResultsDiv) {
        analysisResultsDiv.innerHTML = explanation.replace(/\n/g, '<br>');
        if (resultsDiv) resultsDiv.style.display = 'block';
    }
};

// Переопределяем функцию отображения результатов
window.showAnalysisResults = function(explanation, patientData) {
    const missingFields = extractMissingFieldsFromAnalysis(explanation, patientData);
    
    // Показываем результаты
    originalShowAnalysisResults(explanation, patientData);
    
    // Показываем панель с недостающими полями
    if (missingFields && missingFields.length > 0) {
        setTimeout(() => {
            showMissingFieldsPanel(missingFields);
        }, 100);
    }
};

// Экспортируем функции для использования в других файлах
window.ultimateCheckIfPatientHasField = ultimateCheckIfPatientHasField;
window.extractMissingFieldsFromAnalysis = extractMissingFieldsFromAnalysis;
window.showMissingFieldsPanel = showMissingFieldsPanel;
window.highlightMissingFieldsByList = highlightMissingFieldsByList;
window.highlightFieldByName = highlightFieldByName;
window.switchToTab = switchToTab;

console.log("✅ Система отслеживания недостающих полей загружена!");

window.analyzeData = analyzeData;