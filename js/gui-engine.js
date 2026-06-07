// Глобальный объект для хранения данных всех вкладок
let allTabsData = {
    "Общие сведения": { 
        data: {},
        hierarchicalData: {}
    },
    "Сведения о состоянии": { 
        data: {},
        hierarchicalData: {}
    },
    "Сведения в динамике": { 
        data: {},
        hierarchicalData: {}
    }
};

let jsonData = {};
let knowledgeBase = null;

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
                
                // ОБНОВЛЯЕМ СТАТУС GUI
                if (typeof window.updateGUIStatus === 'function') {
                    window.updateGUIStatus(true);
                }
                
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
                window.knowledgeBase = knowledgeBase;
                showNotification("База знаний загружена успешно!", "success");
                
                // ОБНОВЛЯЕМ СТАТУС БАЗЫ ЗНАНИЙ
                if (typeof window.updateKBStatus === 'function') {
                    window.updateKBStatus(true);
                }
                
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
                
                // Сбрасываем поле ввода
                event.target.value = '';
                
                // Создаем временное уведомление о загрузке
                createHistoryLoadedNotification();
                
                showNotification("История болезни загружена успешно!", "success");
                
                // ОБНОВЛЯЕМ СТАТУС ИСТОРИИ БОЛЕЗНИ
                if (typeof window.updateHistoryStatus === 'function') {
                    window.updateHistoryStatus(true);
                }
                
            } catch (error) {
                showNotification("Ошибка при чтении истории болезни: " + error.message, "error");
            }
        };
        reader.readAsText(file);
    }
}

