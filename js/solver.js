// УНИВЕРСАЛЬНЫЙ РЕШАТЕЛЬ ДЛЯ ЛЮБЫХ КЛИНИЧЕСКИХ РЕКОМЕНДАЦИЙ
console.log("✅ Solver.js загружен, версия: " + new Date().toISOString());

function analyzeData() {
    if (!window.knowledgeBase) {
        window.showNotification?.("Сначала загрузите базу знаний!", "error");
        return;
    }

    const patient_data = window.extract_patient_data?.() || {};
    
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

// НОВАЯ ФУНКЦИЯ: Проверка смещения перелома
function checkFractureDisplacement(variantName, patientData, diagnosis) {
    // Проверяем только для диагнозов с переломами
    const fractureDiagnoses = [
        "Переломы дистального отдела костей предплечья",
        "Переломы лодыжек",
        "Переломы проксимального отдела бедренной кости",
        "Переломы надколенника"
    ];
    
    if (!fractureDiagnoses.includes(diagnosis)) return null;
    
    const variantLower = variantName.toLowerCase();
    
    // Ищем поле со смещением в данных пациента
    let displacement = null;
    let displacementField = null;
    
    // Список возможных имен полей для смещения
    const displacementFields = [
        "Перелом дистального отдела костей предплечья_Наличие смещения",
        "Перелом лодыжки_Наличие смещения",
        "Наличие смещения",
        "смещение"
    ];
    
    for (const field of displacementFields) {
        if (patientData[field] !== undefined && patientData[field] !== null && patientData[field] !== '') {
            displacement = String(patientData[field]).toLowerCase();
            displacementField = field;
            break;
        }
    }
    
    // Если поле не найдено, считаем что смещения нет (консервативное лечение)
    if (!displacement) {
        console.log(`⚠️ Поле смещения не найдено, считаем что смещения нет`);
        // Если вариант требует смещения, пропускаем его
        if (variantLower.includes("смещением") && !variantLower.includes("без смещения")) {
            return false;
        }
        return null;
    }
    
    console.log(`🔍 Проверка смещения: поле="${displacementField}", значение="${displacement}", вариант="${variantName}"`);
    
    // Нормализация значений
    const hasDisplacement = displacement.includes("смещением") || 
                           displacement.includes("с тенденцией") ||
                           displacement === "со смещением" ||
                           displacement === "со смещением отломков" ||
                           displacement === "с тенденцией к смещению";
    
    const noDisplacement = displacement.includes("без смещения") || 
                          displacement === "без смещения отломков" ||
                          displacement === "нет смещения";
    
    // Проверяем, требует ли вариант смещения
    const requiresDisplacement = variantLower.includes("со смещением") || 
                                 variantLower.includes("смещением отломков") ||
                                 (variantLower.includes("неуспешной") && variantLower.includes("репозиции"));
    
    const requiresNoDisplacement = variantLower.includes("без смещения") || 
                                   variantLower.includes("неполных переломах");
    
    // Логика выбора
    if (requiresDisplacement && hasDisplacement) {
        console.log(`✅ Совпадение: есть смещение, вариант требует смещения`);
        return true;
    }
    
    if (requiresNoDisplacement && noDisplacement) {
        console.log(`✅ Совпадение: нет смещения, вариант не требует смещения`);
        return true;
    }
    
    if (requiresDisplacement && !hasDisplacement) {
        console.log(`❌ Несовпадение: нет смещения, но вариант требует смещения`);
        return false;
    }
    
    if (requiresNoDisplacement && hasDisplacement) {
        console.log(`❌ Несовпадение: есть смещение, но вариант не требует смещения`);
        return false;
    }
    
    return null;
}

// НОВАЯ ФУНКЦИЯ: Проверка успешности репозиции
function checkRepositionSuccess(variantName, patientData) {
    const variantLower = variantName.toLowerCase();
    
    // Проверяем только варианты, связанные с репозицией
    if (!variantLower.includes("репозиции") && !variantLower.includes("неуспешной")) {
        return null;
    }
    
    const viewField = patientData["Вид"];
    const resultField = patientData["Результат"];
    
    console.log(`🔍 Проверка репозиции: Вид="${viewField}", Результат="${resultField}"`);
    
    const isUnsuccessful = viewField === "закрытая ручная репозиция" && resultField === "не успешно";
    
    if (variantLower.includes("неуспешной") && isUnsuccessful) {
        console.log(`✅ Репозиция неуспешна, вариант подходит`);
        return true;
    }
    
    if (variantLower.includes("неуспешной") && !isUnsuccessful) {
        console.log(`❌ Репозиция успешна, вариант не подходит`);
        return false;
    }
    
    return null;
}

function checkIfGenotypeExistsInForm() {
    if (!window.allTabsData) return false;
    for (const tabName in window.allTabsData) {
        const tabData = window.allTabsData[tabName];
        for (const fieldName in tabData.data) {
            const fieldNameLower = fieldName.toLowerCase();
            if (fieldNameLower.includes('генотип') || fieldNameLower.includes('genotype') || fieldNameLower.includes('анализ крови на гепатит')) {
                const value = tabData.data[fieldName];
                if (value && value !== '' && value !== 'не определен') return true;
            }
        }
        if (tabData.hierarchicalData) {
            for (const parentField in tabData.hierarchicalData) {
                if (parentField.toLowerCase().includes('анализ крови на гепатит')) {
                    const hepatitisData = tabData.hierarchicalData[parentField];
                    if (hepatitisData && hepatitisData['Результат'] && hepatitisData['Результат'] !== '' && hepatitisData['Результат'] !== 'не определен') return true;
                }
            }
        }
    }
    return false;
}

function findGenotypeInPatientData(patientData) {
    if (!patientData) return null;
    const genotypeFields = ['Анализ крови на гепатит С с определением генотипа_Результат', 'Генотип', 'Генотип вируса', 'Генотип HCV', 'Генотип гепатита С'];
    for (const field of genotypeFields) {
        if (patientData[field] && patientData[field] !== '' && patientData[field] !== 'не определен' && patientData[field] !== null && patientData[field] !== undefined) {
            if (Array.isArray(patientData[field])) return patientData[field][0] || null;
            return String(patientData[field]);
        }
    }
    return null;
}

function generate_universal_explanation(patient_data, knowledge_base) {
    console.log("=== НАЧАЛО generate_universal_explanation ===");
    console.log("Данные пациента:", patient_data);
    
    if (!patient_data || Object.keys(patient_data).length === 0) return "❌ Данные пациента отсутствуют или имеют неверный формат.";
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
    const nodeTypes = [{ key: "Стадия (Фаза)", priority: 3 }, { key: "Вариант течения (функциональный класс)", priority: 2 }, { key: "Функциональный класс заболевания", priority: 1 }];
    for (const nodeTypeInfo of nodeTypes) {
        const nodeType = nodeTypeInfo.key;
        const priority = nodeTypeInfo.priority;
        const nodeData = diseaseSection[nodeType];
        if (!nodeData) continue;
        for (const [variantName, variantData] of Object.entries(nodeData)) {
            if (!variantData["Инструкция"]) continue;
            
            // СУЩЕСТВУЮЩИЕ ПРОВЕРКИ
            const genotypeSpecificMatch = checkGenotypeSpecificMatch(variantName, patientGenotype);
            const cirrhosisMatch = checkCirrhosisSpecificMatch(variantName, hasCirrhosis);
            const transplantMatch = checkTransplantSpecificMatch(variantName, hasTransplant);
            const pvtMatch = checkPVTSpecificMatch(variantName, hasPVTExperience);
            
            // НОВЫЕ ПРОВЕРКИ ДЛЯ ПЕРЕЛОМОВ
            const displacementMatch = checkFractureDisplacement(variantName, patient_data, patientDiagnosis);
            const repositionMatch = checkRepositionSuccess(variantName, patient_data);
            
            // Если любая проверка вернула false - пропускаем вариант
            if (genotypeSpecificMatch === false || cirrhosisMatch === false || 
                transplantMatch === false || pvtMatch === false ||
                displacementMatch === false || repositionMatch === false) {
                console.log(`❌ Вариант "${variantName}" отклонен`);
                continue;
            }
            
            let matchScore = 50;
            
            // Бонусы за совпадения
            if (genotypeSpecificMatch === true) matchScore += 30;
            if (cirrhosisMatch === true) matchScore += 20;
            if (transplantMatch === true) matchScore += 20;
            if (pvtMatch === true) matchScore += 15;
            if (displacementMatch === true) matchScore += 35;
            if (repositionMatch === true) matchScore += 40;
            
            matchScore += priority * 5;
            
            // Штрафы за несоответствия
            if (displacementMatch === false) matchScore -= 50;
            if (repositionMatch === false) matchScore -= 50;
            
            allCheckedVariants.push({ 
                variantName, nodeType, priority, instruction: variantData["Инструкция"], 
                matchScore: matchScore, 
                genotypeMatch: genotypeSpecificMatch, 
                cirrhosisMatch: cirrhosisMatch, 
                transplantMatch: transplantMatch, 
                pvtMatch: pvtMatch,
                displacementMatch: displacementMatch,
                repositionMatch: repositionMatch
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
    result.push(`👤 **${finalMatch.nodeType || "КАТЕГОРИЯ ПАЦИЕНТА"} (из базы знаний):**`);
    result.push(`**Выбранный вариант:** ${finalMatch.variantName}`);
    const matches = [];
    if (finalMatch.genotypeMatch === true && patientGenotype) matches.push(`✅ Генотип ${patientGenotype} соответствует`);
    if (finalMatch.cirrhosisMatch === true) matches.push(`✅ Состояние печени соответствует`);
    if (finalMatch.transplantMatch === true) matches.push(`✅ Статус трансплантации соответствует`);
    if (finalMatch.displacementMatch === true) matches.push(`✅ Характер смещения соответствует`);
    if (finalMatch.repositionMatch === true) matches.push(`✅ Репозиция неуспешна, показано оперативное лечение`);
    if (matches.length > 0) {
        result.push("**Соответствия:**");
        matches.forEach(m => result.push(`• ${m}`));
    }
    result.push("");
    if (otherVariants.length > 0) {
        result.push("📋 **ДРУГИЕ ПОДХОДЯЩИЕ ВАРИАНТЫ:**");
        otherVariants.slice(0, 3).forEach((variant, idx) => { result.push(`${idx + 1}. ${variant.variantName}`); });
        result.push("");
    }
    result.push("💊 **РЕКОМЕНДАЦИЯ ИЗ БАЗЫ ЗНАНИЙ:**");
    result.push(`**Вариант:** ${finalMatch.variantName}`);
    result.push("");
    const instruction = finalMatch.instruction;
    let hasSpecificRecommendations = false;
    let allTreatments = [];
    let allGoals = [];
    if (instruction) {
        for (const instKey in instruction) {
            const inst = instruction[instKey];
            const treatmentPlan = inst["План лечебных действий"];
            if (treatmentPlan) {
                const treatments = extractUniversalTreatments(treatmentPlan);
                if (treatments.length > 0) allTreatments.push(...treatments);
                const goals = extractUniversalGoals(treatmentPlan);
                if (goals.length > 0) allGoals.push(...goals);
            }
        }
    }
    if (allGoals.length > 0) {
        result.push("**Цели лечения:**");
        const uniqueGoals = [...new Set(allGoals)];
        uniqueGoals.forEach((g, idx) => { result.push(`${idx + 1}. ${g}`); });
        result.push("");
        hasSpecificRecommendations = true;
    }
    if (allTreatments.length > 0) {
        result.push("**План лечения:**");
        const uniqueTreatments = [...new Set(allTreatments)];
        uniqueTreatments.forEach((t, idx) => {
            const clean = t.replace(/\*\*/g, '').trim();
            result.push(`${idx + 1}. ${clean}`);
        });
        result.push("");
        hasSpecificRecommendations = true;
    }
    if (!hasSpecificRecommendations) {
        result.push("📋 **ОБЩИЕ РЕКОМЕНДАЦИИ:**");
        result.push("1. Выполнить назначенный план лечения");
        result.push("2. Соблюдать все врачебные рекомендации");
        result.push("3. Контролировать состояние в динамике");
        result.push("");
    }
    function extractTreatmentsForVariant(variantInstruction) {
        const treatmentsList = [];
        if (!variantInstruction) return treatmentsList;
        for (const instKey in variantInstruction) {
            const inst = variantInstruction[instKey];
            const treatmentPlan = inst["План лечебных действий"];
            if (treatmentPlan) {
                const extracted = extractUniversalTreatments(treatmentPlan);
                treatmentsList.push(...extracted);
            }
        }
        return treatmentsList;
    }
    window.lastStructuredData = {
        diagnosis: patientDiagnosis,
        patientData: patient_data,
        selectedVariant: { name: finalMatch.variantName, score: finalMatch.matchScore, nodeType: finalMatch.nodeType, matches: matches, treatments: extractTreatmentsForVariant(finalMatch.instruction) },
        otherVariants: otherVariants.map(v => ({ name: v.variantName, score: v.matchScore, nodeType: v.nodeType, treatments: extractTreatmentsForVariant(v.instruction) })),
        allVariants: allCheckedVariants.map(v => ({ name: v.variantName, score: v.matchScore, nodeType: v.nodeType, isSelected: v === finalMatch, treatments: extractTreatmentsForVariant(v.instruction) }))
    };
    return result.join("\n");
}

function findGenotypeInPatientDataAdvanced(patientData) {
    const genotypeFields = ['Анализ крови на гепатит С с определением генотипа_Результат', 'Генотип', 'Генотип вируса', 'Генотип HCV', 'Генотип гепатита С', 'Результат'];
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
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('цирроз') || keyLower.includes('цп')) {
            if (value === 'отсутствует' || value === 'нет' || value === false || value === '') return false;
            if (value === 'есть' || value === 'да' || value === true) return true;
        }
        if (typeof value === 'string' && (value.toLowerCase().includes('цирроз') || value.toLowerCase().includes('цп'))) {
            if (value.toLowerCase().includes('отсутствует') || value.toLowerCase().includes('нет')) return false;
            return true;
        }
    }
    return false;
}

function detectTransplant(patientData) {
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('трансплантац')) {
            if (value === 'не проводилась' || value === 'нет' || value === false || value === '') return false;
            if (value === 'проводилась' || value === 'да' || value === true) return true;
        }
        if (keyLower.includes('операции') || keyLower.includes('хирургическое')) {
            if (typeof value === 'string' && value.toLowerCase().includes('трансплантац')) return true;
            if (Array.isArray(value) && value.some(v => String(v).toLowerCase().includes('трансплантац'))) return true;
        }
    }
    return false;
}

function detectPVTExperience(patientData) {
    for (const [key, value] of Object.entries(patientData)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('пвт') || keyLower.includes('противовирусн') || (keyLower.includes('опыт') && keyLower.includes('терапии'))) {
            if (value === 'отсутствует' || value === 'нет' || value === false) return false;
            if (value === 'имеется' || value === 'да' || value === true) return true;
            if (Array.isArray(value)) {
                const hasPositive = value.some(v => { const str = String(v).toLowerCase(); return str.includes('был') || str.includes('проводилась') || str.includes('имеется'); });
                if (hasPositive) return true;
            }
        }
    }
    return false;
}

