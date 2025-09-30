// Глобальный объект для хранения данных всех вкладок
let allTabsData = {
    "Сведения паспортные": { data: {} },
    "Сведения при обращении": { data: {} },
    "Сведения о состоянии": { data: {} },
    "Сведения в динамике": { data: {} }
};

let jsonData = {};
let knowledgeBase = null;

// Экспортируем функции для использования в решателе
window.allTabsData = allTabsData;
window.knowledgeBase = knowledgeBase;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('guiFileInput').addEventListener('change', handleFileSelect);
    document.getElementById('knowledgeBaseFile').addEventListener('change', handleKnowledgeBaseSelect);
    document.getElementById('patientHistoryFile').addEventListener('change', handlePatientHistorySelect);
    document.getElementById('saveButton').addEventListener('click', saveAllData);
    document.getElementById('clearButton').addEventListener('click', clearForm);
    document.getElementById('reloadButton').addEventListener('click', reloadPage);
    document.getElementById('analyzeButton').addEventListener('click', function() {
        if (window.analyzeData) {
            window.analyzeData();
        } else {
            showNotification("Решатель не загружен!", "error");
        }
    });
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        clearForm();
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                jsonData = JSON.parse(e.target.result);
                initializeTabsData();
                renderTabs();
                showNotification("Файл GUI загружен успешно!", "success");
            } catch (error) {
                showNotification("Ошибка при чтении файла GUI: " + error.message, "error");
            }
        };
        reader.readAsText(file);
    }
}

function handleKnowledgeBaseSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                knowledgeBase = JSON.parse(e.target.result);
                window.knowledgeBase = knowledgeBase; // Экспортируем для решателя
                showNotification("База знаний загружена успешно!", "success");
            } catch (error) {
                showNotification("Ошибка при чтении базы знаний: " + error.message, "error");
            }
        };
        reader.readAsText(file);
    }
}

function handlePatientHistorySelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const patientHistory = JSON.parse(e.target.result);
                loadPatientHistory(patientHistory);
                showNotification("История болезни загружена успешно!", "success");
            } catch (error) {
                showNotification("Ошибка при чтении истории болезни: " + error.message, "error");
            }
        };
        reader.readAsText(file);
    }
}

function loadPatientHistory(patientHistory) {
    try {
        // Очищаем текущие данные
        clearForm();
        
        // Извлекаем данные из структуры истории болезни
        const historyData = patientHistory["История болезни или наблюдений v.4"];
        if (!historyData) {
            throw new Error("Неверный формат файла истории болезни");
        }
        
        // Находим первую историю болезни в файле
        const ibId = Object.keys(historyData)[0];
        const patientRecord = historyData[ibId];
        
        if (!patientRecord || !patientRecord["Данные"]) {
            throw new Error("Отсутствуют данные пациента в файле");
        }
        
        const patientData = patientRecord["Данные"];
        
        // Загружаем данные в соответствующие вкладки
        for (const tabName in allTabsData) {
            if (patientData[tabName]) {
                const tabData = patientData[tabName];
                
                for (const fieldName in tabData) {
                    const fieldData = tabData[fieldName];
                    
                    if (fieldData && typeof fieldData === 'object') {
                        // Обрабатываем разные форматы данных
                        if ("Значение" in fieldData) {
                            allTabsData[tabName].data[fieldName] = fieldData["Значение"];
                        } else if ("Тип" in fieldData && "Значение" in fieldData) {
                            allTabsData[tabName].data[fieldName] = fieldData["Значение"];
                        } else {
                            // Если поле содержит вложенные объекты, сохраняем как есть
                            allTabsData[tabName].data[fieldName] = fieldData;
                        }
                    } else {
                        allTabsData[tabName].data[fieldName] = fieldData;
                    }
                }
            }
        }
        
        // Обновляем интерфейс
        const activeTab = document.querySelector('.tab-header.active');
        if (activeTab) {
            renderTabContent(activeTab.innerText.trim());
        }
        
        showNotification("Данные истории болезни загружены в форму!", "success");
        
    } catch (error) {
        showNotification("Ошибка загрузки истории болезни: " + error.message, "error");
        console.error("Ошибка загрузки истории болезни:", error);
    }
}