function createHistoryLoadedNotification() {
    const fileInputContainer = document.getElementById('patientHistoryFile').parentNode;
    
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'history-loaded-notification';
    notificationDiv.style.cssText = `
        padding: 8px 15px;
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
        border-radius: 4px;
        margin-top: 5px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    
    notificationDiv.innerHTML = `
        <span>✅ История болезни загружена</span>
        <button id="clearHistoryBtn" style="background: none; border: none; color: #155724; cursor: pointer; font-size: 12px;">
            ✕ Очистить
        </button>
    `;
    
    const existingNotification = fileInputContainer.querySelector('.history-loaded-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    fileInputContainer.appendChild(notificationDiv);
    
    document.getElementById('clearHistoryBtn').addEventListener('click', function() {
        clearPatientHistory();
    });
}

function clearPatientHistory() {
    clearForm();
    
    const notification = document.querySelector('.history-loaded-notification');
    if (notification) {
        notification.remove();
    }
    
    document.getElementById('patientHistoryFile').value = '';
    
    showNotification("История болезни очищена!", "success");
}

function clearForm() {
    for (const tabName in allTabsData) {
        allTabsData[tabName].data = {};
    }
    const activeTab = document.querySelector('.tab-header.active');
    if (activeTab) renderTabContent(activeTab.innerText.trim());
    document.getElementById('results').style.display = 'none';
    
    const notification = document.querySelector('.history-loaded-notification');
    if (notification) {
        notification.remove();
    }
    
    document.getElementById('patientHistoryFile').value = '';
    
    showNotification("Форма очищена!", "success");
    
    // ОБНОВЛЯЕМ СТАТУС ИСТОРИИ БОЛЕЗНИ (очищаем)
    if (typeof window.updateHistoryStatus === 'function') {
        window.updateHistoryStatus(false);
    }
}

function reloadPage() {
    location.reload();
}

function initializeTabsData() {
    const jsonTabs = jsonData['Описание GUI для ПС']?.['Шаблон']?.['Ввод наблюдений']?.['Вкладка'] || {};
    const tabsInJson = Object.keys(jsonTabs);
    const tempData = {};
    
    // Проверяем, какие вкладки из нашего шаблона есть в JSON
    for (const tabName in allTabsData) {
        // Для "Общие сведения" проверяем разные возможные названия
        if (tabName === "Общие сведения") {
            // Ищем соответствующую структуру в JSON
            if (tabsInJson.includes("Общие сведения") || 
                tabsInJson.includes("Сведения паспортные") ||
                tabsInJson.some(tab => tab.toLowerCase().includes('общие'))) {
                tempData[tabName] = { data: allTabsData[tabName].data || {} };
            }
        } else if (tabsInJson.includes(tabName)) {
            tempData[tabName] = { data: allTabsData[tabName].data || {} };
        }
    }
    allTabsData = tempData;
}

function showNotification(message, type = "success") {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.color = type === "success" ? "green" : "red";
    setTimeout(() => { notification.textContent = ''; }, 3000);
}

function renderTabs() {
    const tabHeaders = document.querySelector('.tab-headers');
    const tabContents = document.querySelector('.tab-contents');
    tabHeaders.innerHTML = '';
    tabContents.innerHTML = '';

    const jsonTabs = jsonData['Описание GUI для ПС']?.['Шаблон']?.['Ввод наблюдений']?.['Вкладка'] || {};
    const tabsToRender = Object.keys(jsonTabs);
    const availableTabs = Object.keys(allTabsData).filter(tab => {
        // Универсальная проверка для "Общие сведения"
        if (tab === "Общие сведения") {
            return tabsToRender.includes("Общие сведения") || 
                   tabsToRender.includes("Сведения паспортные") ||
                   tabsToRender.some(tabName => tabName.toLowerCase().includes('общие'));
        }
        return tabsToRender.includes(tab);
    });
    
    availableTabs.forEach(tabName => {
        const tabHeader = document.createElement('div');
        tabHeader.innerText = tabName;
        tabHeader.classList.add('tab-header');
        tabHeader.onclick = () => {
            document.querySelectorAll('.tab-header').forEach(header => header.classList.remove('active'));
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
    
    const jsonTabs = jsonData['Описание GUI для ПС']?.['Шаблон']?.['Ввод наблюдений']?.['Вкладка'] || {};
    
    if (tabName === "Общие сведения") {
        // Универсальная обработка вкладки "Общие сведения"
        renderGeneralInfoTab(jsonTabs, tabContents);
    } else {
        // Обработка остальных вкладок как обычно
        const tabStructure = jsonTabs[tabName] || {};
        renderJSON(tabStructure, tabContents, false, tabName);
    }
}

function renderGeneralInfoTab(jsonTabs, container) {
    // Ищем структуру "Общие сведения" или "Сведения паспортные"
    let generalStructure = jsonTabs["Общие сведения"];
    
    if (!generalStructure) {
        // Если нет "Общие сведения", ищем "Сведения паспортные"
        generalStructure = jsonTabs["Сведения паспортные"];
    }
    
    if (!generalStructure) {
        // Если все еще нет, ищем любую вкладку с "общие" в названии
        for (const tabKey in jsonTabs) {
            if (tabKey.toLowerCase().includes('общие') || 
                tabKey.toLowerCase().includes('паспортные')) {
                generalStructure = jsonTabs[tabKey];
                break;
            }
        }
    }
    
    if (generalStructure) {
        // УНИВЕРСАЛЬНЫЙ ПОДХОД: Если есть "Вершина меню", пропускаем ее
        if (generalStructure['Вершина меню']) {
            // Прямой рендеринг содержимого "Вершина меню" без самого заголовка
            renderJSON(generalStructure['Вершина меню'], container, false, "Общие сведения");
        } else {
            renderJSON(generalStructure, container, false, "Общие сведения");
        }
    } else {
        container.innerHTML = '<p style="color: #666; padding: 20px;">Нет данных для отображения</p>';
    }
}

// Универсальная функция для отображения вкладки "Общие сведения"
function renderGeneralInfoTab(jsonTabs, container) {
    // Ищем структуру "Общие сведения" или "Сведения паспортные"
    let generalStructure = jsonTabs["Общие сведения"];
    
    if (!generalStructure) {
        // Если нет "Общие сведения", ищем "Сведения паспортные"
        generalStructure = jsonTabs["Сведения паспортные"];
    }
    
    if (!generalStructure) {
        // Если все еще нет, ищем любую вкладку с "общие" в названии
        for (const tabKey in jsonTabs) {
            if (tabKey.toLowerCase().includes('общие') || 
                tabKey.toLowerCase().includes('паспортные')) {
                generalStructure = jsonTabs[tabKey];
                break;
            }
        }
    }
    
    if (generalStructure) {
        renderJSON(generalStructure, container, false, "Общие сведения");
    } else {
        container.innerHTML = '<p style="color: #666; padding: 20px;">Нет данных для отображения</p>';
    }
}

function findNestedObject(obj, targetKey) {
    if (obj && typeof obj === 'object') {
        if (targetKey in obj) return obj[targetKey];
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                const result = findNestedObject(obj[key], targetKey);
                if (result) return result;
            }
        }
    }
    return null;
}

function shouldRenderAsMenuVertex(key) {
    const menuVertices = [
        'Дневник наблюдений', 'Анамнез заболевания', 'Назначение лечения',
        'Жалобы', 'Осмотр', 'Опрос', 'Диагноз', 
        'Расширенный клинический диагноз', 'Исследования',
        'Инструментальные исследования', 'Идентификация', 'История болезни'
    ];
    
    const isUpperCase = key && key.length > 2 && key[0] === key[0].toUpperCase();
    const hasMultipleWords = key && key.split(' ').length >= 2;
    const isMedicalSection = key && (
        key.includes('диагноз') || 
        key.includes('опрос') || 
        key.includes('жалобы') ||
        key.includes('осмотр') ||
        key.includes('исследование') ||
        key.includes('лечение') ||
        key.includes('анамнез') ||
        key.includes('дневник') ||
        key.includes('расширенный') ||
        key.includes('клинический')
    );
    
    return menuVertices.includes(key) || (isUpperCase && hasMultipleWords && isMedicalSection);
}

function renderJSON(data, container, skipHeaders = false, tabName) {
    for (const key in data) {
        if (['Качественное значение', 'Числовое значение', 'единица измерения', 
             'место записи в документе', 'путь к узлу документа', 'Синонимы', 'синоним'].includes(key)) continue;

        const isGeneralInfoTab = tabName === "Общие сведения";
        
        // УНИВЕРСАЛЬНАЯ ПРОВЕРКА: пропускаем "Вершина меню" во вкладке "Общие сведения"
        if (isGeneralInfoTab && key === "Вершина меню") {
            // Если это "Вершина меню" в "Общих сведениях", рендерим содержимое напрямую
            renderJSON(data[key], container, skipHeaders, tabName);
            continue;
        }
        
        const isIntermediateNode = !isGeneralInfoTab && [
            'Вершина меню', 'Идентификация', 'Вкладка',
            'Шаблон', 'Описание GUI для ПС'
        ].includes(key);

        if (isIntermediateNode) {
            renderJSON(data[key], container, true, tabName);
            continue;
        }

        const div = document.createElement('div');
        if (!skipHeaders) div.classList.add('nested');

        if (typeof data[key] === 'object' && data[key] !== null) {
            if (key === 'Группа' && typeof data[key] === 'object') {
                renderGroup(data[key], div, tabName);
            } else if (key === "Анализ крови на гепатит С с определением генотипа" && 
                data[key]['Характеристика'] && Array.isArray(data[key]['Характеристика'])) {
                renderHepatitisAnalysis(data[key], key, div, tabName);
            } else if (data[key]['Характеристика'] && Array.isArray(data[key]['Характеристика'])) {
                renderCharacteristics(data[key], key, div, tabName);
            } else if (data[key]['Числовое значение']) {
                renderNumericField(data[key], key, div, tabName);
            } else if (data[key]['Качественное значение'] && !isGeneralInfoTab) {
                createMultiSelectDropdown(div, key, data[key]['Качественное значение'], key, tabName);
            } else if (data[key]['Качественное значение'] && isGeneralInfoTab) {
                renderGeneralSelect(data[key], key, div, tabName);
            } else if (data[key]['присутствие'] || data[key]['отсутствует']) {
                renderPresenceField(data[key], key, div, tabName);
            } else {
                // УНИВЕРСАЛЬНЫЙ ПОДХОД: определяем, нужно ли сворачивать
                const shouldCollapse = shouldRenderAsCollapsible(key, data[key], tabName);
                
                if (shouldCollapse) {
                    renderCollapsibleSection(data[key], key, div, tabName);
                } else {
                    if (!skipHeaders && Object.keys(data[key]).length > 0) {
                        const header = document.createElement('h4');
                        header.textContent = key;
                        header.style.marginBottom = '10px';
                        header.style.color = '#2c3e50';
                        header.style.borderBottom = '1px solid #ecf0f1';
                        header.style.paddingBottom = '5px';
                        div.appendChild(header);
                    }
                    renderJSON(data[key], div, skipHeaders, tabName);
                }
            }
        }
        
        if (div.childNodes.length > 0) container.appendChild(div);
    }
}

function shouldRenderAsCollapsible(key, data, tabName) {
    // Если это явно определенная секция, которая должна быть сворачиваемой
    const explicitCollapsibleKeys = [
        'Идентификация', 'Диагноз', // ДОБАВИЛИ для сворачивания
        'Оперативное вмешательство', 'Остеосинтез', 'Иммобилизация',
        'Осмотр', 'Расширенный клинический диагноз', 'Вмешательства',
        'Жалобы', 'Опрос', 'Анамнез заболевания', 'Исследования',
        'Инструментальные исследования', 'Назначение лечения', 'Дневник наблюдений',
        'Опрос', 'Анамнез заболевания', 'Исследования', 'Инструментальные исследования',
        'Назначение лечения', 'Дневник наблюдений'
    ];
    
    // ОСОБЫЙ СЛУЧАЙ: "Вершина меню" НИКОГДА не должна быть сворачиваемой
    if (key === "Вершина меню") return false;
    
    if (explicitCollapsibleKeys.includes(key)) return true;
    
    // Если объект содержит вложенные объекты и у него есть подполя
    if (typeof data !== 'object' || data === null) return false;
    
    const keys = Object.keys(data);
    
    // Проверяем, содержит ли объект сложную структуру
    let hasComplexStructure = false;
    let fieldCount = 0;
    
    for (const subKey in data) {
        if (typeof data[subKey] === 'object' && data[subKey] !== null) {
            if (data[subKey]['Числовое значение'] || data[subKey]['Качественное значение'] || 
                data[subKey]['Характеристика'] || data[subKey]['Группа'] || 
                data[subKey]['Наблюдение']) {
                hasComplexStructure = true;
            }
            
            const subKeys = Object.keys(data[subKey]);
            // Если вложенный объект содержит поля для отображения
            if (subKeys.some(k => !['место записи в документе', 'путь к узлу документа', 'Синонимы'].includes(k))) {
                fieldCount++;
            }
        }
    }
    
    // Сворачиваем, если есть хотя бы 2 поля или сложная структура
    return fieldCount >= 2 || hasComplexStructure || keys.length > 3;
}

function renderGeneralSelect(data, key, container, tabName) {
    const label = document.createElement('label');
    label.textContent = `${key}: `;
    label.style.fontWeight = 'bold';
    label.style.display = 'block';
    label.style.marginBottom = '5px';
    container.appendChild(label);

    const select = document.createElement('select');
    select.name = key;
    select.style.padding = '5px';
    select.style.border = '1px solid #ccc';
    select.style.borderRadius = '3px';
    select.style.minWidth = '250px';
    
    const emptyOption = document.createElement('option');
    emptyOption.value = "";
    emptyOption.textContent = "-- Выберите значение --";
    select.appendChild(emptyOption);
    
    const qualitativeValues = data['Качественное значение'];
    for (const qualitativeKey in qualitativeValues) {
        const optionElement = document.createElement('option');
        optionElement.value = qualitativeKey;
        optionElement.textContent = qualitativeKey;
        if (allTabsData[tabName].data[key] === qualitativeKey) optionElement.selected = true;
        select.appendChild(optionElement);
    }
    
    select.addEventListener('change', function() {
        allTabsData[tabName].data[key] = this.value;
    });
    
    container.appendChild(select);
}

function renderGroup(groupData, container, tabName) {
    const groupContainer = document.createElement('div');
    groupContainer.classList.add('group-container');
    groupContainer.style.marginBottom = '20px';
    
    for (const groupName in groupData) {
        const groupSection = document.createElement('div');
        groupSection.classList.add('group-section');
        groupSection.style.marginBottom = '15px';
        groupSection.style.padding = '10px';
        groupSection.style.border = '1px solid #e0e0e0';
        groupSection.style.borderRadius = '5px';
        groupSection.style.backgroundColor = '#f8f9fa';
        
        const groupHeader = document.createElement('h4');
        groupHeader.textContent = groupName;
        groupHeader.style.margin = '0 0 10px 0';
        groupHeader.style.color = '#2c3e50';
        groupHeader.style.cursor = 'pointer';
        
        const groupContent = document.createElement('div');
        groupContent.classList.add('group-content');
        
        groupHeader.addEventListener('click', function() {
            const isVisible = groupContent.style.display !== 'none';
            groupContent.style.display = isVisible ? 'none' : 'block';
            this.style.color = isVisible ? '#2c3e50' : '#3498db';
        });
        
        groupSection.appendChild(groupHeader);
        groupSection.appendChild(groupContent);
        
        // ОСОБАЯ ОБРАБОТКА ДЛЯ "ИСТОРИЯ БОЛЕЗНИ"
        if (groupName === "История болезни") {
            renderHistoryDiseaseField(groupData[groupName], groupName, groupContent, tabName);
        } else {
            renderGroupContent(groupData[groupName], groupContent, groupName, tabName);
        }
        
        groupContainer.appendChild(groupSection);
    }
    
    container.appendChild(groupContainer);
}
function renderGroupContent(groupData, container, groupName, tabName) {
    if (groupData && groupData['Наблюдение']) {
        for (const observationName in groupData['Наблюдение']) {
            const observationData = groupData['Наблюдение'][observationName];
            const fieldFullName = `${groupName}_${observationName}`;
            
            if (observationData && typeof observationData === 'object') {
                if (observationData['Числовое значение']) {
                    renderNumericField(observationData, observationName, container, tabName);
                    continue;
                }
                
                if (observationData['Качественное значение']) {
                    createMultiSelectDropdown(container, observationName, 
                        observationData['Качественное значение'], fieldFullName, tabName);
                    continue;
                }
                
                if (observationData['Характеристика'] && Array.isArray(observationData['Характеристика'])) {
                    renderCharacteristics(observationData, observationName, container, tabName);
                    continue;
                }
                
                renderObservation(observationData, observationName, container, tabName);
            }
        }
    }
}

function renderHistoryDiseaseField(data, fieldName, container, tabName) {
    const sectionDiv = document.createElement('div');
    sectionDiv.classList.add('history-disease-section');
    sectionDiv.style.marginBottom = '20px';
    sectionDiv.style.padding = '15px';
    sectionDiv.style.backgroundColor = '#f0f8ff';
    sectionDiv.style.border = '1px solid #90caf9';
    sectionDiv.style.borderRadius = '8px';
    
    // Поле ввода "номер документа" (если есть)
    if (data['поле ввода']) {
        const inputGroup = document.createElement('div');
        inputGroup.style.marginBottom = '20px';
        
        const inputLabel = document.createElement('label');
        inputLabel.textContent = `${fieldName} (${data['поле ввода']}):`;
        inputLabel.style.fontWeight = 'bold';
        inputLabel.style.display = 'block';
        inputLabel.style.marginBottom = '8px';
        inputLabel.style.color = '#2c3e50';
        inputGroup.appendChild(inputLabel);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.name = `${fieldName}_номер`;
        input.placeholder = `Введите ${data['поле ввода']}`;
        input.style.padding = '10px 12px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.fontSize = '14px';
        input.style.transition = 'all 0.3s ease';
        
        // Устанавливаем значение, если оно уже есть
        const fieldKey = `${fieldName}_номер`;
        if (allTabsData[tabName].data[fieldKey] !== undefined) {
            input.value = allTabsData[tabName].data[fieldKey];
        }
        
        input.addEventListener('input', function() {
            allTabsData[tabName].data[fieldKey] = this.value || null;
            console.log(`Номер документа сохранен: ${this.value}`);
        });
        
        input.addEventListener('focus', function() {
            this.style.borderColor = '#2196F3';
            this.style.boxShadow = '0 0 0 2px rgba(33, 150, 243, 0.1)';
        });
        
        input.addEventListener('blur', function() {
            this.style.borderColor = '#ccc';
            this.style.boxShadow = 'none';
        });
        
        inputGroup.appendChild(input);
        sectionDiv.appendChild(inputGroup);
    }
    
    // Рендерим поля "Наблюдение" (например, Национальность)
    if (data['Наблюдение']) {
        const observationSection = document.createElement('div');
        observationSection.style.marginTop = '15px';
        observationSection.style.paddingTop = '15px';
        observationSection.style.borderTop = '1px solid #e0e0e0';
        
        for (const observationName in data['Наблюдение']) {
            const observationData = data['Наблюдение'][observationName];
            const fieldFullName = `${fieldName}_${observationName}`;
            
            if (observationData && observationData['Качественное значение']) {
                createMultiSelectDropdown(observationSection, observationName, 
                    observationData['Качественное значение'], fieldFullName, tabName);
            }
        }
        
        if (observationSection.childNodes.length > 0) {
            sectionDiv.appendChild(observationSection);
        }
    }
    
    container.appendChild(sectionDiv);
}

function renderObservation(observationData, observationName, container, tabName) {
    const observationSection = document.createElement('div');
    observationSection.classList.add('observation-section');
    observationSection.style.marginBottom = '20px';
    observationSection.style.padding = '15px';
    observationSection.style.backgroundColor = '#fff';
    observationSection.style.border = '1px solid #ddd';
    observationSection.style.borderRadius = '5px';
    
    const observationHeader = document.createElement('h5');
    observationHeader.textContent = observationName;
    observationHeader.style.margin = '0 0 15px 0';
    observationHeader.style.color = '#34495e';
    observationHeader.style.fontSize = '16px';
    observationHeader.style.fontWeight = 'bold';
    observationHeader.style.borderBottom = '2px solid #3498db';
    observationHeader.style.paddingBottom = '5px';
    observationSection.appendChild(observationHeader);
    
    if (observationData && observationData['Характеристика'] && Array.isArray(observationData['Характеристика'])) {
        observationData['Характеристика'].forEach((characteristic, index) => {
            if (characteristic) {
                for (const charName in characteristic) {
                    const charData = characteristic[charName];
                    const fieldFullName = `${observationName}_${charName}`;
                    renderCharacteristicField(charData, charName, fieldFullName, observationSection, tabName);
                }
            }
        });
    } else if (observationData && typeof observationData === 'object') {
        for (const fieldName in observationData) {
            const fieldData = observationData[fieldName];
            const fieldFullName = `${observationName}_${fieldName}`;
            if (fieldData && fieldData['Качественное значение']) {
                createMultiSelectDropdown(observationSection, fieldName, fieldData['Качественное значение'], fieldFullName, tabName);
            }
        }
    }
    
    container.appendChild(observationSection);
}

function renderCharacteristicField(charData, charName, observationName, container, tabName) {
    const charDiv = document.createElement('div');
    charDiv.classList.add('characteristic-field');
    charDiv.style.marginBottom = '15px';
    
    const label = document.createElement('label');
    label.textContent = `${charName}: `;
    label.style.fontWeight = 'bold';
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.color = '#2c3e50';
    charDiv.appendChild(label);
    
    const fieldFullName = `${observationName}_${charName}`;
    
    if (charData && charData['Качественное значение']) {
        createMultiSelectDropdown(charDiv, '', charData['Качественное значение'], fieldFullName, tabName);
    } else if (charData && charData['Числовое значение']) {
        const input = document.createElement('input');
        input.type = 'number';
        input.name = fieldFullName;
        input.style.padding = '8px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';
        input.style.width = '250px';
        input.style.fontSize = '14px';
        
        if (allTabsData[tabName].data[fieldFullName] !== undefined) {
            input.value = allTabsData[tabName].data[fieldFullName];
        }
        
        input.addEventListener('input', function() {
            allTabsData[tabName].data[fieldFullName] = this.value ? Number(this.value) : null;
        });
        
        charDiv.appendChild(input);
        
        if (charData['Числовое значение']['единица измерения']) {
            const unitSpan = document.createElement('span');
            unitSpan.textContent = ` ${charData['Числовое значение']['единица измерения']}`;
            unitSpan.style.marginLeft = '8px';
            unitSpan.style.color = '#666';
            unitSpan.style.fontSize = '14px';
            charDiv.appendChild(unitSpan);
        }
    } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.name = fieldFullName;
        input.placeholder = `Введите значение для ${charName}`;
        input.style.padding = '8px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';
        input.style.width = '250px';
        input.style.fontSize = '14px';
        
        if (allTabsData[tabName].data[fieldFullName] !== undefined) {
            input.value = allTabsData[tabName].data[fieldFullName];
        }
        
        input.addEventListener('input', function() {
            allTabsData[tabName].data[fieldFullName] = this.value;
        });
        
        charDiv.appendChild(input);
    }
    
    container.appendChild(charDiv);
}

function renderHepatitisAnalysis(data, key, container, tabName) {
    const sectionDiv = document.createElement('div');
    sectionDiv.classList.add('characteristic-section');
    
    const header = document.createElement('h4');
    header.textContent = key;
    header.style.marginBottom = '10px';
    header.style.color = '#2c3e50';
    sectionDiv.appendChild(header);

    data['Характеристика'].forEach((characteristicGroup, index) => {
        if (characteristicGroup && characteristicGroup['Результат']) {
            const resultData = characteristicGroup['Результат'];
            if (resultData['Качественное значение']) {
                createMultiSelectDropdown(sectionDiv, "Результат", resultData['Качественное значение'], 
                    'Анализ крови на гепатит С с определением генотипа_Результат', tabName);
            }
        }
    });
    
    container.appendChild(sectionDiv);
}

function renderCharacteristics(data, key, container, tabName) {
    const sectionDiv = document.createElement('div');
    sectionDiv.classList.add('characteristic-section');
    
    const header = document.createElement('h4');
    header.textContent = key;
    header.style.marginBottom = '10px';
    header.style.color = '#2c3e50';
    sectionDiv.appendChild(header);

    data['Характеристика'].forEach((characteristicGroup, index) => {
        if (characteristicGroup) {
            const characteristicContainer = document.createElement('div');
            characteristicContainer.classList.add('characteristic-group');
            characteristicContainer.style.marginBottom = '15px';
            characteristicContainer.style.padding = '10px';
            characteristicContainer.style.border = '1px solid #ddd';
            characteristicContainer.style.borderRadius = '5px';
            
            for (const charName in characteristicGroup) {
                const charData = characteristicGroup[charName];
                const fieldFullName = `${key}_${charName}`;
                
                const charDiv = document.createElement('div');
                charDiv.classList.add('characteristic-field');
                charDiv.style.marginBottom = '15px';
                
                const label = document.createElement('label');
                label.textContent = `${charName}: `;
                label.style.fontWeight = 'bold';
                label.style.display = 'block';
                label.style.marginBottom = '8px';
                label.style.color = '#2c3e50';
                charDiv.appendChild(label);
                
                if (charData && charData['Качественное значение']) {
                    createMultiSelectDropdown(charDiv, '', charData['Качественное значение'], 
                        fieldFullName, tabName, key);
                } else if (charData && charData['Числовое значение']) {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.name = fieldFullName;
                    input.style.padding = '8px';
                    input.style.border = '1px solid #ccc';
                    input.style.borderRadius = '4px';
                    input.style.width = '250px';
                    input.style.fontSize = '14px';
                    
                    if (allTabsData[tabName].data[fieldFullName] !== undefined) {
                        input.value = allTabsData[tabName].data[fieldFullName];
                    }
                    
                    input.addEventListener('input', function() {
                        allTabsData[tabName].data[fieldFullName] = this.value ? Number(this.value) : null;
                        
                        if (!allTabsData[tabName].hierarchicalData) {
                            allTabsData[tabName].hierarchicalData = {};
                        }
                        if (!allTabsData[tabName].hierarchicalData[key]) {
                            allTabsData[tabName].hierarchicalData[key] = {};
                        }
                        allTabsData[tabName].hierarchicalData[key][charName] = this.value;
                    });
                    
                    charDiv.appendChild(input);
                    
                    if (charData['Числовое значение']['единица измерения']) {
                        const unitSpan = document.createElement('span');
                        unitSpan.textContent = ` ${charData['Числовое значение']['единица измерения']}`;
                        unitSpan.style.marginLeft = '8px';
                        unitSpan.style.color = '#666';
                        unitSpan.style.fontSize = '14px';
                        charDiv.appendChild(unitSpan);
                    }
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.name = fieldFullName;
                    input.placeholder = `Введите значение для ${charName}`;
                    input.style.padding = '8px';
                    input.style.border = '1px solid #ccc';
                    input.style.borderRadius = '4px';
                    input.style.width = '250px';
                    input.style.fontSize = '14px';
                    
                    if (allTabsData[tabName].data[fieldFullName] !== undefined) {
                        input.value = allTabsData[tabName].data[fieldFullName];
                    }
                    
                    input.addEventListener('input', function() {
                        allTabsData[tabName].data[fieldFullName] = this.value;
                    });
                    
                    charDiv.appendChild(input);
                }
                
                characteristicContainer.appendChild(charDiv);
            }
            
            sectionDiv.appendChild(characteristicContainer);
        }
    });
    
    container.appendChild(sectionDiv);
}

function renderNumericField(data, key, container, tabName) {
    const label = document.createElement('label');
    label.textContent = `${key}: `;
    label.style.fontWeight = 'bold';
    container.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.name = key;
    input.style.marginLeft = '10px';
    input.style.padding = '5px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '3px';
    
    if (data['Числовое значение']['единица измерения']) {
        input.placeholder = `Введите значение (${data['Числовое значение']['единица измерения']})`;
    } else {
        input.placeholder = `Введите значение`;
    }
    
    if (allTabsData[tabName].data[key] !== undefined) {
        input.value = allTabsData[tabName].data[key];
    }
    
    input.addEventListener('input', function() {
        allTabsData[tabName].data[key] = this.value ? Number(this.value) : null;
    });
    
    container.appendChild(input);

    if (data['Числовое значение']['единица измерения']) {
        const unitSpan = document.createElement('span');
        unitSpan.textContent = ` ${data['Числовое значение']['единица измерения']}`;
        unitSpan.style.marginLeft = '5px';
        unitSpan.style.color = '#666';
        container.appendChild(unitSpan);
    }
}

function renderPresenceField(data, key, container, tabName) {
    const wrapperDiv = document.createElement('div');
    wrapperDiv.classList.add('symptom-wrapper');
    wrapperDiv.style.marginBottom = '15px';
    wrapperDiv.style.padding = '10px';
    wrapperDiv.style.border = '1px solid #e0e0e0';
    wrapperDiv.style.borderRadius = '5px';
    wrapperDiv.style.backgroundColor = '#f9f9f9';
    
    const symptomLabel = document.createElement('label');
    symptomLabel.textContent = `${key}: `;
    symptomLabel.style.fontWeight = 'bold';
    symptomLabel.style.display = 'block';
    symptomLabel.style.marginBottom = '8px';
    wrapperDiv.appendChild(symptomLabel);
    
    const select = document.createElement('select');
    select.name = key;
    select.classList.add('presence-select');
    select.style.padding = '5px';
    select.style.border = '1px solid #ccc';
    select.style.borderRadius = '3px';
    select.style.minWidth = '150px';
    
    const optionPresent = document.createElement('option');
    optionPresent.value = 'присутствие';
    optionPresent.textContent = 'Присутствует';
    select.appendChild(optionPresent);
    
    const optionAbsent = document.createElement('option');
    optionAbsent.value = 'отсутствует';
    optionAbsent.textContent = 'Отсутствует';
    select.appendChild(optionAbsent);
    
    if (allTabsData[tabName].data[key] === 'присутствие' || allTabsData[tabName].data[key] === 'отсутствует') {
        select.value = allTabsData[tabName].data[key];
    }
    
    const characteristicsDiv = document.createElement('div');
    characteristicsDiv.classList.add('characteristics');
    characteristicsDiv.style.marginTop = '10px';
    characteristicsDiv.style.padding = '10px';
    characteristicsDiv.style.backgroundColor = '#fff';
    characteristicsDiv.style.border = '1px solid #ddd';
    characteristicsDiv.style.borderRadius = '3px';
    
    if (data['присутствие'] && data['присутствие']['Характеристика']) {
        characteristicsDiv.style.display = select.value === 'присутствие' ? 'block' : 'none';
        renderJSON(data['присутствие']['Характеристика'], characteristicsDiv, true, tabName);
    }
    
    select.addEventListener('change', function() {
        allTabsData[tabName].data[key] = this.value;
        if (characteristicsDiv) characteristicsDiv.style.display = this.value === 'присутствие' ? 'block' : 'none';
    });
    
    wrapperDiv.appendChild(select);
    if (characteristicsDiv.childNodes.length > 0) wrapperDiv.appendChild(characteristicsDiv);
    container.appendChild(wrapperDiv);
}

function renderCollapsibleSection(data, key, container, tabName) {
    const sectionDiv = document.createElement('div');
    sectionDiv.classList.add('collapsible-section');
    sectionDiv.style.marginBottom = '15px';
    
    // Определяем, является ли это диагностической секцией
    const isDiagnosisSection = key.includes("диагноз") || key.includes("Диагноз");
    const isExtendedDiagnosis = key === "Расширенный клинический диагноз" || 
        (key.includes("расширенный") && key.includes("диагноз"));
    
    const headerButton = document.createElement('button');
    headerButton.classList.add('section-header');
    headerButton.textContent = key;
    headerButton.style.width = '100%';
    headerButton.style.padding = '12px';
    
    // Разные цвета для разных типов секций
    if (isExtendedDiagnosis) {
        headerButton.style.backgroundColor = '#3498db'; // Синий для расширенных диагнозов
    } else if (isDiagnosisSection) {
        headerButton.style.backgroundColor = '#2ecc71'; // Зеленый для диагнозов
    } else if (key.includes('Вмешательства') || key.includes('Оперативное')) {
        headerButton.style.backgroundColor = '#e74c3c'; // Красный для вмешательств
    } else if (key.includes('Осмотр') || key.includes('Жалобы') || key.includes('Опрос')) {
        headerButton.style.backgroundColor = '#f39c12'; // Оранжевый для осмотра/жалоб
    } else if (key.includes('Исследования') || key.includes('Диагностика')) {
        headerButton.style.backgroundColor = '#9b59b6'; // Фиолетовый для исследований
    } else {
        headerButton.style.backgroundColor = '#3498db'; // Синий по умолчанию
    }
    
    headerButton.style.color = 'white';
    headerButton.style.border = 'none';
    headerButton.style.borderRadius = '5px';
    headerButton.style.cursor = 'pointer';
    headerButton.style.textAlign = 'left';
    headerButton.style.fontSize = '16px';
    headerButton.style.fontWeight = 'bold';
    headerButton.style.transition = 'background-color 0.3s ease';
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('section-content');
    contentDiv.style.display = 'none';
    contentDiv.style.padding = '15px';
    contentDiv.style.border = '1px solid #ddd';
    contentDiv.style.borderRadius = '0 0 5px 5px';
    contentDiv.style.backgroundColor = '#f8f9fa';
    contentDiv.style.maxHeight = '500px';
    contentDiv.style.overflowY = 'auto';
    contentDiv.style.transition = 'all 0.3s ease';
    
    // Добавляем иконку для состояния
    const icon = document.createElement('span');
    icon.textContent = '▶';
    icon.style.float = 'right';
    icon.style.transition = 'transform 0.3s ease';
    headerButton.appendChild(icon);
    
    headerButton.addEventListener('click', function() {
        const isVisible = contentDiv.style.display === 'block';
        
        if (isVisible) {
            contentDiv.style.display = 'none';
            icon.textContent = '▶';
            icon.style.transform = 'rotate(0deg)';
            
            // Возвращаем цвет фона
            if (isExtendedDiagnosis) {
                this.style.backgroundColor = '#3498db';
            } else if (isDiagnosisSection) {
                this.style.backgroundColor = '#2ecc71';
            } else if (key.includes('Вмешательства') || key.includes('Оперативное')) {
                this.style.backgroundColor = '#e74c3c';
            } else if (key.includes('Осмотр') || key.includes('Жалобы') || key.includes('Опрос')) {
                this.style.backgroundColor = '#f39c12';
            } else if (key.includes('Исследования') || key.includes('Диагностика')) {
                this.style.backgroundColor = '#9b59b6';
            } else {
                this.style.backgroundColor = '#3498db';
            }
        } else {
            contentDiv.style.display = 'block';
            icon.textContent = '▼';
            icon.style.transform = 'rotate(0deg)';
            
            // Темнее при открытии
            if (isExtendedDiagnosis) {
                this.style.backgroundColor = '#2980b9';
            } else if (isDiagnosisSection) {
                this.style.backgroundColor = '#27ae60';
            } else if (key.includes('Вмешательства') || key.includes('Оперативное')) {
                this.style.backgroundColor = '#c0392b';
            } else if (key.includes('Осмотр') || key.includes('Жалобы') || key.includes('Опрос')) {
                this.style.backgroundColor = '#d35400';
            } else if (key.includes('Исследования') || key.includes('Диагностика')) {
                this.style.backgroundColor = '#8e44ad';
            } else {
                this.style.backgroundColor = '#2980b9';
            }
            
            // Плавная прокрутка к контенту
            setTimeout(() => {
                contentDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    });
    
    // Рендерим содержимое
    if (key === 'Группа' && typeof data === 'object') {
        renderGroup(data, contentDiv, tabName);
    } else if (data && data['Наблюдение'] && typeof data['Наблюдение'] === 'object') {
        // Если есть Наблюдение, рендерим его
        renderJSON(data['Наблюдение'], contentDiv, true, tabName);
    } else if (key === 'Дата' && typeof data === 'object') {
        // Особый случай для Дата
        const dateContent = document.createElement('div');
        dateContent.style.padding = '10px';
        dateContent.style.backgroundColor = '#fff';
        dateContent.style.borderRadius = '5px';
        dateContent.style.border = '1px solid #e0e0e0';
        
        const dateLabel = document.createElement('div');
        dateLabel.textContent = '📅 Дата:';
        dateLabel.style.fontWeight = 'bold';
        dateLabel.style.marginBottom = '10px';
        dateLabel.style.color = '#2c3e50';
        dateContent.appendChild(dateLabel);
        
        renderJSON(data, dateContent, true, tabName);
        contentDiv.appendChild(dateContent);
    } else {
        renderJSON(data, contentDiv, true, tabName);
    }
    
    sectionDiv.appendChild(headerButton);
    sectionDiv.appendChild(contentDiv);
    container.appendChild(sectionDiv);
}

function renderNestedCharacteristics(data, container, tabName) {
    const charContainer = document.createElement('div');
    charContainer.classList.add('nested-characteristics');
    charContainer.style.marginLeft = '20px';
    charContainer.style.padding = '10px';
    charContainer.style.borderLeft = '2px solid #3498db';
    renderJSON(data, charContainer, true, tabName);
    container.appendChild(charContainer);
}

function createMultiSelectDropdown(container, labelText, options, fieldName, tabName, parentField = null) {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.classList.add('multi-select-dropdown');
    dropdownContainer.style.marginBottom = '15px';
    dropdownContainer.style.position = 'relative';

    if (labelText && labelText.trim() !== '') {
        const label = document.createElement('label');
        label.textContent = `${labelText}: `;
        label.style.fontWeight = 'bold';
        label.style.display = 'block';
        label.style.marginBottom = '8px';
        label.style.cursor = 'pointer';
        dropdownContainer.appendChild(label);
    }

    const dropdownButton = document.createElement('button');
    dropdownButton.type = 'button';
    dropdownButton.classList.add('dropdown-button');
    dropdownButton.style.width = '100%';
    dropdownButton.style.padding = '10px 15px';
    dropdownButton.style.border = '1px solid #ddd';
    dropdownButton.style.borderRadius = '6px';
    dropdownButton.style.backgroundColor = 'white';
    dropdownButton.style.textAlign = 'left';
    dropdownButton.style.cursor = 'pointer';
    dropdownButton.style.display = 'flex';
    dropdownButton.style.justifyContent = 'space-between';
    dropdownButton.style.alignItems = 'center';
    dropdownButton.style.transition = 'all 0.3s ease';

    const buttonText = document.createElement('span');
    buttonText.textContent = 'Выберите значения';
    buttonText.style.color = '#666';
    dropdownButton.appendChild(buttonText);

    const arrow = document.createElement('span');
    arrow.textContent = '▼';
    arrow.style.transition = 'transform 0.3s ease';
    arrow.style.fontSize = '12px';
    dropdownButton.appendChild(arrow);

    const optionsList = document.createElement('div');
    optionsList.classList.add('dropdown-options');
    optionsList.style.display = 'none';
    optionsList.style.position = 'absolute';
    optionsList.style.top = '100%';
    optionsList.style.left = '0';
    optionsList.style.right = '0';
    optionsList.style.backgroundColor = 'white';
    optionsList.style.border = '1px solid #ddd';
    optionsList.style.borderTop = 'none';
    optionsList.style.borderRadius = '0 0 6px 6px';
    optionsList.style.maxHeight = '200px';
    optionsList.style.overflowY = 'auto';
    optionsList.style.zIndex = '1000';
    optionsList.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';

    let currentValue;
    if (parentField) {
        if (allTabsData[tabName].hierarchicalData && 
            allTabsData[tabName].hierarchicalData[parentField] &&
            allTabsData[tabName].hierarchicalData[parentField][fieldName]) {
            currentValue = allTabsData[tabName].hierarchicalData[parentField][fieldName];
        } else {
            const flatFieldName = `${parentField}_${fieldName}`;
            currentValue = allTabsData[tabName].data[flatFieldName] || [];
        }
    } else {
        currentValue = allTabsData[tabName].data[fieldName] || [];
    }
    
    const selectedValues = Array.isArray(currentValue) ? currentValue : 
                         currentValue ? [currentValue] : [];

    for (const optionKey in options) {
        const optionDiv = document.createElement('label');
        optionDiv.style.display = 'flex';
        optionDiv.style.alignItems = 'center';
        optionDiv.style.padding = '8px 12px';
        optionDiv.style.cursor = 'pointer';
        optionDiv.style.transition = 'background-color 0.2s ease';
        optionDiv.style.borderBottom = '1px solid #f0f0f0';

        optionDiv.addEventListener('mouseenter', function() { this.style.backgroundColor = '#f8f9fa'; });
        optionDiv.addEventListener('mouseleave', function() { this.style.backgroundColor = 'transparent'; });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = optionKey;
        checkbox.style.marginRight = '10px';
        checkbox.style.cursor = 'pointer';
        if (selectedValues.includes(optionKey)) checkbox.checked = true;

        const optionText = document.createElement('span');
        optionText.textContent = optionKey;
        optionText.style.flex = '1';

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(optionText);
        optionsList.appendChild(optionDiv);
    }

    function updateButtonText() {
        const checkedBoxes = optionsList.querySelectorAll('input[type="checkbox"]:checked');
        if (checkedBoxes.length === 0) {
            buttonText.textContent = 'Выберите значения';
            buttonText.style.color = '#666';
        } else if (checkedBoxes.length === 1) {
            buttonText.textContent = checkedBoxes[0].value;
            buttonText.style.color = '#333';
        } else {
            buttonText.textContent = `Выбрано: ${checkedBoxes.length}`;
            buttonText.style.color = '#333';
        }
    }

    function saveSelectedValues() {
        const checkedBoxes = optionsList.querySelectorAll('input[type="checkbox"]:checked');
        const selected = Array.from(checkedBoxes).map(cb => cb.value);
        
        if (parentField) {
            if (!allTabsData[tabName].hierarchicalData) {
                allTabsData[tabName].hierarchicalData = {};
            }
            if (!allTabsData[tabName].hierarchicalData[parentField]) {
                allTabsData[tabName].hierarchicalData[parentField] = {};
            }
            allTabsData[tabName].hierarchicalData[parentField][fieldName] = selected;
            
            const flatFieldName = `${parentField}_${fieldName}`;
            allTabsData[tabName].data[flatFieldName] = selected.length > 0 ? selected : null;
        } else {
            allTabsData[tabName].data[fieldName] = selected.length > 0 ? selected : null;
            
            if (!allTabsData[tabName].hierarchicalData) {
                allTabsData[tabName].hierarchicalData = {};
            }
            allTabsData[tabName].hierarchicalData[fieldName] = selected;
        }
    }

    optionsList.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            updateButtonText();
            saveSelectedValues();
        }
    });

    dropdownButton.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = optionsList.style.display === 'block';
        if (isOpen) {
            optionsList.style.display = 'none';
            dropdownButton.style.borderRadius = '6px';
            dropdownButton.style.borderBottom = '1px solid #ddd';
            arrow.style.transform = 'rotate(0deg)';
        } else {
            optionsList.style.display = 'block';
            dropdownButton.style.borderRadius = '6px 6px 0 0';
            dropdownButton.style.borderBottom = '1px solid #ddd';
            arrow.style.transform = 'rotate(180deg)';
        }
    });

    document.addEventListener('click', function(e) {
        if (!dropdownContainer.contains(e.target)) {
            optionsList.style.display = 'none';
            dropdownButton.style.borderRadius = '6px';
            dropdownButton.style.borderBottom = '1px solid #ddd';
            arrow.style.transform = 'rotate(0deg)';
        }
    });

    updateButtonText();
    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(optionsList);
    container.appendChild(dropdownContainer);

    const lastOption = optionsList.lastElementChild;
    if (lastOption) lastOption.style.borderBottom = 'none';
}

function loadPatientHistory(patientHistory) {
    try {
        clearForm();
        
        const historyData = patientHistory["История болезни или наблюдений v.4"];
        if (!historyData) throw new Error("Неверный формат файла истории болезни");
        
        const ibId = Object.keys(historyData)[0];
        const patientRecord = historyData[ibId];
        if (!patientRecord || !patientRecord["Данные"]) throw new Error("Отсутствуют данные пациента в файле");
        
        const patientData = patientRecord["Данные"];
        
        for (const tabName in allTabsData) {
            allTabsData[tabName].data = {};
        }
        
        for (const tabName in patientData) {
            // Маппинг старых названий на новые
            let mappedTabName = tabName;
            if (tabName === "Сведения паспортные" || tabName === "Общие сведения") {
                mappedTabName = "Общие сведения";
            } else if (allTabsData[tabName]) {
                mappedTabName = tabName;
            }
            
            if (allTabsData[mappedTabName]) {
                const tabData = patientData[tabName];
                
                for (const fieldName in tabData) {
                    if (fieldName === "Общие данные") continue;
                    
                    const fieldObj = tabData[fieldName];
                    
                    if (fieldObj && fieldObj["Значение"] !== undefined) {
                        let value = fieldObj["Значение"];
                        
                        if (value === null || value === undefined || value === '') continue;
                        
                        if (fieldName === "Клинический диагноз" || fieldName.includes("диагноз")) {
                            if (Array.isArray(value)) {
                                allTabsData[mappedTabName].data[fieldName] = value[0];
                            } else {
                                allTabsData[mappedTabName].data[fieldName] = String(value);
                            }
                        } else {
                            if (fieldObj["Тип"] === "Множественный выбор" && typeof value === 'string') {
                                value = value.split(',').map(item => item.trim()).filter(item => item);
                            }
                            allTabsData[mappedTabName].data[fieldName] = value;
                        }
                    }
                }
                
                if (tabData["Общие данные"]) {
                    const generalData = tabData["Общие данные"];
                    
                    for (const fieldName in generalData) {
                        const fieldObj = generalData[fieldName];
                        
                        if (fieldObj && fieldObj["Значение"] !== undefined) {
                            let value = fieldObj["Значение"];
                            
                            if (value === null || value === undefined || value === '') continue;
                            
                            if (fieldObj["Тип"] === "Множественный выбор" && typeof value === 'string') {
                                value = value.split(',').map(item => item.trim()).filter(item => item);
                            }
                            
                            allTabsData[mappedTabName].data[fieldName] = value;
                        }
                    }
                }
            }
        }
        
        window.allTabsData = allTabsData;
        
        const activeTab = document.querySelector('.tab-header.active');
        if (activeTab) renderTabContent(activeTab.innerText.trim());
        
        showNotification("Данные истории болезни загружены в форму!", "success");
        
    } catch (error) {
        showNotification("Ошибка загрузки истории болезни: " + error.message, "error");
        console.error("Ошибка загрузки:", error);
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
    const structuredData = {};

    // Множество для отслеживания уже сохранённых полей
    const savedFields = new Set();

    // Создаем структуру для каждого раздела
    for (const tabName in allTabsData) {
        const tabData = allTabsData[tabName];
        
        // Пропускаем пустые разделы
        if ((!tabData.hierarchicalData || Object.keys(tabData.hierarchicalData).length === 0) &&
            (!tabData.data || Object.keys(tabData.data).length === 0)) {
            continue;
        }
        
        const sectionData = {};
        let hasDataInSection = false;
        
        // ===== 1. Сохраняем ИЕРАРХИЧЕСКИЕ данные (основной источник) =====
        if (tabData.hierarchicalData && Object.keys(tabData.hierarchicalData).length > 0) {
            for (const parentField in tabData.hierarchicalData) {
                const parentData = tabData.hierarchicalData[parentField];
                
                if (!parentData || Object.keys(parentData).length === 0) {
                    continue;
                }
                
                // Проверяем, не сохраняли ли уже это поле
                const parentKey = `${tabName}_${parentField}`;
                if (savedFields.has(parentKey)) {
                    continue;
                }
                savedFields.add(parentKey);
                
                // Если это объект с подполями
                if (typeof parentData === 'object' && !Array.isArray(parentData)) {
                    const subSectionData = {};
                    let hasSubData = false;
                    
                    for (const subField in parentData) {
                        const subValue = parentData[subField];
                        
                        if (subValue === null || subValue === undefined || 
                            (Array.isArray(subValue) && subValue.length === 0)) {
                            continue;
                        }
                        
                        // Проверяем, не сохраняли ли уже это подполе
                        const subKey = `${tabName}_${parentField}_${subField}`;
                        if (savedFields.has(subKey)) {
                            continue;
                        }
                        savedFields.add(subKey);
                        
                        let subFieldType = "Текстовое";
                        let subFieldValueStr;
                        
                        if (Array.isArray(subValue)) {
                            subFieldType = "Множественный выбор";
                            subFieldValueStr = subValue.join(', ');
                        } else if (typeof subValue === 'number') {
                            subFieldType = "Числовое";
                            subFieldValueStr = String(subValue);
                        } else if (typeof subValue === 'boolean') {
                            subFieldType = "Логическое";
                            subFieldValueStr = subValue ? "да" : "нет";
                        } else {
                            subFieldType = "Текстовое";
                            subFieldValueStr = String(subValue);
                        }
                        
                        subSectionData[subField] = {
                            "Тип": subFieldType,
                            "Значение": subFieldValueStr
                        };
                        hasSubData = true;
                    }
                    
                    if (hasSubData) {
                        sectionData[parentField] = subSectionData;
                        hasDataInSection = true;
                    }
                } else {
                    // Простое значение
                    const value = parentData;
                    let fieldType = "Текстовое";
                    let fieldValueStr;
                    
                    if (Array.isArray(value)) {
                        fieldType = "Множественный выбор";
                        fieldValueStr = value.join(', ');
                    } else if (typeof value === 'number') {
                        fieldType = "Числовое";
                        fieldValueStr = String(value);
                    } else if (typeof value === 'boolean') {
                        fieldType = "Логическое";
                        fieldValueStr = value ? "да" : "нет";
                    } else {
                        fieldType = "Текстовое";
                        fieldValueStr = String(value);
                    }
                    
                    sectionData[parentField] = {
                        "Тип": fieldType,
                        "Значение": fieldValueStr
                    };
                    hasDataInSection = true;
                }
            }
        }
        
        // ===== 2. Сохраняем ПЛОСКИЕ данные (только те, что ещё не сохранены) =====
        for (const fieldName in tabData.data) {
            const fieldValue = tabData.data[fieldName];
            
            if (fieldValue === null || fieldValue === undefined || 
                (Array.isArray(fieldValue) && fieldValue.length === 0)) {
                continue;
            }
            
            // Проверяем, не сохранено ли уже это поле через иерархические данные
            const flatKey = `${tabName}_${fieldName}`;
            if (savedFields.has(flatKey)) {
                console.log(`⚠️ Пропускаем дубль: ${fieldName}`);
                continue;
            }
            
            let fieldType = "Текстовое";
            let fieldValueStr;
            
            if (Array.isArray(fieldValue)) {
                fieldType = "Множественный выбор";
                fieldValueStr = fieldValue.join(', ');
            } else if (typeof fieldValue === 'number') {
                fieldType = "Числовое";
                fieldValueStr = String(fieldValue);
            } else if (typeof fieldValue === 'boolean') {
                fieldType = "Логическое";
                fieldValueStr = fieldValue ? "да" : "нет";
            } else {
                fieldType = "Текстовое";
                fieldValueStr = String(fieldValue);
            }
            
            // Проверяем, не является ли это поле частью иерархических данных
            // Например, "Терапия в настоящее время" может быть и плоским, и иерархическим
            const isPartOfHierarchy = tabData.hierarchicalData && 
                (tabData.hierarchicalData[fieldName] !== undefined);
            
            if (!isPartOfHierarchy) {
                sectionData[fieldName] = {
                    "Тип": fieldType,
                    "Значение": fieldValueStr
                };
                hasDataInSection = true;
                savedFields.add(flatKey);
            }
        }
        
        // Сохраняем раздел только если есть данные
        if (hasDataInSection) {
            structuredData[tabName] = sectionData;
        }
    }
    
    // Проверяем, есть ли вообще данные
    if (Object.keys(structuredData).length === 0) {
        showNotification("Нет данных для сохранения!", "error");
        return null;
    }
    
    // Добавляем структурированные данные в вывод
    ibData["Данные"] = structuredData;
    
    // Создаем и скачиваем файл
    const jsonOutput = JSON.stringify(outputData, null, 2);
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
    console.log("Сохраненные данные:", structuredData);
    return structuredData;
}

// Обновим также функцию loadPatientHistory для правильной загрузки
function loadPatientHistory(patientHistory) {
    try {
        clearForm();
        
        const historyData = patientHistory["История болезни или наблюдений v.4"];
        if (!historyData) throw new Error("Неверный формат файла истории болезни");
        
        const ibId = Object.keys(historyData)[0];
        const patientRecord = historyData[ibId];
        if (!patientRecord || !patientRecord["Данные"]) throw new Error("Отсутствуют данные пациента в файле");
        
        const patientData = patientRecord["Данные"];
        
        for (const tabName in allTabsData) {
            allTabsData[tabName].data = {};
            allTabsData[tabName].hierarchicalData = {};
        }
        
        for (const tabName in patientData) {
            // Определяем, к какой вкладке относятся данные
            let targetTabName = null;
            
            // Проверяем соответствие вкладкам
            for (const availableTab in allTabsData) {
                if (tabName === availableTab || 
                    (tabName.includes("паспортные") && availableTab === "Общие сведения") ||
                    (tabName.includes("состояние") && availableTab === "Сведения о состоянии") ||
                    (tabName.includes("динамике") && availableTab === "Сведения в динамике")) {
                    targetTabName = availableTab;
                    break;
                }
            }
            
            if (!targetTabName) {
                console.log(`Неизвестная вкладка: ${tabName}, пропускаем`);
                continue;
            }
            
            const tabData = patientData[tabName];
            if (!tabData) {
                console.log(`Нет данных во вкладке ${tabName}`);
                continue;
            }
            
            // ОБНОВЛЕНО: загружаем данные напрямую, без "Общие данные"
            for (const fieldName in tabData) {
                const fieldObj = tabData[fieldName];
                
                if (fieldObj && fieldObj["Значение"] !== undefined) {
                    let value = fieldObj["Значение"];
                    
                    if (value === null || value === undefined || value === '') continue;
                    
                    // Обрабатываем значение в зависимости от типа
                    if (fieldObj["Тип"] === "Множественный выбор" && typeof value === 'string') {
                        value = value.split(',').map(item => item.trim()).filter(item => item);
                    } else if (fieldObj["Тип"] === "Числовое") {
                        value = Number(value);
                    } else if (fieldObj["Тип"] === "Логическое") {
                        value = value === "да";
                    }
                    
                    // Если значение - объект (иерархические данные)
                    if (typeof fieldObj["Значение"] === 'object' && fieldObj["Значение"] !== null) {
                        if (!allTabsData[targetTabName].hierarchicalData) {
                            allTabsData[targetTabName].hierarchicalData = {};
                        }
                        allTabsData[targetTabName].hierarchicalData[fieldName] = value;
                    } else {
                        // Простые данные
                        allTabsData[targetTabName].data[fieldName] = value;
                    }
                }
            }
        }
        
        window.allTabsData = allTabsData;
        console.log("Загруженные данные:", allTabsData);
        
        // Обновляем отображение
        const activeTab = document.querySelector('.tab-header.active');
        if (activeTab) renderTabContent(activeTab.innerText.trim());
        
        showNotification("Данные истории болезни загружены в форму!", "success");
        
    } catch (error) {
        showNotification("Ошибка загрузки истории болезни: " + error.message, "error");
        console.error("Ошибка загрузки:", error);
    }
}

function getFieldInfo(value) {
    const result = {};
    
    if (Array.isArray(value)) {
        result["Тип"] = "Множественный выбор";
        result["Значение"] = value.join(', ');
    } else if (typeof value === 'number') {
        result["Тип"] = "Числовое";
        result["Значение"] = String(value);
    } else if (typeof value === 'boolean') {
        result["Тип"] = "Логическое";
        result["Значение"] = value ? "да" : "нет";
    } else {
        result["Тип"] = "Текстовое";
        result["Значение"] = String(value);
    }
    
    return result;
}

// Добавляем глобальные функции для AI интеграции
function extract_patient_data() {
    const patient_data = {};
    
    for (const tabName in allTabsData) {
        const tabData = allTabsData[tabName];
        
        // Добавляем простые данные
        for (const fieldName in tabData.data) {
            const fieldValue = tabData.data[fieldName];
            
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') continue;
            
            // Преобразуем массивы в строки
            if (Array.isArray(fieldValue)) {
                if (fieldValue.length === 1) {
                    patient_data[fieldName] = fieldValue[0];
                } else if (fieldValue.length > 0) {
                    patient_data[fieldName] = fieldValue.join(', ');
                }
            } else {
                patient_data[fieldName] = fieldValue;
            }
        }
        
        // Добавляем иерархические данные
        if (tabData.hierarchicalData) {
            for (const parentField in tabData.hierarchicalData) {
                const parentData = tabData.hierarchicalData[parentField];
                
                if (typeof parentData === 'object' && !Array.isArray(parentData)) {
                    // Если это объект, добавляем каждое поле отдельно
                    for (const subField in parentData) {
                        const subValue = parentData[subField];
                        if (subValue !== null && subValue !== undefined && subValue !== '') {
                            const fieldName = `${parentField}_${subField}`;
                            patient_data[fieldName] = subValue;
                        }
                    }
                } else {
                    // Простое значение
                    if (parentData !== null && parentData !== undefined && parentData !== '') {
                        patient_data[parentField] = parentData;
                    }
                }
            }
        }
    }
    
    console.log("Извлеченные данные для анализа:", patient_data);
    return patient_data;
}

// Функция для отслеживания ввода данных в форму
function setupFormInputTracking() {
    // Эта функция будет вызываться при любом вводе данных
    function trackFormInput() {
        // Проверяем, есть ли хоть какие-то данные в форме
        let hasData = false;
        
        for (const tabName in allTabsData) {
            const tabData = allTabsData[tabName];
            
            if (tabData.data && Object.keys(tabData.data).length > 0) {
                // Проверяем не пустые ли данные
                for (const fieldName in tabData.data) {
                    const value = tabData.data[fieldName];
                    if (value !== null && value !== undefined && value !== '' && 
                        !(Array.isArray(value) && value.length === 0)) {
                        hasData = true;
                        break;
                    }
                }
            }
            
            if (hasData) break;
        }
        
        // Обновляем статус истории болезни
        if (typeof window.updateHistoryStatus === 'function') {
            window.updateHistoryStatus(hasData);
        }
    }
    
    // Добавляем обработчики событий ко всем полям ввода
    document.addEventListener('input', function(e) {
        if (e.target.matches('input, select, textarea')) {
            setTimeout(trackFormInput, 100);
        }
    });
    
    // Также отслеживаем изменения в мультиселектах
    document.addEventListener('change', function(e) {
        if (e.target.matches('input[type="checkbox"], select')) {
            setTimeout(trackFormInput, 100);
        }
    });
}

// Вызываем при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(setupFormInputTracking, 1000);
});

window.showNotification = showNotification;
window.extract_patient_data = extract_patient_data;

// Добавляем стили для уведомления
const style = document.createElement('style');
style.textContent = `
    .history-loaded-notification {
        animation: fadeIn 0.3s ease-in;
    }
    
    #clearHistoryBtn:hover {
        opacity: 0.8;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

// AI РЕКОМЕНДАЦИИ
document.addEventListener('DOMContentLoaded', function() {
    const aiButton = document.getElementById('aiRecommendationsButton');
    const aiLoading = document.getElementById('aiLoading');
    
    if (aiButton) {
        console.log('✅ AI кнопка найдена');
        
        aiButton.addEventListener('click', async function() {
            console.log('🟢 AI кнопка нажата!');
            
            try {
                // Показать индикатор загрузки
                if (aiLoading) {
                    aiLoading.style.display = 'block';
                }
                aiButton.disabled = true;
                aiButton.textContent = '🤖 Запрос к AI...';
                
                // Получаем данные пациента
                const patientData = window.extract_patient_data ? window.extract_patient_data() : {};
                console.log('📊 Данные пациента для AI:', patientData);
                
                // Если нет данных, используем тестовые
                let diagnosis = "Неизвестный диагноз";
                let dataToSend = {};
                
                if (Object.keys(patientData).length > 0) {
                    // Получаем диагноз
                    diagnosis = window.extractPatientDiagnosis ? 
                        window.extractPatientDiagnosis(patientData) : 
                        patientData["Клинический диагноз"] || 
                        patientData["Диагноз"] || 
                        patientData["Основной диагноз"] || 
                        "Неизвестный диагноз";
                    
                    dataToSend = patientData;
                } else {
                    // Тестовые данные
                    diagnosis = "Мигрень";
                    dataToSend = {
                        "Клинический диагноз": "Мигрень",
                        "Возраст": "35",
                        "Пол": "Женский",
                        "Симптомы": "Головная боль, тошнота"
                    };
                    console.log('⚠️ Используем тестовые данные');
                }
                
                console.log(`🤖 Отправляем AI запрос для диагноза: ${diagnosis}`);
                
                // Отправляем запрос к AI API
                const response = await fetch('http://localhost:5001/api/get_recommendations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        patient_data: dataToSend,
                        diagnosis: diagnosis
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
                }
                
                const result = await response.json();
                console.log('🎉 AI ответ получен:', result);
                
                if (result.success) {
                    // Показываем результат
                    showAIResults(result.recommendation, dataToSend);
                    window.showNotification('✅ AI-рекомендации получены!', 'success');
                } else {
                    throw new Error(result.error || 'Неизвестная ошибка AI');
                }
                
            } catch (error) {
                console.error('❌ Ошибка получения AI-рекомендаций:', error);
                
                // Показываем подробную ошибку
                let errorMessage = `AI ошибка: ${error.message}`;
                
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    errorMessage = '❌ AI сервер не отвечает! Проверьте:\n1. Запущен ли Python сервер?\n2. Откройте http://localhost:5001/api/health';
                }
                
                window.showNotification(errorMessage, 'error');
                
                // Показываем альтернативное сообщение
                const patientData = window.extract_patient_data ? window.extract_patient_data() : {};
                const diagnosis = window.extractPatientDiagnosis ? 
                    window.extractPatientDiagnosis(patientData) : 
                    "Неизвестный диагноз";
                
                showAIResults(getFallbackRecommendation(diagnosis), patientData);
                
            } finally {
                // Скрываем индикатор загрузки
                if (aiLoading) {
                    aiLoading.style.display = 'none';
                }
                aiButton.disabled = false;
                aiButton.textContent = '🤖 Получить AI-рекомендации';
            }
        });
    } else {
        console.error('❌ AI кнопка не найдена!');
    }
});