function checkGenotypeSpecificMatch(variantName, patientGenotype) {
    const variantLower = variantName.toLowerCase();
    if (!variantLower.includes('генотип') && !variantLower.includes('genotype') && !variantLower.includes('1a') && !variantLower.includes('1b') && !variantLower.includes('2') && !variantLower.includes('3')) return null;
    if (!patientGenotype) return false;
    if (variantLower.includes(patientGenotype.toLowerCase())) return true;
    if (patientGenotype === '1b' && variantLower.includes('1b')) return true;
    if (patientGenotype === '1a' && variantLower.includes('1a')) return true;
    if (patientGenotype === '1' && (variantLower.includes('1a') || variantLower.includes('1b'))) return true;
    return false;
}

function checkCirrhosisSpecificMatch(variantName, hasCirrhosis) {
    const variantLower = variantName.toLowerCase();
    if (!variantLower.includes('цирроз') && !variantLower.includes('цп') && !variantLower.includes('без цп')) return null;
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
    if (!variantLower.includes('пвт') && !variantLower.includes('противовирусн') && !variantLower.includes('опыт')) return null;
    const requiresExperience = variantLower.includes('с опытом') || variantLower.includes('не ответивш');
    const requiresNoExperience = variantLower.includes('без опыта') || variantLower.includes('наивн');
    if (requiresExperience && hasPVTExperience) return true;
    if (requiresNoExperience && !hasPVTExperience) return true;
    return null;
}