function initializeTabsData() {
    const tabsInJson = Object.keys(jsonData['Описание GUI для ПС']?.['Шаблон']?.['Ввод наблюдений']?.['Вкладка'] || {});
    const tempData = {};
    
    for (const tabName in allTabsData) {
        if (tabsInJson.includes(tabName)) {
            tempData[tabName] = { data: allTabsData[tabName].data || {} };
        }
    }
    
    if (tempData["Сведения о состоянии"] && !tempData["Сведения при обращении"]) {
        tempData["Сведения при обращении"] = { data: tempData["Сведения о состоянии"].data };
    }
    else if (tempData["Сведения при обращении"] && !tempData["Сведения о состоянии"]) {
        tempData["Сведения о состоянии"] = { data: tempData["Сведения при обращении"].data };
    }
    
    allTabsData = tempData;
}

function showNotification(message, type = "success") {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.color = type === "success" ? "green" : "red";
    setTimeout(() => {
        notification.textContent = '';
    }, 3000);
}

function clearForm() {
    for (const tabName in allTabsData) {
        allTabsData[tabName].data = {};
    }
    
    const activeTab = document.querySelector('.tab-header.active');
    if (activeTab) {
        renderTabContent(activeTab.innerText.trim());
    }
    
    document.getElementById('results').style.display = 'none';
    showNotification("Форма очищена!", "success");
}

function reloadPage() {
    location.reload();
}

function renderTabs() {
    const tabHeaders = document.querySelector('.tab-headers');
    const tabContents = document.querySelector('.tab-contents');
    tabHeaders.innerHTML = '';
    tabContents.innerHTML = '';

    const jsonTabs = jsonData['Описание GUI для ПС']?.['Шаблон']?.['Ввод наблюдений']?.['Вкладка'] || {};
    const tabsToRender = Object.keys(jsonTabs);
    const availableTabs = Object.keys(allTabsData).filter(tab => tabsToRender.includes(tab));
    
    availableTabs.forEach(tabName => {
        const tabHeader = document.createElement('div');
        tabHeader.innerText = tabName;
        tabHeader.classList.add('tab-header');
        tabHeader.onclick = () => {
            document.querySelectorAll('.tab-header').forEach(header => {
                header.classList.remove('active');
            });
            tabHeader.classList.add('active');
            renderTabContent(tabName);
        };
        tabHeaders.appendChild(tabHeader);
    });

    if (availableTabs.length > 0) {
        document.querySelector('.tab-header:first-child').classList.add('active');
        renderTabContent(availableTabs[0]);
    }
}

function renderTabContent(tabName) {
    const tabContents = document.querySelector('.tab-contents');
    tabContents.innerHTML = '';
    
    let actualTabName = tabName;
    const jsonTabs = jsonData['Описание GUI для ПС']?.['Шаблон']?.['Ввод наблюдений']?.['Вкладка'] || {};
    
    if (!jsonTabs[tabName]) {
        if (tabName === "Сведения при обращении" && jsonTabs["Сведения о состоянии"]) {
            actualTabName = "Сведения о состоянии";
        } else if (tabName === "Сведения о состоянии" && jsonTabs["Сведения при обращении"]) {
            actualTabName = "Сведения при обращении";
        }
    }
    
    const tabStructure = jsonTabs[actualTabName] || {};
    
    // Особый рендеринг для паспортных данных
    if (tabName === "Сведения паспортные") {
        renderPassportData(tabStructure, tabContents);
    } else {
        renderJSON(tabStructure, tabContents, false, tabName);
    }
}

function renderPassportData(tabStructure, container) {
    const passportData = findNestedObject(tabStructure, 'Наблюдение');
    const passportGroup = findNestedObject(tabStructure, 'Группа');
    
    if (passportData) {
        renderJSON(passportData, container, false, "Сведения паспортные");
    }
    
    if (passportGroup && passportGroup['номер']) {
        const div = document.createElement('div');
        div.classList.add('nested');
        
        const label = document.createElement('label');
        label.textContent = "номер документа: ";
        div.appendChild(label);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'номер документа';
        input.placeholder = 'Введите номер документа';
        
        if (allTabsData["Сведения паспортные"].data['номер документа'] !== undefined) {
            input.value = allTabsData["Сведения паспортные"].data['номер документа'];
        }
        
        input.addEventListener('input', function() {
            allTabsData["Сведения паспортные"].data['номер документа'] = this.value;
        });
        
        div.appendChild(input);
        container.appendChild(div);
    }
}

function findNestedObject(obj, targetKey) {
    if (obj && typeof obj === 'object') {
        if (targetKey in obj) {
            return obj[targetKey];
        }
        
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                const result = findNestedObject(obj[key], targetKey);
                if (result) return result;
            }
        }
    }
    return null;
}