// Функция для отображения AI результатов
function showAIResults(aiText, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (!resultsDiv || !analysisResultsDiv) {
        console.error('❌ Не найдены элементы для отображения результатов');
        return;
    }
    
    // Форматируем текст
    const formattedText = formatAIText(aiText);
    
    // Создаем HTML
    const htmlContent = `
        <div class="analysis-result" style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <div style="font-size: 2em; margin-right: 15px;">🤖</div>
                    <div>
                        <h2 style="color: #3498db; margin: 0; padding: 0;">AI-рекомендации по лечению</h2>
                        <p style="color: #666; margin: 5px 0 0 0;">Сгенерировано моделью mistral:7b</p>
                    </div>
                </div>
                
                <div style="
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border-left: 4px solid #3498db;
                ">
                    ${formattedText}
                </div>
                
                <div style="
                    margin-top: 20px;
                    padding: 15px;
                    background: #fff;
                    border: 1px solid #e9ecef;
                    border-radius: 5px;
                ">
                    <h4 style="color: #2c3e50; margin-top: 0;">📊 Данные пациента для AI-анализа:</h4>
                    <div style="
                        max-height: 200px;
                        overflow-y: auto;
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 12px;
                    ">
                        <pre style="margin: 0;">${JSON.stringify(patientData, null, 2)}</pre>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="window.analyzeData()" style="
                        background-color: #2ecc71;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        margin-right: 10px;
                    ">
                        📊 Вернуться к структурированному анализу
                    </button>
                    
                    <button onclick="location.reload()" style="
                        background-color: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        🔄 Обновить рекомендации
                    </button>
                </div>
            </div>
        </div>
    `;
    
    analysisResultsDiv.innerHTML = htmlContent;
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// Улучшенная функция форматирования AI текста
function formatAIText(text) {
    if (!text) return '<p>Нет рекомендаций</p>';
    
    console.log("📝 Исходный текст от AI:", text.substring(0, 200) + "...");
    
    // Функция для исправления регистра
    const fixTextCase = (str) => {
        // Разбиваем на предложения
        return str
            .replace(/([.!?])\s+/g, '$1|')
            .split('|')
            .map(sentence => {
                if (!sentence.trim()) return sentence;
                
                // Ищем начало предложения (после точки, восклицательного или вопросительного знака)
                let result = sentence.trim();
                
                // Если предложение начинается с буквы в верхнем регистре или содержит только заглавные
                if (result.length > 0) {
                    // Проверяем, не является ли это аббревиатурой или специальным термином
                    const commonUpperTerms = ['ИБС', 'АПФ', 'БРА', 'мм рт.ст.', 'мг', 'сутки'];
                    const hasCommonUpper = commonUpperTerms.some(term => 
                        result.toUpperCase().includes(term.toUpperCase())
                    );
                    
                    if (!hasCommonUpper) {
                        // Преобразуем первую букву предложения в заглавную, остальные - в строчные
                        result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
                    }
                }
                
                return result;
            })
            .join(' ');
    };
    
    // Обрабатываем текст построчно
    let lines = text.split('\n');
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Пропускаем пустые строки
        if (line.trim() === '') {
            processedLines.push(line);
            continue;
        }
        
        // 1. Обрабатываем заголовки (# ## ###)
        if (line.match(/^#{1,3}\s+/)) {
            const match = line.match(/^(#{1,3})\s+(.*)$/);
            if (match) {
                const hashes = match[1];
                let content = match[2];
                
                // Преобразуем заголовок в нормальный регистр
                content = content
                    .split(' ')
                    .map(word => {
                        // Сохраняем аббревиатуры
                        if (['ИБС', 'АПФ', 'БРА', 'ВИЧ', 'СПИД', 'COVID'].includes(word.toUpperCase())) {
                            return word.toUpperCase();
                        }
                        // Сохраняем слова в кавычках
                        if (word.startsWith('"') || word.startsWith("'") || word.startsWith('«')) {
                            return word;
                        }
                        // Преобразуем обычные слова: первая буква заглавная, остальные строчные
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    })
                    .join(' ');
                
                processedLines.push(`${hashes} ${content}`);
                continue;
            }
        }
        
        // 2. Обрабатываем пункты списка (начинающиеся с •, -, цифры.)
        if (line.match(/^[\s]*[•\-*\d]\.?\s+/)) {
            // Находим начало пункта
            const match = line.match(/^([\s]*[•\-*\d]\.?\s+)(.*)$/);
            if (match) {
                const prefix = match[1];
                let content = match[2];
                
                // Преобразуем содержимое пункта
                content = fixTextCase(content);
                processedLines.push(`${prefix}${content}`);
                continue;
            }
        }
        
        // 3. Обрабатываем обычный текст
        // Проверяем, не является ли строка полностью в верхнем регистре
        if (line === line.toUpperCase() && line.length > 10) {
            // Проверяем, не содержит ли она медицинских аббревиатур
            const medicalAbbr = ['ИБС', 'АПФ', 'БРА', 'ВИЧ', 'СПИД', 'ЭКГ', 'УЗИ', 'МРТ', 'КТ'];
            const hasMedicalAbbr = medicalAbbr.some(abbr => 
                line.toUpperCase().includes(abbr)
            );
            
            if (!hasMedicalAbbr) {
                line = fixTextCase(line);
            }
        } else {
            // Для смешанного регистра тоже применяем исправление
            line = fixTextCase(line);
        }
        
        processedLines.push(line);
    }
    
    const processedText = processedLines.join('\n');
    console.log("📝 Обработанный текст:", processedText.substring(0, 200) + "...");
    
    // HTML форматирование
    return processedText
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gim, (match, content) => {
            return `<h3 style="color: #2c3e50; text-transform: none; font-size: 1.2em; margin: 15px 0 10px 0;">${content}</h3>`;
        })
        .replace(/^## (.*$)/gim, (match, content) => {
            return `<h2 style="color: #3498db; text-transform: none; font-size: 1.4em; margin: 20px 0 15px 0; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px;">${content}</h2>`;
        })
        .replace(/^# (.*$)/gim, (match, content) => {
            return `<h1 style="color: #2980b9; text-transform: none; font-size: 1.6em; margin: 25px 0 20px 0;">${content}</h1>`;
        })
        .replace(/^\d+\.\s+(.*?)(?=\n\d+\.|\n\n|$)/gm, '<li style="margin-bottom: 8px;">$1</li>')
        .replace(/^[•\-]\s+(.*?)(?=\n[•\-]|\n\n|$)/gm, '<li style="margin-bottom: 8px;">$1</li>')
        .replace(/(<li.*?>.*?<\/li>)/gs, '<ul style="padding-left: 25px; margin: 10px 0;">$1</ul>')
        .replace(/<\/ul>\s*<ul/g, '</ul><ul')
        .replace(/✅/g, '<span style="color: #27ae60; font-size: 1.2em;">✅</span>')
        .replace(/⚠️/g, '<span style="color: #f39c12; font-size: 1.2em;">⚠️</span>')
        .replace(/❌/g, '<span style="color: #e74c3c; font-size: 1.2em;">❌</span>')
        .replace(/💊/g, '<span style="color: #9b59b6; font-size: 1.2em;">💊</span>')
        .replace(/🏥/g, '<span style="color: #3498db; font-size: 1.2em;">🏥</span>')
        .replace(/📋/g, '<span style="color: #e67e22; font-size: 1.2em;">📋</span>')
        .replace(/🤖/g, '<span style="color: #9b59b6; font-size: 1.2em;">🤖</span>')
        .replace(/🔍/g, '<span style="color: #2ecc71; font-size: 1.2em;">🔍</span>')
        .replace(/📊/g, '<span style="color: #3498db; font-size: 1.2em;">📊</span>');
}