function extractUniversalTreatments(treatmentPlan) {
    const treatments = [];
    if (!treatmentPlan || typeof treatmentPlan !== 'object') {
        console.log("❌ Нет плана лечения или неверный формат");
        return treatments;
    }
    console.log("🔍 УНИВЕРСАЛЬНЫЙ поиск лечения в:", Object.keys(treatmentPlan));
    function searchInObject(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, value] of Object.entries(obj)) {
            const treatmentMethods = ['консервативное', 'хирургическое', 'медикаментозное', 'иное', 'метод реабилитации'];
            if (treatmentMethods.includes(key.toLowerCase())) {
                let treatmentText = '';
                if (typeof value === 'string') treatmentText = value;
                else if (value && typeof value === 'object') {
                    if (value['уточнение'] && Array.isArray(value['уточнение'])) treatmentText = value['уточнение'].join(', ');
                    else if (value['методика']) treatmentText = key + ': ' + Object.keys(value['методика']).join(', ');
                    else if (value['режим']) treatmentText = key + ': ' + value['режим'];
                    else {
                        const strings = extractAllStrings(value);
                        if (strings.length > 0) treatmentText = key + ': ' + strings.join(', ');
                        else treatmentText = key;
                    }
                }
                if (treatmentText) treatments.push(`**${key}:** ${treatmentText}`);
                else treatments.push(`**${key}**`);
            }
            if (key === 'уточнение' && Array.isArray(value)) treatments.push(`**Уточнение:** ${value.join('; ')}`);
            if (key === 'применение' || key === 'выполнение' || key === 'наложение') {
                if (typeof value === 'string') treatments.push(`**Действие:** ${value}`);
                else if (value && typeof value === 'object') {
                    const strings = extractAllStrings(value);
                    if (strings.length > 0) treatments.push(`**Действие:** ${strings.join(', ')}`);
                }
            }
            if (key === 'Совет' && Array.isArray(value)) treatments.push(`**Рекомендация:** ${value.join('; ')}`);
            if (typeof value === 'object' && value !== null) searchInObject(value, path + key + '.');
        }
    }
    function extractAllStrings(obj, depth = 0) {
        const strings = [];
        if (!obj || typeof obj !== 'object' || depth > 3) return strings;
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' && value.trim().length > 0 && value !== '...') strings.push(value);
            else if (Array.isArray(value)) value.forEach(item => { if (typeof item === 'string' && item.trim().length > 0) strings.push(item); });
            else if (typeof value === 'object' && value !== null) strings.push(...extractAllStrings(value, depth + 1));
        }
        return strings;
    }
    searchInObject(treatmentPlan);
    if (treatmentPlan["вариант лечения"]) {
        const variants = treatmentPlan["вариант лечения"];
        for (const [variantKey, variant] of Object.entries(variants)) {
            if (variant && typeof variant === 'object') {
                const methodKeys = ['консервативное', 'хирургическое', 'медикаментозное', 'иное', 'метод реабилитации'];
                for (const methodKey of methodKeys) {
                    if (variant[methodKey]) {
                        const methodData = variant[methodKey];
                        let methodText = '';
                        if (typeof methodData === 'string') methodText = methodData;
                        else if (methodData && typeof methodData === 'object') {
                            if (methodData['уточнение'] && Array.isArray(methodData['уточнение'])) methodText = methodData['уточнение'].join(', ');
                            else {
                                const strings = extractAllStrings(methodData);
                                if (strings.length > 0) methodText = strings.join(', ');
                            }
                        }
                        if (methodText) treatments.push(`**${methodKey}:** ${methodText}`);
                        else treatments.push(`**${methodKey}**`);
                    }
                }
            }
        }
    }
    const uniqueTreatments = [];
    const seen = new Set();
    for (const treatment of treatments) {
        const normalized = treatment.toLowerCase().replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
        if (!seen.has(normalized) && normalized.length > 3) {
            seen.add(normalized);
            uniqueTreatments.push(treatment);
        }
    }
    console.log("📋 Извлеченные лечения:", uniqueTreatments);
    return uniqueTreatments;
}

function extractUniversalGoals(treatmentPlan) {
    const goals = [];
    const seen = new Set();
    if (!treatmentPlan) return goals;
    function extractFromObject(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 5) return;
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'Цель' && typeof value === 'object') extractGoalsFromGoalObject(value, goals, seen);
            if (typeof value === 'object' && value !== null) extractFromObject(value, depth + 1);
        }
    }
    function extractGoalsFromGoalObject(goalObj, goalsList, seenSet) {
        if (!goalObj || typeof goalObj !== 'object') return;
        for (const [action, actionData] of Object.entries(goalObj)) {
            if (typeof actionData === 'object') {
                for (const [subAction, subData] of Object.entries(actionData)) {
                    let goalText = `${action} ${subAction}`;
                    if (typeof subData === 'string') goalText += ` ${subData}`;
                    else if (subData && typeof subData === 'object') {
                        if (subData['Наблюдение']) {
                            const obsNames = Object.keys(subData['Наблюдение']);
                            if (obsNames.length > 0) goalText += ` ${obsNames.join(', ')}`;
                        }
                        if (subData['для'] && Array.isArray(subData['для'])) goalText += ` для ${subData['для'].join(', ')}`;
                    }
                    const normalized = goalText.toLowerCase().replace(/\s+/g, ' ');
                    if (!seenSet.has(normalized) && goalText.length > 10) { seenSet.add(normalized); goalsList.push(goalText); }
                }
            } else if (typeof actionData === 'string') {
                const goalText = `${action} ${actionData}`;
                const normalized = goalText.toLowerCase().replace(/\s+/g, ' ');
                if (!seenSet.has(normalized) && goalText.length > 10) { seenSet.add(normalized); goalsList.push(goalText); }
            }
        }
    }
    extractFromObject(treatmentPlan);
    if (goals.length === 0 && treatmentPlan["вариант лечения"]) {
        for (const variant of Object.values(treatmentPlan["вариант лечения"])) {
            if (variant && variant["Цель"]) extractGoalsFromGoalObject(variant["Цель"], goals, seen);
        }
    }
    console.log("📋 Извлеченные цели:", goals);
    return goals;
}

function extractSpecificRecommendations(instruction) {
    const recommendations = [];
    const seen = new Set();
    if (!instruction || typeof instruction !== 'object') return recommendations;
    function extractFromObject(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 4) return;
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'Совет' && Array.isArray(value)) {
                value.forEach(item => { if (typeof item === 'string' && item.trim()) { const normalized = item.toLowerCase().trim(); if (!seen.has(normalized)) { seen.add(normalized); recommendations.push(item); } } });
            }
            if (key === 'уточнение' && Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'string' && item.trim()) {
                        const lowerItem = item.toLowerCase();
                        if (lowerItem.includes('рекоменд') || lowerItem.includes('следует') || lowerItem.includes('необходимо') || lowerItem.includes('целесообразно') || lowerItem.includes('показано')) {
                            const normalized = item.toLowerCase().trim();
                            if (!seen.has(normalized)) { seen.add(normalized); recommendations.push(item); }
                        }
                    }
                });
            }
            if (key === 'описание' && Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'string' && item.trim()) {
                        const lowerItem = item.toLowerCase();
                        if (lowerItem.includes('рекоменд') || lowerItem.includes('следует') || lowerItem.includes('необходимо')) {
                            const normalized = item.toLowerCase().trim();
                            if (!seen.has(normalized)) { seen.add(normalized); recommendations.push(item); }
                        }
                    }
                });
            }
            if (typeof value === 'object' && value !== null) extractFromObject(value, depth + 1);
        }
    }
    extractFromObject(instruction);
    console.log("📋 Извлеченные рекомендации:", recommendations);
    return recommendations;
}