function renderJSON(data, container, skipHeaders = false, tabName) {
    for (const key in data) {
        if (['Качественное значение', 'Числовое значение', 'единица измерения', 
             'место записи в документе', 'путь к узлу документа'].includes(key)) {
            continue;
        }

        const isPassportTab = tabName === "Сведения паспортные";
        const isIntermediateNode = !isPassportTab && [
            'Вершина меню', 'Идентификация', 'Группа', 'Вкладка',
            'Шаблон', 'Описание GUI для ПС'
        ].includes(key);

        if (isIntermediateNode) {
            renderJSON(data[key], container, true, tabName);
            continue;
        }

        const div = document.createElement('div');
        if (!skipHeaders) {
            div.classList.add('nested');
        }

        if (typeof data[key] === 'object' && data[key] !== null) {
            if (data[key]['Числовое значение']) {
                const label = document.createElement('label');
                label.textContent = `${key}: `;
                div.appendChild(label);

                const input = document.createElement('input');
                input.type = 'number';
                input.name = key;
                
                if (data[key]['Числовое значение']['единица измерения']) {
                    input.placeholder = `Введите значение (${data[key]['Числовое значение']['единица измерения']})`;
                } else {
                    input.placeholder = `Введите значение`;
                }
                
                if (allTabsData[tabName].data[key] !== undefined) {
                    input.value = allTabsData[tabName].data[key];
                }
                
                input.addEventListener('input', function() {
                    allTabsData[tabName].data[key] = this.value ? Number(this.value) : null;
                });
                
                div.appendChild(input);
            } 
            else if (data[key]['Качественное значение']) {
                const label = document.createElement('label');
                label.textContent = `${key}: `;
                div.appendChild(label);

                const select = document.createElement('select');
                select.name = key;
                
                const emptyOption = document.createElement('option');
                emptyOption.value = "";
                emptyOption.textContent = "-- Выберите значение --";
                select.appendChild(emptyOption);
                
                const qualitativeValues = data[key]['Качественное значение'];
                for (const qualitativeKey in qualitativeValues) {
                    const optionElement = document.createElement('option');
                    optionElement.value = qualitativeKey;
                    optionElement.textContent = qualitativeKey;
                    
                    if (allTabsData[tabName].data[key] === qualitativeKey) {
                        optionElement.selected = true;
                    }
                    
                    select.appendChild(optionElement);
                }
                
                select.addEventListener('change', function() {
                    allTabsData[tabName].data[key] = this.value;
                });
                
                div.appendChild(select);
            }
            else if (data[key]['присутствие'] || data[key]['отсутствует']) {
                const wrapperDiv = document.createElement('div');
                wrapperDiv.classList.add('symptom-wrapper');
                
                const symptomLabel = document.createElement('label');
                symptomLabel.textContent = `${key}: `;
                symptomLabel.style.fontWeight = 'bold';
                wrapperDiv.appendChild(symptomLabel);
                
                const select = document.createElement('select');
                select.name = key;
                select.classList.add('presence-select');
                
                const optionPresent = document.createElement('option');
                optionPresent.value = 'присутствие';
                optionPresent.textContent = 'Присутствует';
                select.appendChild(optionPresent);
                
                const optionAbsent = document.createElement('option');
                optionAbsent.value = 'отсутствует';
                optionAbsent.textContent = 'Отсутствует';
                select.appendChild(optionAbsent);
                
                if (allTabsData[tabName].data[key] === 'присутствие' || 
                    allTabsData[tabName].data[key] === 'отсутствует') {
                    select.value = allTabsData[tabName].data[key];
                }
                
                const characteristicsDiv = document.createElement('div');
                characteristicsDiv.classList.add('characteristics');
                
                if (data[key]['присутствие'] && data[key]['присутствие']['Характеристика']) {
                    characteristicsDiv.style.display = select.value === 'присутствие' ? 'block' : 'none';
                    renderJSON(data[key]['присутствие']['Характеристика'], characteristicsDiv, true, tabName);
                }
                
                select.addEventListener('change', function() {
                    allTabsData[tabName].data[key] = this.value;
                    if (characteristicsDiv) {
                        characteristicsDiv.style.display = this.value === 'присутствие' ? 'block' : 'none';
                    }
                });
                
                wrapperDiv.appendChild(select);
                if (characteristicsDiv.childNodes.length > 0) {
                    wrapperDiv.appendChild(characteristicsDiv);
                }
                
                div.appendChild(wrapperDiv);
            }
            else if (['Дневник наблюдений', 'Анамнез заболевания', 'Назначение лечения', 
                     'Жалобы', 'Осмотр', 'Опрос', 'Сведения паспортные', 
                     'Сведения при обращении', 'Сведения в динамике'].includes(key)) {
                const sectionDiv = document.createElement('div');
                sectionDiv.classList.add('collapsible-section');
                
                const headerButton = document.createElement('button');
                headerButton.classList.add('section-header');
                headerButton.textContent = key;
                headerButton.addEventListener('click', function() {
                    this.classList.toggle('active');
                    const content = this.nextElementSibling;
                    content.style.display = content.style.display === 'block' ? 'none' : 'block';
                });
                
                const contentDiv = document.createElement('div');
                contentDiv.classList.add('section-content');
                contentDiv.style.display = 'none';
                
                renderJSON(data[key], contentDiv, true, tabName);
                
                sectionDiv.appendChild(headerButton);
                sectionDiv.appendChild(contentDiv);
                div.appendChild(sectionDiv);
            }
            else {
                if (!skipHeaders && Object.keys(data[key]).length > 0) {
                    const header = document.createElement('h3');
                    header.textContent = key;
                    div.appendChild(header);
                }
                
                renderJSON(data[key], div, skipHeaders, tabName);
            }
        }
        
        if (div.childNodes.length > 0) {
            container.appendChild(div);
        }
    }
}