// Функция для резервных рекомендаций
function getFallbackRecommendation(diagnosis) {
    return `
# 🤖 AI Рекомендации (автономный режим)

## 📋 Диагноз: ${diagnosis}

## 💊 Общие рекомендации по лечению:

### 1. Медикаментозная терапия
- Конкретные препараты должен назначить врач после осмотра
- Соблюдайте назначенные дозировки
- Отслеживайте побочные эффекты

### 2. Немедикаментозные методы
- Соблюдение режима дня
- Сбалансированное питание
- Умеренная физическая активность
- Избегание стрессовых ситуаций

### 3. Наблюдение и контроль
- Ведите дневник симптомов
- Регулярно проходите обследования
- Отмечайте динамику состояния

### 4. Когда обратиться к врачу
- При ухудшении состояния
- При появлении новых симптомов
- При отсутствии улучшения в течение 3-5 дней

### 5. Экстренные случаи
- Резкое ухудшение состояния
- Сильная боль
- Нарушение сознания
- Высокая температура (выше 39°C)

**⚠️ ВНИМАНИЕ:** Это общие рекомендации. Для точной диагностики и лечения обратитесь к врачу!

*AI сервер временно недоступен. Это автономные рекомендации.*
`;
}

// Делаем функции глобальными
window.showAIResults = showAIResults;
window.formatAIText = formatAIText;