function findPatientValue(parentName, charName, patientData) {
    console.log(`🔍 Ищем значение для parent="${parentName}", char="${charName}"`);
    const directKey = `${parentName}_${charName}`;
    if (patientData[directKey] !== undefined && patientData[directKey] !== null && patientData[directKey] !== '') {
        console.log(`✅ Найдено прямое совпадение: ${directKey} =`, patientData[directKey]);
        return patientData[directKey];
    }
    const searchTerms = [];
    const parentWords = parentName.toLowerCase().split(/[\s_]+/);
    const charWords = charName.toLowerCase().split(/[\s_]+/);
    searchTerms.push(...parentWords, ...charWords);
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
    const specialMappings = { "Чувствительность к развитию ЭПС": ["чувствительность", "эпс", "эпc", "чувствительность к развитию эпс"], "Чувствительность к развитию ЭПC": ["чувствительность", "эпс", "эпc", "чувствительность к развитию эпс"], "антипсихотиком (АТХ: N05A)": ["антипсихотиком", "n05a", "опыт терапии", "антипсихотик"], "Опыт терапии": ["опыт терапии", "антипсихотиком", "n05a"], "Психотическая симптоматика": ["психотическая", "симптоматика"], "АПП": ["апп", "антипсихотик"] };
    const combinedKey = `${parentName} ${charName}`.toLowerCase();
    for (const [field, keywords] of Object.entries(specialMappings)) {
        if (combinedKey.includes(field.toLowerCase()) || field.toLowerCase().includes(combinedKey) || parentName.toLowerCase().includes(field.toLowerCase()) || charName.toLowerCase().includes(field.toLowerCase())) {
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
    for (const [key, value] of Object.entries(patientData)) {
        if (!value || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const keyLower = key.toLowerCase();
        if (keyLower.includes(parentName.toLowerCase()) || parentName.toLowerCase().includes(keyLower) || keyLower.includes(charName.toLowerCase()) || charName.toLowerCase().includes(keyLower)) {
            console.log(`✅ Найдено по частичному совпадению: ${key} =`, value);
            return Array.isArray(value) ? value[0] : value;
        }
    }
    console.log(`❌ Не найдено значение для ${parentName} ${charName}`);
    return null;
}

function findPatientValueSimple(fieldName, patientData) {
    if (Array.isArray(patientData)) patientData = patientData[0] || {};
    if (!fieldName) return null;
    console.log(`🔍 findPatientValueSimple: ищем "${fieldName}"`);
    if (patientData[fieldName] !== undefined && patientData[fieldName] !== null && patientData[fieldName] !== '') {
        const value = patientData[fieldName];
        console.log(`✅ Прямое совпадение: ${fieldName} =`, value);
        return Array.isArray(value) ? value[0] : value;
    }
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
    const specialCases = { "Чувствительность к развитию ЭПС": ["чувствительность", "эпс", "эпc"], "Чувствительность к развитию ЭПC": ["чувствительность", "эпс", "эпc"], "антипсихотиком (АТХ: N05A)": ["антипсихотиком", "n05a", "опыт терапии"], "Опыт терапии": ["опыт терапии", "антипсихотиком"], "ПВТ": ["пвт", "противовирусной терапии"], "Психотическая симптоматика": ["психотическая", "симптоматика"], "АПП": ["апп", "антипсихотик"] };
    for (const [specialField, keywords] of Object.entries(specialCases)) {
        if (fieldName.toLowerCase().includes(specialField.toLowerCase()) || specialField.toLowerCase().includes(fieldName.toLowerCase())) {
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

function checkValueWithSynonyms(parentName, charName, patientValue, allowedValues, result) {
    const fieldName = `${parentName} ${charName}`;
    if (!patientValue) {
        if (result) { result.missing.push(`${fieldName}: не указано`); result.matches = false; }
        return;
    }
    let normalizedPatientValue = String(patientValue).toLowerCase().trim();
    if ((parentName.toLowerCase().includes("чувствительность") || charName.toLowerCase().includes("чувствительность")) && (normalizedPatientValue === "имеется" || normalizedPatientValue === "есть" || normalizedPatientValue === "да")) {
        normalizedPatientValue = "высокая";
        console.log(`🔄 Нормализовано в checkValueWithSynonyms: "${patientValue}" -> "высокая"`);
    }
    console.log(`🔍 Проверка ${fieldName}: значение="${normalizedPatientValue}", допустимые=${allowedValues}`);
    const synonyms = { "чувствительность": { "высокая": ["высокая", "имеется", "есть", "да", "повышена", "высокая чувствительность", "чувствительность высокая"], "отсутствует": ["отсутствует", "нет", "низкая", "не имеется", "отсутствие", "нет чувствительности"] }, "эффективность": { "недостаточная эффективность": ["недостаточная эффективность", "неэффективность", "не эффективно", "нет эффекта", "недостаточная", "эффект отсутствует"], "хорошая эффективность": ["хорошая эффективность", "эффективно", "есть эффект", "положительный эффект"] }, "психотическая симптоматика": { "острая": ["острая", "острый", "остро", "острая симптоматика"], "сохраняющаяся": ["сохраняющаяся", "сохраняется", "персистирующая", "стойкая"], "резистентная к терапии": ["резистентная", "резистентна", "терапия не помогает", "устойчивая"] } };
    let fieldType = "общее";
    const combinedName = `${parentName} ${charName}`.toLowerCase();
    if (combinedName.includes("чувствительность") || combinedName.includes("эпс") || combinedName.includes("эпc")) fieldType = "чувствительность";
    if (combinedName.includes("эффективность") || combinedName.includes("опыт терапии") || combinedName.includes("антипсихотиком")) fieldType = "эффективность";
    if (combinedName.includes("психотическая") || combinedName.includes("симптоматика")) fieldType = "психотическая симптоматика";
    for (const allowed of allowedValues) {
        const allowedLower = String(allowed).toLowerCase().trim();
        if (allowedLower === normalizedPatientValue) { if (result) result.details.push(`✅ ${fieldName}: ${patientValue} соответствует`); return; }
    }
    if (fieldType !== "общее" && synonyms[fieldType]) {
        for (const [key, synList] of Object.entries(synonyms[fieldType])) {
            const allowedMatch = allowedValues.some(allowed => { const allowedLower = String(allowed).toLowerCase().trim(); return allowedLower.includes(key) || key.includes(allowedLower); });
            if (allowedMatch) {
                if (synList.some(syn => normalizedPatientValue.includes(syn) || syn.includes(normalizedPatientValue))) { if (result) result.details.push(`✅ ${fieldName}: ${patientValue} соответствует (синоним для ${key})`); return; }
            }
        }
    }
    for (const allowed of allowedValues) {
        const allowedLower = String(allowed).toLowerCase().trim();
        if (allowedLower.includes(normalizedPatientValue) || normalizedPatientValue.includes(allowedLower)) { if (result) result.details.push(`⚠️ ${fieldName}: ${patientValue} частично соответствует (требуется: ${allowed})`); return; }
    }
    if (result) { result.matches = false; result.missing.push(`${fieldName}: "${patientValue}" не соответствует (требуется: ${allowedValues.join(", ")})`); }
}

function deepSearchInObject(obj, context, patientData, result) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
        if (key === "Качественное значение") checkQualitativeValue(context, value, patientData, result);
        else if (key === "Числовое значение") checkNumericValue(context, value, patientData, result);
        else if (key === "Характеристика") checkCharacteristics(context, value, patientData, result);
        else if (typeof value === 'object') deepSearchInObject(value, context + " " + key, patientData, result);
    }
}

function checkQualitativeValue(fieldName, qualValue, patientData, result) {
    let allowedValues = [];
    if (Array.isArray(qualValue)) allowedValues = qualValue;
    else if (typeof qualValue === 'object') allowedValues = Object.keys(qualValue);
    else allowedValues = [String(qualValue)];
    const patientValue = findPatientValueSimple(fieldName, patientData);
    console.log(`🔍 checkQualitativeValue: field="${fieldName}", patientValue="${patientValue}", allowed=${allowedValues}`);
    if (!patientValue) {
        if (result) { result.missing.push(`${fieldName}: не указано в данных пациента`); result.matches = false; }
        return;
    }
    let normalizedPatientValue = String(patientValue).toLowerCase().trim();
    if (fieldName.toLowerCase().includes("чувствительность") && (normalizedPatientValue === "имеется" || normalizedPatientValue === "есть" || normalizedPatientValue === "да")) {
        normalizedPatientValue = "высокая";
        console.log(`🔄 Нормализовано: "${patientValue}" -> "высокая"`);
    }
    const exactMatch = allowedValues.some(val => String(val).toLowerCase().trim() === normalizedPatientValue);
    if (exactMatch) { if (result) result.details.push(`✅ ${fieldName}: ${patientValue} соответствует`); return; }
    const partialMatch = allowedValues.some(val => { const valNorm = String(val).toLowerCase().trim(); return valNorm.includes(normalizedPatientValue) || normalizedPatientValue.includes(valNorm); });
    if (partialMatch) { if (result) result.details.push(`⚠️ ${fieldName}: ${patientValue} частично соответствует (требуется: ${allowedValues.join(", ")})`); if (result) result.matches = true; }
    else { if (result) { result.matches = false; result.missing.push(`${fieldName}: "${patientValue}" не соответствует (требуется: ${allowedValues.join(", ")})`); } }
}

function checkNumericValue(fieldName, numData, patientData, result) {
    const patientValue = findPatientValueSimple(fieldName, patientData);
    if (!patientValue) {
        if (result) { result.missing.push(`${fieldName}: не указано`); result.matches = false; }
        return;
    }
    const patientNum = Number(patientValue);
    if (isNaN(patientNum)) {
        if (result) { result.missing.push(`${fieldName}: значение "${patientValue}" не является числом`); result.matches = false; }
        return;
    }
    const min = numData["нижняя граница"];
    const max = numData["верхняя граница"];
    if (min !== undefined && max !== undefined) {
        if (patientNum >= min && patientNum <= max) { if (result) result.details.push(`✅ ${fieldName}: ${patientNum} в диапазоне ${min}-${max}`); }
        else { if (result) { result.matches = false; result.missing.push(`${fieldName}: ${patientNum} вне диапазона ${min}-${max}`); } }
    } else if (min !== undefined) {
        if (patientNum >= min) { if (result) result.details.push(`✅ ${fieldName}: ${patientNum} >= ${min}`); }
        else { if (result) { result.matches = false; result.missing.push(`${fieldName}: ${patientNum} < ${min}`); } }
    } else if (max !== undefined) {
        if (patientNum <= max) { if (result) result.details.push(`✅ ${fieldName}: ${patientNum} <= ${max}`); }
        else { if (result) { result.matches = false; result.missing.push(`${fieldName}: ${patientNum} > ${max}`); } }
    } else { if (result) result.details.push(`✅ ${fieldName}: ${patientNum}`); }
}

function checkCharacteristics(parentName, characteristics, patientData, result) {
    if (!characteristics) return;
    console.log(`🔍 Проверка характеристик для ${parentName}:`, JSON.stringify(characteristics, null, 2));
    let normalizedParentName = parentName;
    if (parentName === "Опыт терапии") normalizedParentName = "Опыт терапии";
    if (parentName === "антипсихотиком (АТХ: N05A)") normalizedParentName = "антипсихотиком (АТХ: N05A)";
    const charArray = Array.isArray(characteristics) ? characteristics : [characteristics];
    charArray.forEach(char => {
        for (const [charName, charValue] of Object.entries(char)) {
            console.log(`🔍 Характеристика: "${charName}" =`, JSON.stringify(charValue, null, 2));
            let patientValue = null;
            if (normalizedParentName === "антипсихотиком (АТХ: N05A)" || charName === "антипсихотиком (АТХ: N05A)") {
                const searchKeywords = ["антипсихотиком", "n05a", "опыт терапии", "антипсихотик"];
                for (const [key, value] of Object.entries(patientData)) {
                    if (!value || value === '' || (Array.isArray(value) && value.length === 0)) continue;
                    const keyLower = key.toLowerCase();
                    for (const keyword of searchKeywords) {
                        if (keyLower.includes(keyword)) { patientValue = Array.isArray(value) ? value[0] : value; console.log(`✅ Найдено значение для антипсихотика в поле "${key}":`, patientValue); break; }
                    }
                    if (patientValue) break;
                }
            } else { patientValue = findPatientValue(normalizedParentName, charName, patientData); }
            console.log(`📊 Значение пациента для ${normalizedParentName} ${charName}: "${patientValue}"`);
            if (!patientValue) {
                if (result) { result.missing.push(`${normalizedParentName} ${charName}: не указано в данных пациента`); result.matches = false; }
                continue;
            }
            if (charValue["Качественное значение"]) {
                const allowedValues = Object.keys(charValue["Качественное значение"]);
                console.log(`📋 Допустимые значения (Качественное значение):`, allowedValues);
                checkValueWithSynonyms(normalizedParentName, charName, patientValue, allowedValues, result);
            } else if (charValue["качественное значение"]) {
                let allowedValues = charValue["качественное значение"];
                if (!Array.isArray(allowedValues)) allowedValues = [String(allowedValues)];
                console.log(`📋 Допустимые значения (качественное значение):`, allowedValues);
                checkValueWithSynonyms(normalizedParentName, charName, patientValue, allowedValues, result);
            } else if (charValue["Числовое значение"]) { checkNumericValue(normalizedParentName + " " + charName, charValue["Числовое значение"], patientData, result); }
            else { console.log(`⚠️ Неизвестный тип значения для ${charName}`); }
        }
    });
}

function countCriteriaNormalized(variantName) {
    if (!variantName) return 0;
    let criteriaCount = 0;
    const words = variantName.split(/[\s,()\-–—]+/).filter(word => { if (!word || word.length < 2) return false; const stopWords = ['с', 'и', 'без', 'при', 'на', 'по', 'для', 'у', 'в', 'из', 'от', 'до', 'имеется']; return !stopWords.includes(word.toLowerCase()); });
    criteriaCount = Math.min(5, words.length);
    const medicalTerms = { 'генотип': 2, 'цирроз': 2, 'трансплантац': 2, 'пвт': 1, 'степень': 1, 'стадия': 1, 'тяжел': 1, 'легк': 1, 'средн': 1, 'хроническ': 1, 'острый': 1 };
    const lowerName = variantName.toLowerCase();
    for (const [term, bonus] of Object.entries(medicalTerms)) { if (lowerName.includes(term)) criteriaCount += bonus; }
    return Math.min(15, criteriaCount);
}

function evaluateSpecificCriteria(variantName, patientData) {
    let bonus = 0;
    if (variantName.toLowerCase().includes('гепатит') || variantName.toLowerCase().includes('hcv')) {
        const patientGenotype = findGenotypeInPatientData(patientData);
        const variantGenotype = getGenotypeFromVariantName(variantName);
        if (patientGenotype && variantGenotype) {
            if (patientGenotype === variantGenotype) { bonus += 25; console.log(`✅ Совпадение генотипа: ${patientGenotype} = ${variantGenotype} (+25)`); }
            else { bonus -= 40; console.log(`❌ Несовпадение генотипа: ${patientGenotype} ≠ ${variantGenotype} (-40)`); }
        }
    }
    if (variantName.toLowerCase().includes('мигрень')) {
        let patientSeverity = patientData["Приступ мигрени"] || patientData["Выраженность"];
        if (Array.isArray(patientSeverity)) patientSeverity = patientSeverity[0];
        if (patientSeverity && typeof patientSeverity === 'object') patientSeverity = patientSeverity["Значение"] || Object.values(patientSeverity)[0];
        const variantSeverity = getSeverityFromVariantName(variantName);
        if (patientSeverity && variantSeverity) {
            const severityStr = String(patientSeverity).toLowerCase();
            if (severityStr.includes(variantSeverity)) { bonus += 20; console.log(`✅ Совпадение выраженности мигрени: ${patientSeverity} (+20)`); }
        }
    }
    return bonus;
}

function checkArrayMatch(factorName, patientValue, expectedArray) {
    const patientLower = patientValue.toLowerCase();
    const found = expectedArray.some(expected => { if (!expected) return false; const expectedLower = String(expected).toLowerCase(); return patientLower.includes(expectedLower) || expectedLower.includes(patientLower) || patientLower === expectedLower; });
    if (found) return { matches: true, message: `${factorName}: ${patientValue} (совпадает с одним из: ${expectedArray.join(", ")}) ✅` };
    else return { matches: false, message: `${factorName}: ${patientValue} ≠ ${expectedArray.join(" или ")} ❌` };
}

function checkIfRequiresAbsence(factorValue) {
    if (typeof factorValue === 'string') { const lowerValue = factorValue.toLowerCase(); return lowerValue.includes('отсутствует') || lowerValue.includes('не проводилась') || lowerValue.includes('нет') || lowerValue.includes('без'); }
    if (Array.isArray(factorValue)) { return factorValue.some(item => { if (typeof item === 'string') { const lowerItem = item.toLowerCase(); return lowerItem.includes('отсутствует') || lowerItem.includes('не проводилась') || lowerItem.includes('нет') || lowerItem.includes('без'); } return false; }); }
    if (typeof factorValue === 'object' && factorValue !== null) {
        if (factorValue["качественное значение"]) { const expectedValues = factorValue["качественное значение"]; if (Array.isArray(expectedValues)) { return expectedValues.some(item => { if (typeof item === 'string') { const lowerItem = item.toLowerCase(); return lowerItem.includes('отсутствует') || lowerItem.includes('не проводилась') || lowerItem.includes('нет') || lowerItem.includes('без'); } return false; }); } }
        if (factorValue["Качественное значение"]) { const qualValues = factorValue["Качественное значение"]; const expectedValues = Object.keys(qualValues); return expectedValues.some(item => { const lowerItem = item.toLowerCase(); return lowerItem.includes('отсутствует') || lowerItem.includes('не проводилась') || lowerItem.includes('нет') || lowerItem.includes('без'); }); }
    }
    return false;
}

function checkIfPatientHasIt(patientValue, factorName) {
    if (!patientValue) return false;
    const lowerValue = patientValue.toLowerCase();
    if (lowerValue.includes('есть') || lowerValue.includes('имеется') || lowerValue.includes('да') || lowerValue.includes('присутствует') || lowerValue.includes('проводилась') || lowerValue.includes('положительный')) return true;
    if (lowerValue.includes('цирроз') || lowerValue.includes('трансплантац') || lowerValue.includes('оперирован')) return true;
    return false;
}

function findDrugsInObject(obj) {
    const results = [];
    if (!obj || typeof obj !== 'object') return results;
    if (obj["комбинация"] && obj["комбинация"]["Действующее вещество"]) { const drugs = Object.keys(obj["комбинация"]["Действующее вещество"]); if (drugs.length > 0) results.push(`**Комбинация препаратов:** ${drugs.join(" + ")}`); }
    if (obj["Действующее вещество"]) { const substances = Object.keys(obj["Действующее вещество"]); if (substances.length > 0) results.push(`**Действующее вещество:** ${substances.join(", ")}`); }
    if (obj["медикаментозное"]) { const medResults = findDrugsInObject(obj["медикаментозное"]); results.push(...medResults); }
    if (obj["Фарм-группа"]) { const groups = Object.keys(obj["Фарм-группа"]); if (groups.length > 0) results.push(`**Фарм-группы:** ${groups.join(", ")}`); }
    for (const key in obj) { if (typeof obj[key] === 'object' && obj[key] !== null) { const nestedResults = findDrugsInObject(obj[key]); results.push(...nestedResults); } }
    return results;
}

function checkGenotypeMatch(recommendation, patientData) {
    const patientGenotype = findGenotypeInPatientData(patientData);
    if (!patientGenotype || patientGenotype === '' || patientGenotype === 'не определен') { console.log("Генотип не указан, считаем рекомендацию подходящей"); return true; }
    const patientGenotypeStr = String(patientGenotype).toLowerCase().trim();
    const variantName = recommendation.variant_name ? recommendation.variant_name.toLowerCase() : '';
    console.log("Проверка генотипа:", { patientGenotype: patientGenotypeStr, variantName: variantName });
    const hasGenotypeSpecification = variantName.includes('генотип') || variantName.includes('genotype') || variantName.includes('1a') || variantName.includes('1b') || variantName.includes('2') || variantName.includes('3') || variantName.includes('4') || variantName.includes('5') || variantName.includes('6');
    if (!hasGenotypeSpecification) { console.log("Вариант не специфичен к генотипу - подходит"); return true; }
    if (variantName.includes('1a') && patientGenotypeStr.includes('1a')) { console.log("✓ Совпадение генотипа 1a"); return true; }
    if (variantName.includes('1b') && patientGenotypeStr.includes('1b')) { console.log("✓ Совпадение генотипа 1b"); return true; }
    if (variantName.includes('2') && patientGenotypeStr.includes('2')) return true;
    if (variantName.includes('3') && patientGenotypeStr.includes('3')) return true;
    if (variantName.includes('4') && patientGenotypeStr.includes('4')) return true;
    if (variantName.includes('5') && patientGenotypeStr.includes('5')) return true;
    if (variantName.includes('6') && patientGenotypeStr.includes('6')) return true;
    console.log(`❌ Несовпадение генотипа: вариант для ${variantName.includes('1a') ? '1a' : variantName.includes('1b') ? '1b' : 'другого'}, у пациента ${patientGenotypeStr}`);
    return false;
}

function getDetailedAnalysis() {
    if (!window.lastStructuredData) { if (window.lastExplanation) return window.lastExplanation + "\n\n---\n*Детальный анализ не доступен*"; return "❌ Детальный анализ не доступен. Сначала выполните анализ."; }
    const data = window.lastStructuredData;
    const result = [];
    result.push("📊 **ДЕТАЛЬНЫЙ АНАЛИЗ**"); result.push("");
    result.push("👤 **ПАЦИЕНТ**");
    result.push(`• ${data.diagnosis}`);
    if (data.patientData["Возраст"]) result.push(`• ${data.patientData["Возраст"]} лет`);
    if (data.patientData["Сведения паспортные_Пол"]) result.push(`• ${data.patientData["Сведения паспортные_Пол"] === "м" ? "Мужчина" : "Женщина"}`);
    const hr = data.patientData["Частота сердечных сокращений"];
    if (hr) result.push(`• ЧСС: ${hr} уд/мин`);
    const genotype = data.patientData["Анализ крови на гепатит С с определением генотипа_Результат"];
    if (genotype) result.push(`• Генотип: ${genotype}`);
    result.push("");
    result.push("📋 **РАССМОТРЕННЫЕ ВАРИАНТЫ**"); result.push("");
    data.allVariants.forEach((variant, idx) => {
        const isSelected = variant.isSelected;
        const icon = isSelected ? "✅" : "📌";
        const score = Math.round(variant.score);
        let nodeTypeShort = variant.nodeType;
        nodeTypeShort = nodeTypeShort.replace(" (функциональный класс)", "").replace("Вариант течения", "Вариант течения");
        result.push(`${icon} ${idx + 1}. **${variant.name}** (${nodeTypeShort})`);
        let scoreText = "";
        if (score >= 90) scoreText = "Отлично подходит";
        else if (score >= 75) scoreText = "Хорошо подходит";
        else if (score >= 60) scoreText = "Частично подходит";
        else if (score >= 40) scoreText = "Ограниченно подходит";
        else scoreText = "Не подходит";
        result.push(`   • Совпадение: ${scoreText} (${score}%)`);
        let missingItems = [];
        if (data.diagnosis === "Стабильная ИБС") { if (hr && hr > 60) missingItems.push(`ЧСС ${hr} > целевого 60 уд/мин`); if (score === 60 && !isSelected && variant.name.includes("приступ")) missingItems.push(`отсутствуют жалобы на боль в грудной клетке`); }
        if (data.diagnosis === "Хронический вирусный гепатит C") { if (!data.patientData["Цирроз печени"] || data.patientData["Цирроз печени"] === "") missingItems.push(`не указано наличие цирроза`); if (!data.patientData["Трансплантация печени"] || data.patientData["Трансплантация печени"] === "") missingItems.push(`не указана трансплантация печени`); }
        if (missingItems.length > 0) result.push(`   • ⚠️ Требуется уточнение: ${missingItems.join(", ")}`);
        if (isSelected) {
            let reasons = [];
            if (data.diagnosis === "Стабильная ИБС") { if (hr && hr <= 90) { reasons.push("отсутствие острого приступа"); reasons.push("стабильное течение стенокардии"); } if (variant.name.includes("I–II ФК")) reasons.push("соответствие функциональному классу I–II"); }
            if (data.diagnosis === "Хронический вирусный гепатит C") { if (variant.genotypeMatch === true) reasons.push("генотип соответствует"); if (variant.cirrhosisMatch === true) reasons.push("состояние печени соответствует"); if (variant.transplantMatch === true) reasons.push("статус трансплантации соответствует"); if (variant.pvtMatch === true) reasons.push("опыт ПВТ соответствует"); }
            if (reasons.length === 0 && data.selectedVariant.matches && data.selectedVariant.matches.length > 0) { data.selectedVariant.matches.forEach(m => { let cleanMatch = m.replace(/^[✅❌⚠️•]\s*/, ""); reasons.push(cleanMatch); }); }
            if (reasons.length > 0) { result.push(`   • ✅ Причины выбора:`); reasons.forEach(r => result.push(`     - ${r}`)); }
        }
        if (!isSelected) {
            if (variant.name.includes("приступ") && data.diagnosis === "Стабильная ИБС") result.push(`   • ❌ Не выбран: отсутствуют жалобы на боль в грудной клетке`);
            else if (score < 60) result.push(`   • ❌ Не выбран: низкое совпадение (${score}%)`);
            else if (score >= 60 && score < 90) result.push(`   • ⚠️ Альтернативный вариант (может применяться при противопоказаниях)`);
            else if (score >= 90) result.push(`   • ⚠️ Высокое совпадение, но выбран более специфичный вариант`);
        }
        let variantTreatments = [];
        if (isSelected && data.selectedVariant.treatments && data.selectedVariant.treatments.length > 0) variantTreatments = data.selectedVariant.treatments;
        else if (!isSelected && variant.treatments && variant.treatments.length > 0) variantTreatments = variant.treatments;
        if (variantTreatments.length > 0) {
            result.push(`   • 💊 Лечение:`);
            variantTreatments.slice(0, 3).forEach(t => { let clean = t.replace(/\*\*/g, '').trim(); if (clean.length > 70) clean = clean.substring(0, 70) + "..."; result.push(`     - ${clean}`); });
            if (variantTreatments.length > 3) result.push(`     - и еще ${variantTreatments.length - 3}...`);
        }
        result.push("");
    });
    result.push("📋 **РЕКОМЕНДАЦИИ ВРАЧУ**");
    if (data.diagnosis === "Стабильная ИБС") { if (hr && hr > 60) { result.push(`• Целевой уровень ЧСС: менее 60 уд/мин (текущий: ${hr})`); result.push("• Рекомендуется титрование дозы бета-блокатора"); } result.push("• Контроль артериального давления"); result.push("• Оценка липидного профиля"); }
    else if (data.diagnosis === "Хронический вирусный гепатит C") { result.push("• Перед началом терапии оценить функцию печени"); result.push("• Контроль вирусной нагрузки через 4 и 12 недель"); result.push("• Мониторинг побочных эффектов"); }
    else { result.push("• Проверить противопоказания к рекомендованным препаратам"); result.push("• Учесть сопутствующие заболевания пациента"); result.push("• Определить индивидуальные дозировки"); }
    result.push(""); result.push("---"); result.push("*Для возврата к краткому виду нажмите «Вернуться к анализу»*");
    return result.join("\n");
}

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

function toggleDetailedView() {
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (!analysisResultsDiv) return;
    const detailedExplanation = getDetailedAnalysis();
    const htmlExplanation = detailedExplanation.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/🏆/g, '<span style="color: #f1c40f;">🏆</span>').replace(/📋/g, '<span style="color: #3498db;">📋</span>').replace(/🔍/g, '<span style="color: #9b59b6;">🔍</span>').replace(/👤/g, '<span style="color: #9b59b6;">👤</span>').replace(/⚠️/g, '<span style="color: #f39c12;">⚠️</span>').replace(/✓/g, '<span style="color: #27ae60;">✓</span>').replace(/✗/g, '<span style="color: #e74c3c;">✗</span>');
    analysisResultsDiv.innerHTML = `<div class="analysis-result detailed-view"><div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; border-left: 4px solid #3498db;">${htmlExplanation}</div><div style="text-align: center;"><button onclick="toggleBriefView()" class="toggle-btn" style="background-color: #45a049; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">📋 Вернуться к краткому виду</button></div></div>`;
}

function toggleBriefView() {
    if (window.lastExplanation && window.lastPatientData) showAnalysisResults(window.lastExplanation, window.lastPatientData);
    else window.analyzeData();
}

function showAnalysisResults(explanation, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (!resultsDiv || !analysisResultsDiv) { console.error("❌ Не найдены элементы для отображения результатов"); window.showNotification?.("❌ Не найдено место для отображения результатов", "error"); return; }
    const htmlExplanation = explanation.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/🎯/g, '<span style="color: #e74c3c; font-size: 1.2em;">🎯</span>').replace(/💊/g, '<span style="color: #27ae60; font-size: 1.2em;">💊</span>').replace(/📋/g, '<span style="color: #3498db; font-size: 1.2em;">📋</span>').replace(/✅/g, '<span style="color: #27ae60;">✅</span>').replace(/⚠️/g, '<span style="color: #f39c12;">⚠️</span>').replace(/❌/g, '<span style="color: #e74c3c;">❌</span>').replace(/\•/g, '•');
    const allEnteredData = window.extract_patient_data?.() || {};
    const usedFields = [];
    if (window.lastStructuredData) {
        if (patientData["Клинический диагноз"]) usedFields.push("Клинический диагноз");
        if (patientData["Возраст"]) usedFields.push("Возраст");
        if (patientData["Сведения паспортные_Пол"]) usedFields.push("Сведения паспортные_Пол");
        if (patientData["Пол"]) usedFields.push("Пол");
        if (patientData["Частота сердечных сокращений"]) usedFields.push("Частота сердечных сокращений");
        if (patientData["Психотическая симптоматика"]) usedFields.push("Психотическая симптоматика");
        if (patientData["Чувствительность к развитию ЭПC"]) usedFields.push("Чувствительность к развитию ЭПC");
        if (patientData["Анализ крови на гепатит С с определением генотипа_Результат"]) usedFields.push("Генотип");
    }
    const additionalFields = Object.keys(allEnteredData).filter(key => !usedFields.includes(key) && key !== "Клинический диагноз" && allEnteredData[key] !== null && allEnteredData[key] !== undefined && allEnteredData[key] !== "");
    let additionalFieldsHtml = "";
    if (additionalFields.length > 0) {
        let fieldsList = "";
        additionalFields.forEach(field => { let value = allEnteredData[field]; if (Array.isArray(value)) value = value.join(", "); let fieldName = field.replace(/_/g, " ").replace(/Опыт терапии Опыт терапии /g, "Опыт терапии: "); fieldsList += `<div style="margin-bottom: 5px;">• <strong>${fieldName}:</strong> ${value}</div>`; });
        additionalFieldsHtml = `<details style="margin-top: 15px; background: #f8f9fa; padding: 10px; border-radius: 5px;"><summary style="cursor: pointer; color: #666; font-weight: bold;">📋 Дополнительные данные (не влияют на анализ)</summary><div style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 5px; border: 1px solid #eee;">${fieldsList}<div style="margin-top: 8px; font-size: 12px; color: #999;">⚠️ Эти данные сохранены в истории болезни, но не используются для выбора лечения при данном диагнозе</div></div></details>`;
    }
    analysisResultsDiv.innerHTML = `<div class="analysis-result" style="font-family: Arial, sans-serif; line-height: 1.6;"><div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;"><div style="border-left: 4px solid #e74c3c; padding-left: 15px; margin-bottom: 20px;">${htmlExplanation}</div>${additionalFieldsHtml}<div style="text-align: center; margin-top: 20px;"><button onclick="toggleDetailedView()" class="toggle-btn" style="background-color: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; margin-right: 10px;">📊 Показать детали анализа</button><button onclick="saveAllData()" class="save-btn" style="background-color: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">💾 Сохранить историю</button></div></div><details style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; border: 1px solid #ddd;"><summary style="cursor: pointer; color: #666; font-weight: bold;">📄 Исходные данные пациента (для проверки)</summary><div style="margin-top: 10px;"><pre style="white-space: pre-wrap; background: #fff; padding: 15px; border-radius: 4px; margin-top: 10px; max-height: 200px; overflow-y: auto; font-size: 12px; border: 1px solid #eee;">${JSON.stringify(patientData, null, 2)}</pre></div></details></div>`;
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function extractPatientDiagnosis(patientData) {
    if (!patientData) return null;
    const possibleFields = ["Клинический диагноз", "Диагноз", "Основной диагноз", "Сопутствующий диагноз"];
    for (const field of possibleFields) {
        if (patientData[field]) {
            const value = patientData[field];
            let diagnosisStr = "";
            if (Array.isArray(value)) diagnosisStr = value[0];
            else diagnosisStr = String(value);
            diagnosisStr = diagnosisStr.trim();
            return normalizeDiagnosis(diagnosisStr);
        }
    }
    return null;
}

function normalizeDiagnosis(diagnosis) {
    if (!diagnosis) return null;
    const lowerDiagnosis = diagnosis.toLowerCase().trim();
    const diagnosisMapping = { 'стабильная ибс': 'Стабильная ИБС', 'ибс': 'Стабильная ИБС', 'ишемическая болезнь сердца': 'Стабильная ИБС', 'мигрень': 'Мигрень', 'хронический вирусный гепатит c': 'Хронический вирусный гепатит C', 'хвгс': 'Хронический вирусный гепатит C', 'артериальная гипертензия': 'Артериальная гипертензия', 'аг': 'Артериальная гипертензия', 'переломы лодыжек': 'Переломы лодыжек', 'перелом лодыжки': 'Переломы лодыжек', 'повреждение связок коленного сустава': 'Повреждение связок коленного сустава', 'переломы ключицы и лопатки': 'Переломы ключицы и лопатки', 'переломы проксимального отдела бедренной кости': 'Переломы проксимального отдела бедренной кости', 'переломы проксимального отдела костей голени': 'Переломы проксимального отдела костей голени', 'повреждения тазового кольца': 'Повреждения тазового кольца', 'переломы надколенника': 'Переломы надколенника', 'вывих шейного позвонка': 'Вывих шейного позвонка', 'переломы дистального отдела костей предплечья': 'Переломы дистального отдела костей предплечья' };
    for (const [key, value] of Object.entries(diagnosisMapping)) { if (lowerDiagnosis.includes(key) || key.includes(lowerDiagnosis)) return value; }
    return capitalizeFirstLetter(diagnosis);
}

function capitalizeFirstLetter(str) { return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(); }

function showErrorResults(error) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (resultsDiv && analysisResultsDiv) { analysisResultsDiv.innerHTML = `<div class="analysis-result analysis-error"><strong>Ошибка анализа:</strong><p style="color: #dc3545;">${error.message}</p><details style="margin-top: 10px;"><summary>Подробности ошибки</summary><pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px;">${error.stack}</pre></details></div>`; resultsDiv.style.display = 'block'; }
}

function extractMissingFieldsFromAnalysis(explanationText, patientData) {
    const missingFields = [];
    if (!explanationText || !window.knowledgeBase) return missingFields;
    let diagnosis = "";
    const diagnosisMatch = explanationText.match(/🎯 \*\*ДИАГНОЗ:\*\* (.+?)(?:\n|$)/);
    if (diagnosisMatch) diagnosis = diagnosisMatch[1].trim();
    if (!diagnosis) return missingFields;
    if (diagnosis === "Переломы лодыжек" && explanationText.includes("домашняя реабилитация")) return [];
    if (diagnosis === "Стабильная ИБС" && explanationText.includes("стабильная стенокардия")) return [];
    if (diagnosis === "Хронический вирусный гепатит C" && explanationText.includes("генотип") && explanationText.includes("Выбранный вариант")) return [];
    if (diagnosis === "Шизофрения" && explanationText.includes("Выбранный вариант")) return [];
    console.log("🔍 Диагноз из текста:", diagnosis);
    const klinrek = window.knowledgeBase["КлинРек II ур"];
    if (!klinrek) return missingFields;
    const diseases = klinrek["Заболевание"];
    if (!diseases || !diseases[diagnosis]) return missingFields;
    const diseaseSection = diseases[diagnosis];
    const allCriteria = {};
    function extractCriteriaFromNode(node, path = "") {
        if (!node || typeof node !== 'object') return;
        if (node["Категория пациента"]) {
            const category = node["Категория пациента"];
            if (category["Наблюдение"]) {
                const observations = category["Наблюдение"];
                if (Array.isArray(observations)) { observations.forEach(obs => { for (const obsName in obs) { if (!allCriteria[obsName]) allCriteria[obsName] = { description: `Укажите ${obsName.toLowerCase()}`, searchKeys: [obsName, obsName.toLowerCase()] }; } }); }
                else if (typeof observations === 'object') { for (const obsName in observations) { if (!allCriteria[obsName]) allCriteria[obsName] = { description: `Укажите ${obsName.toLowerCase()}`, searchKeys: [obsName, obsName.toLowerCase()] }; } }
            }
            if (category["Фактор"]) {
                const factors = category["Фактор"];
                for (const factorName in factors) {
                    if (!allCriteria[factorName]) { let description = `Укажите ${factorName.toLowerCase()}`; if (factorName === "Опыт терапии") description = "Укажите опыт терапии (был/не был, эффективность)"; if (factorName.includes("Чувствительность")) description = "Укажите чувствительность (имеется/отсутствует)"; allCriteria[factorName] = { description: description, searchKeys: [factorName, factorName.toLowerCase()] }; }
                }
            }
        }
        for (const key in node) { if (typeof node[key] === 'object' && node[key] !== null) extractCriteriaFromNode(node[key], path + "." + key); }
    }
    const nodeTypes = ["Стадия (Фаза)", "Вариант течения (функциональный класс)", "Функциональный класс заболевания"];
    for (const nodeType of nodeTypes) { if (diseaseSection[nodeType]) extractCriteriaFromNode(diseaseSection[nodeType]); }
    const criticalFields = ["Чувствительность к развитию ЭПС", "Психотическая симптоматика", "Опыт терапии"];
    for (const [criteriaName, criteriaInfo] of Object.entries(allCriteria)) {
        const isCritical = criticalFields.some(cf => criteriaName.includes(cf) || cf.includes(criteriaName));
        if (!isCritical) continue;
        const hasValue = checkIfFieldHasValueUniversal(criteriaName, criteriaInfo.searchKeys, patientData);
        if (!hasValue && !missingFields.some(f => f.displayName === criteriaName)) missingFields.push({ displayName: criteriaName, description: criteriaInfo.description, isMissing: true, searchKeys: criteriaInfo.searchKeys });
    }
    return missingFields;
}

function checkIfFieldHasValueUniversal(fieldName, searchKeys, patientData) {
    if (!patientData) return false;
    const normalizedFieldName = fieldName.toLowerCase().replace(/[\s_]/g, '');
    for (const [key, value] of Object.entries(patientData)) {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const keyLower = key.toLowerCase();
        if (keyLower === normalizedFieldName) return true;
        for (const searchKey of searchKeys) { if (keyLower.includes(searchKey.toLowerCase())) return true; }
    }
    for (const [key, value] of Object.entries(patientData)) {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        const keyLower = key.toLowerCase();
        for (const searchKey of searchKeys) {
            if (keyLower.includes(searchKey.toLowerCase())) {
                let actualValue = value;
                if (Array.isArray(value)) actualValue = value[0];
                if (actualValue && actualValue !== '' && actualValue !== '-- Выберите значение --') return true;
            }
        }
    }
    const specialCases = { "чувствительность": ["чувствительность", "эпс", "эпc"], "опыт терапии": ["опыт терапии", "антипсихотиком", "n05a"], "психотическая": ["психотическая", "симптоматика"], "возраст": ["возраст"], "генотип": ["генотип", "анализ крови"], "цирроз": ["цирроз", "цп"] };
    for (const [specialField, keywords] of Object.entries(specialCases)) {
        if (normalizedFieldName.includes(specialField)) {
            for (const [key, value] of Object.entries(patientData)) {
                const keyLower = key.toLowerCase();
                for (const keyword of keywords) {
                    if (keyLower.includes(keyword)) {
                        let actualValue = value;
                        if (Array.isArray(value)) actualValue = value[0];
                        if (actualValue && actualValue !== '' && actualValue !== '-- Выберите значение --') return true;
                    }
                }
            }
        }
    }
    return false;
}

function showMissingFieldsPanel(missingFields) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (!resultsDiv || !analysisResultsDiv) return;
    if (!missingFields || missingFields.length === 0) return;
    const oldPanel = document.getElementById('missingFieldsPanel');
    if (oldPanel) oldPanel.remove();
    const panelHTML = `<div id="missingFieldsPanel" style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px 20px; margin: 0 0 20px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><div style="display: flex; align-items: center; margin-bottom: 12px;"><span style="font-size: 24px; margin-right: 10px;">⚠️</span><h3 style="margin: 0; color: #e67e22;">Недостаточно данных для точного выбора варианта</h3></div><p style="margin: 0 0 12px 0; color: #666;">Для получения точной рекомендации заполните следующие поля:</p><ul style="margin: 0 0 15px 0; padding-left: 20px;">${missingFields.map(field => `<li style="margin-bottom: 8px;"><strong style="color: #e67e22;">${field.displayName}</strong><span style="color: #666;"> — ${field.description}</span></li>`).join('')}</ul><div style="display: flex; gap: 10px; margin-top: 15px;"><button id="highlightMissingBtn" style="background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 14px;">🔍 Перейти к незаполненным полям</button><button id="refreshAnalysisBtn" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 14px;">🔄 Обновить анализ после заполнения</button></div></div>`;
    analysisResultsDiv.insertAdjacentHTML('afterbegin', panelHTML);
    const highlightBtn = document.getElementById('highlightMissingBtn');
    if (highlightBtn) highlightBtn.addEventListener('click', () => { highlightMissingFieldsByList(missingFields); });
    const refreshBtn = document.getElementById('refreshAnalysisBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => { if (window.analyzeData) window.analyzeData(); });
}

function highlightMissingFieldsByList(missingFields) { missingFields.forEach(field => { highlightFieldByName(field.displayName); }); }

function highlightFieldByName(fieldName) {
    const fieldMapping = { 'Цирроз печени': { tab: 'Общие сведения', selectors: ['Сопутствующий диагноз', 'сопутствующий диагноз'] }, 'Генотип вируса': { tab: 'Сведения в динамике', selectors: ['Анализ крови на гепатит С с определением генотипа', 'генотип'] }, 'Опыт противовирусной терапии (ПВТ)': { tab: 'Сведения в динамике', selectors: ['Опыт терапии', 'ПВТ'] }, 'Трансплантация печени': { tab: 'Общие сведения', selectors: ['Операции в прошлом', 'трансплантация'] }, 'Локализация перелома': { tab: 'Расширенный клинический диагноз', selectors: ['Локализация', 'локализация'] }, 'Тип повреждения': { tab: 'Расширенный клинический диагноз', selectors: ['Тип повреждения', 'тип повреждения'] }, 'Выраженность приступа': { tab: 'Жалобы', selectors: ['Приступ мигрени', 'Выраженность'] } };
    const mapping = fieldMapping[fieldName];
    if (!mapping) return;
    switchToTab(mapping.tab);
    setTimeout(() => {
        const activeContent = document.querySelector('.tab-contents');
        if (!activeContent) return;
        for (const selector of mapping.selectors) {
            let element = null;
            element = activeContent.querySelector(`[name*="${selector}" i]`);
            if (!element) {
                const labels = activeContent.querySelectorAll('label');
                for (const label of labels) {
                    if (label.textContent.toLowerCase().includes(selector.toLowerCase())) { const parent = label.parentElement; element = parent.querySelector('input, select, textarea'); break; }
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
                setTimeout(() => { element.style.border = originalBorder; element.style.backgroundColor = originalBg; element.style.boxShadow = ''; }, 3000);
                break;
            }
        }
    }, 200);
}

function switchToTab(tabName) {
    const headers = document.querySelectorAll('.tab-header');
    for (const header of headers) { if (header.innerText.trim() === tabName) { header.click(); break; } }
}

const originalShowAnalysisResults = window.showAnalysisResults || function(explanation, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    if (analysisResultsDiv) { analysisResultsDiv.innerHTML = explanation.replace(/\n/g, '<br>'); if (resultsDiv) resultsDiv.style.display = 'block'; }
};

window.showAnalysisResults = function(explanation, patientData) {
    const missingFields = extractMissingFieldsFromAnalysis(explanation, patientData);
    originalShowAnalysisResults(explanation, patientData);
    if (missingFields && missingFields.length > 0) { setTimeout(() => { showMissingFieldsPanel(missingFields); }, 100); }
};

window.ultimateCheckIfPatientHasField = ultimateCheckIfPatientHasField;
window.extractMissingFieldsFromAnalysis = extractMissingFieldsFromAnalysis;
window.showMissingFieldsPanel = showMissingFieldsPanel;
window.highlightMissingFieldsByList = highlightMissingFieldsByList;
window.highlightFieldByName = highlightFieldByName;
window.switchToTab = switchToTab;
window.analyzeData = analyzeData;
window.testSolver = function() { console.log("=== ТЕСТ РЕШАТЕЛЯ ==="); const testData = { "Клинический диагноз": "Хронический вирусный гепатит C", "Возраст": 45, "Анализ крови на гепатит С с определением генотипа_Результат": ["1b"], "Опыт терапии_Опыт терапии_ПВТ (противовирусной терапии)": ["отсутствует"] }; console.log("Тестовые данные:", testData); console.log("\n🔍 Проверка extractPatientValue:"); console.log("Цирроз печени:", extractPatientValue("Цирроз печени", testData)); console.log("Трансплантация печени:", extractPatientValue("Трансплантация печени", testData)); console.log("Генотип:", extractPatientValue("Генотип", testData)); console.log("ПВТ:", extractPatientValue("ПВТ", testData)); return "Тест завершен"; };
window.testKnowledgeBase = function() { if (!window.knowledgeBase) { console.log("❌ База знаний не загружена"); return; } console.log("=== ПРОВЕРКА БАЗЫ ЗНАНИЙ ==="); const klinrek = window.knowledgeBase["КлинРек II ур"]; if (!klinrek) { console.log("❌ Нет раздела 'КлинРек II ур'"); return; } const diseases = klinrek["Заболевание"]; if (!diseases) { console.log("❌ Нет раздела 'Заболевание'"); return; } console.log("Доступные диагнозы:"); for (const disease in diseases) { console.log(`- ${disease}`); if (disease === "Хронический вирусный гепатит C") { console.log("  Варианты течения:"); const variants = diseases[disease]["Вариант течения (функциональный класс)"]; for (const variant in variants) console.log(`  * ${variant}`); } } return "Проверка завершена"; };

console.log("✅ Solver.js оптимизирован и загружен!");