function saveAllData() {
    const ibId = "ИБ_" + new Date().getTime();
    const outputData = {
        "История болезни или наблюдений v.4": {
            [ibId]: {
                "дата обращения": new Date().toLocaleString('ru-RU'),
                "Данные": {}
            }
        }
    };

    const ibData = outputData["История болезни или наблюдений v.4"][ibId];

    for (const tabName in allTabsData) {
        if (!ibData["Данные"][tabName]) {
            ibData["Данные"][tabName] = {};
        }

        for (const fieldName in allTabsData[tabName].data) {
            const fieldValue = allTabsData[tabName].data[fieldName];
            
            if (fieldValue === null || fieldValue === undefined) {
                continue;
            } else if (typeof fieldValue === 'object') {
                ibData["Данные"][tabName][fieldName] = JSON.parse(JSON.stringify(fieldValue));
            } else if (typeof fieldValue === 'number') {
                ibData["Данные"][tabName][fieldName] = {
                    "Тип": "Числовое",
                    "Значение": fieldValue
                };
            } else {
                ibData["Данные"][tabName][fieldName] = {
                    "Тип": "Текстовое",
                    "Значение": fieldValue.toString()
                };
            }
        }
    }

    let isEmpty = true;
    for (const tabName in ibData["Данные"]) {
        if (Object.keys(ibData["Данные"][tabName]).length > 0) {
            isEmpty = false;
            break;
        }
    }
    
    if (isEmpty) {
        showNotification("Нет данных для сохранения!", "error");
        return;
    }

    const jsonOutput = JSON.stringify(outputData, (key, value) => {
        if (value === null || value === undefined || 
            (typeof value === 'object' && Object.keys(value).length === 0)) {
            return undefined;
        }
        return value;
    }, 2);

    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'история_болезни_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("Все данные успешно сохранены!", "success");
}

// Экспортируем функции для решателя
window.showNotification = showNotification;
window.extract_patient_data = extract_patient_data;

// Функция извлечения данных пациента (для решателя)
function extract_patient_data() {
    const patient_data = {};

    // Извлекаем данные из всех вкладок
    for (const tabName in allTabsData) {
        for (const fieldName in allTabsData[tabName].data) {
            const fieldValue = allTabsData[tabName].data[fieldName];
            if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                patient_data[fieldName] = fieldValue;
            }
        }
    }

    // Специальная обработка некоторых полей
    if ("Операции" in patient_data) {
        if (patient_data["Операции"] === "Трансплантация печени") {
            patient_data["Трансплантация печени"] = "проводилась";
        } else if (patient_data["Операции"] === "") {
            patient_data["Трансплантация печени"] = "не проводилась";
        }
    }

    // Обработка терапии
    const therapy_fields = {
        "ПВТ (противовирусной терапии)": "Опыт терапии_ПВТ (противовирусной терапии)",
        "терапия ПегИФN + РБВ": "Опыт терапии_терапия ПегИФN + РБВ",
        "Цирроз печени": "Цирроз печени"
    };

    for (const [src_field, target_field] of Object.entries(therapy_fields)) {
        if (src_field in patient_data) {
            patient_data[target_field] = patient_data[src_field];
        }
    }

    return patient_data;
}