// ==============================
// ФУНКЦИИ ДЛЯ ОБРАБОТКИ AI ТЕКСТА
// ==============================

// Список медицинских аббревиатур, которые нужно сохранить в верхнем регистре
const MEDICAL_ABBREVIATIONS = [
    'ИБС', 'АПФ', 'БРА', 'ВИЧ', 'СПИД', 'ЭКГ', 'УЗИ', 
    'МРТ', 'КТ', 'COVID', 'СОЭ', 'ОАК', 'ОАМ', 'СМАД',
    'ХОБЛ', 'ГБ', 'СД', 'АГ', 'ИМ', 'ОИМ', 'ОНМК', 'ТИА',
    'ДВС', 'СПОН', 'ОПН', 'ХПН', 'ЦНС', 'ПНС', 'ЖКТ',
    'ДНК', 'РНК', 'ПЦР', 'ИФА', 'рт.ст.', 'мм.рт.ст.'
];

// Список единиц измерения
const MEASUREMENT_UNITS = [
    'мг', 'г', 'кг', 'мл', 'л', 'сутки', 'сут', 'раз', 
    'мкг', 'ед', 'МЕ', 'кап', 'таб', 'пач', 'уп', 'фл'
];

// Функция для определения, является ли слово аббревиатурой
function isAbbreviation(word) {
    const upperWord = word.toUpperCase();
    
    // Проверяем медицинские аббревиатуры
    if (MEDICAL_ABBREVIATIONS.some(abbr => upperWord.includes(abbr))) {
        return true;
    }
    
    // Проверяем, является ли слово аббревиатурой (только заглавные буквы и точки)
    if (/^[А-ЯA-Z]{2,}$/.test(word) || /^[А-ЯA-Z]{1,3}\.[А-ЯA-Z]{1,3}\.?$/.test(word)) {
        return true;
    }
    
    // Проверяем единицы измерения
    if (MEASUREMENT_UNITS.includes(word.toLowerCase())) {
        return false; // единицы измерения не аббревиатуры
    }
    
    return false;
}

// Функция для нормализации регистра слова
function normalizeWord(word, isFirstInSentence = false) {
    if (!word || word.length === 0) return word;
    
    // Сохраняем цифры и спецсимволы
    if (/^\d+$/.test(word) || /^[^\wа-яА-Я]+$/i.test(word)) {
        return word;
    }
    
    // Проверяем, является ли слово аббревиатурой
    if (isAbbreviation(word)) {
        return word.toUpperCase();
    }
    
    // Для первого слова в предложении - первая буква заглавная, остальные строчные
    if (isFirstInSentence) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    // Для остальных слов
    return word.toLowerCase();
}

// Основная функция для исправления регистра текста
function fixTextCase(text) {
    if (!text) return '';
    
    console.log("🔧 Исправление регистра текста...");
    
    // Разбиваем текст на строки
    const lines = text.split('\n');
    const resultLines = [];
    
    for (const line of lines) {
        if (!line.trim()) {
            resultLines.push(line);
            continue;
        }
        
        // Обрабатываем каждую строку
        const words = line.split(/(\s+)/);
        const processedWords = [];
        let isFirstWordInLine = true;
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            // Если это пробелы или табуляции, сохраняем как есть
            if (/^\s+$/.test(word)) {
                processedWords.push(word);
                continue;
            }
            
            // Проверяем, содержит ли слово пунктуацию
            if (/[.!?]$/.test(word) && i < words.length - 1) {
                // Разделяем слово и пунктуацию
                const match = word.match(/^([^.!?]+)([.!?]+)$/);
                if (match) {
                    const wordPart = match[1];
                    const punctuation = match[2];
                    const normalizedWord = normalizeWord(wordPart, isFirstWordInLine);
                    processedWords.push(normalizedWord + punctuation);
                    isFirstWordInLine = true; // Следующее слово будет первым в предложении
                    continue;
                }
            }
            
            // Нормализуем слово
            const normalizedWord = normalizeWord(word, isFirstWordInLine);
            processedWords.push(normalizedWord);
            
            // Если слово содержит точку, восклицательный или вопросительный знак
            if (/[.!?]/.test(word)) {
                isFirstWordInLine = true;
            } else {
                isFirstWordInLine = false;
            }
        }
        
        resultLines.push(processedWords.join(''));
    }
    
    return resultLines.join('\n');
}

// Функция обработки списков
function processLists(text) {
    // Обрабатываем нумерованные списки
    text = text.replace(/^(\d+\.)\s+(.*?)$/gm, (match, number, content) => {
        return `${number} ${fixTextCase(content)}`;
    });
    
    // Обрабатываем маркированные списки
    text = text.replace(/^([•\-*])\s+(.*?)$/gm, (match, bullet, content) => {
        return `${bullet} ${fixTextCase(content)}`;
    });
    
    return text;
}

// Основная функция форматирования AI текста
function formatAIText(text) {
    if (!text) return '<p style="color: #666; font-style: italic;">Нет рекомендаций</p>';
    
    console.log("🎨 Начинаем форматирование AI текста...");
    
    try {
        // Шаг 1: Исправляем регистр во всем тексте
        let processedText = fixTextCase(text);
        
        // Шаг 2: Обрабатываем списки
        processedText = processLists(processedText);
        
        // Шаг 3: HTML форматирование
        let html = processedText;
        
        // 3.1: Обработка заголовков
        html = html.replace(/^# (.+)$/gm, '<h1 style="color: #2980b9; font-size: 1.8em; margin: 20px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #ecf0f1; text-transform: none;">$1</h1>');
        html = html.replace(/^## (.+)$/gm, '<h2 style="color: #3498db; font-size: 1.5em; margin: 18px 0 12px 0; text-transform: none;">$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3 style="color: #2c3e50; font-size: 1.3em; margin: 15px 0 10px 0; text-transform: none;">$1</h3>');
        
        // 3.2: Обработка жирного текста
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
        
        // 3.3: Обработка курсива
        html = html.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>');
        
        // 3.4: Обработка списков
        // Сначала обрабатываем каждый элемент списка
        html = html.replace(/^(\d+\.|\•|\-|\*)\s+(.+?)(?=\n|$)/gm, (match, bullet, content) => {
            return `<li style="margin-bottom: 8px; padding-left: 5px;">${content}</li>`;
        });
        
        // Затем группируем элементы в списки
        const lines = html.split('\n');
        let inList = false;
        let listItems = [];
        let result = [];
        
        for (let line of lines) {
            if (line.startsWith('<li')) {
                if (!inList) {
                    inList = true;
                }
                listItems.push(line);
            } else {
                if (inList) {
                    result.push(`<ul style="padding-left: 25px; margin: 15px 0; list-style-type: disc;">${listItems.join('\n')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                result.push(line);
            }
        }
        
        // Добавляем последний список, если есть
        if (inList) {
            result.push(`<ul style="padding-left: 25px; margin: 15px 0; list-style-type: disc;">${listItems.join('\n')}</ul>`);
        }
        
        html = result.join('\n');
        
        // 3.5: Обработка параграфов
        html = html.replace(/\n\n+/g, '</p><p style="margin: 10px 0; line-height: 1.6;">');
        html = html.replace(/\n/g, '<br>');
        
        // 3.6: Обработка эмодзи
        const emojiStyles = {
            '✅': 'color: #27ae60;',
            '⚠️': 'color: #f39c12;',
            '❌': 'color: #e74c3c;',
            '💊': 'color: #9b59b6;',
            '🏥': 'color: #3498db;',
            '📋': 'color: #e67e22;',
            '🤖': 'color: #8e44ad;',
            '🔍': 'color: #2ecc71;',
            '📊': 'color: #3498db;',
            '👨‍⚕️': 'color: #2980b9;',
            '👩‍⚕️': 'color: #2980b9;',
            '❤️': 'color: #e74c3c;'
        };
        
        for (const [emoji, style] of Object.entries(emojiStyles)) {
            html = html.replace(new RegExp(emoji, 'g'), `<span style="${style} font-size: 1.1em; margin: 0 2px;">${emoji}</span>`);
        }
        
        // 3.7: Оборачиваем в параграф, если нет тегов
        if (!html.includes('<h') && !html.includes('<ul') && !html.includes('<li')) {
            html = `<p style="margin: 10px 0; line-height: 1.6;">${html}</p>`;
        }
        
        // 3.8: Добавляем общий контейнер
        html = `<div class="ai-recommendations" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.6; color: #333; text-transform: none !important;">${html}</div>`;
        
        console.log("✅ Форматирование завершено");
        return html;
        
    } catch (error) {
        console.error("❌ Ошибка при форматировании AI текста:", error);
        return `<p style="color: #e74c3c;">Ошибка обработки текста: ${error.message}</p>`;
    }
}

// Альтернативная упрощенная функция для экстренных случаев
function formatAITextSimple(text) {
    if (!text) return '<p>Нет рекомендаций</p>';
    
    // Самый простой способ: преобразовать весь текст в нижний регистр, 
    // затем сделать первую букву каждого предложения заглавной
    let result = text.toLowerCase();
    
    // Разбиваем на предложения
    result = result.replace(/(^|\.\s+|\?\s+|\!\s+)([a-zа-я])/g, function(match, separator, letter) {
        return separator + letter.toUpperCase();
    });
    
    // Сохраняем медицинские аббревиатуры
    MEDICAL_ABBREVIATIONS.forEach(abbr => {
        const regex = new RegExp(`\\b${abbr.toLowerCase()}\\b`, 'gi');
        result = result.replace(regex, abbr);
    });
    
    // HTML форматирование
    result = result
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return `<div style="text-transform: none !important;">${result}</div>`;
}

// Улучшенная функция showAIResults
function showAIResults(aiText, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (!resultsDiv || !analysisResultsDiv) {
        console.error('❌ Не найдены элементы для отображения результатов');
        return;
    }
    
    // Сначала пробуем улучшенное форматирование
    let formattedText = formatAIText(aiText);
    
    // Если результат все еще содержит много заглавных букв, используем упрощенную версию
    const uppercaseRatio = (formattedText.match(/[А-ЯA-Z]/g) || []).length / Math.max(formattedText.length, 1);
    if (uppercaseRatio > 0.3) { // Если больше 30% заглавных букв
        console.log("⚠️ Много заглавных букв, используем упрощенное форматирование");
        formattedText = formatAITextSimple(aiText);
    }
    
    const htmlContent = `
        <div class="analysis-result" style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                text-transform: none !important;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <div style="font-size: 2em; margin-right: 15px;">🤖</div>
                    <div>
                        <h2 style="color: #3498db; margin: 0; padding: 0; text-transform: none;">AI-рекомендации по лечению</h2>
                        <p style="color: #666; margin: 5px 0 0 0;">Сгенерировано моделью mistral:7b</p>
                    </div>
                </div>
                
                <div style="
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border-left: 4px solid #3498db;
                    text-transform: none !important;
                    font-variant: normal !important;
                    font-weight: normal !important;
                ">
                    ${formattedText}
                </div>
                
                <div style="
                    margin-top: 20px;
                    padding: 15px;
                    background: #fff;
                    border: 1px solid #e9ecef;
                    border-radius: 5px;
                    text-transform: none !important;
                ">
                    <h4 style="color: #2c3e50; margin-top: 0; text-transform: none;">📊 Данные пациента для AI-анализа:</h4>
                    <div style="
                        max-height: 200px;
                        overflow-y: auto;
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 12px;
                        text-transform: none !important;
                    ">
                        <pre style="margin: 0; text-transform: none !important;">${JSON.stringify(patientData, null, 2)}</pre>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="window.analyzeData()" style="
                        background-color: #2ecc71;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        margin-right: 10px;
                    ">
                        📊 Вернуться к структурированному анализу
                    </button>
                    
                    <button onclick="location.reload()" style="
                        background-color: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        🔄 Обновить рекомендации
                    </button>
                </div>
            </div>
        </div>
    `;
    
    analysisResultsDiv.innerHTML = htmlContent;
    resultsDiv.style.display = 'block';
    
    // Принудительно применяем стили для всех элементов
    setTimeout(() => {
        const aiElements = resultsDiv.querySelectorAll('*');
        aiElements.forEach(el => {
            el.style.textTransform = 'none !important';
            el.style.fontVariant = 'normal !important';
            el.style.fontWeight = 'normal !important';
        });
    }, 100);
    
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// Экспортируем функции
window.fixTextCase = fixTextCase;
window.formatAIText = formatAIText;
window.formatAITextSimple = formatAITextSimple;
window.showAIResults = showAIResults;