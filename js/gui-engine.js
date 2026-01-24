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
                
                // СБРАСЫВАЕМ ПОЛЕ ВВОДА
                event.target.value = '';
                
                // Создаем временное уведомление о загрузке
                createHistoryLoadedNotification();
                
                showNotification("История болезни загружена успешно!", "success");
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
        'Оперативное вмешательство', 'Остеосинтез', 'Иммобилизация',
        'Осмотр', 'Расширенный клинический диагноз', 'Вмешательства',
        'Жалобы', 'Опрос', 'Анамнез заболевания', 'Исследования',
        'Инструментальные исследования', 'Назначение лечения', 'Дневник наблюдений',
        'Диагноз', 'Вершина меню', 'Идентификация'
    ];
    
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
        renderGroupContent(groupData[groupName], groupContent, groupName, tabName);
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

    // Создаем структуру для каждого раздела
    for (const tabName in allTabsData) {
        const tabData = allTabsData[tabName];
        
        // Пропускаем пустые разделы
        if ((!tabData.hierarchicalData || Object.keys(tabData.hierarchicalData).length === 0) &&
            (!tabData.data || Object.keys(tabData.data).length === 0)) {
            continue;
        }
        
        // Создаем объект для раздела
        const sectionData = {};
        
        // 1. Обрабатываем простые поля (не иерархические)
        for (const fieldName in tabData.data) {
            const fieldValue = tabData.data[fieldName];
            
            if (fieldValue === null || fieldValue === undefined || 
                (Array.isArray(fieldValue) && fieldValue.length === 0)) {
                continue;
            }
            
            // Определяем тип поля
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
            
            // Сохраняем поле
            sectionData[fieldName] = {
                "Тип": fieldType,
                "Значение": fieldValueStr
            };
        }
        
        // 2. Обрабатываем иерархические данные
        if (tabData.hierarchicalData && Object.keys(tabData.hierarchicalData).length > 0) {
            for (const parentField in tabData.hierarchicalData) {
                const parentData = tabData.hierarchicalData[parentField];
                
                if (!parentData || Object.keys(parentData).length === 0) {
                    continue;
                }
                
                // Если это объект с подполями
                if (typeof parentData === 'object' && !Array.isArray(parentData)) {
                    const subSectionData = {};
                    
                    for (const subField in parentData) {
                        const subValue = parentData[subField];
                        
                        if (subValue === null || subValue === undefined || 
                            (Array.isArray(subValue) && subValue.length === 0)) {
                            continue;
                        }
                        
                        // Определяем тип подполя
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
                    }
                    
                    // Сохраняем иерархическое поле только если есть данные
                    if (Object.keys(subSectionData).length > 0) {
                        sectionData[parentField] = subSectionData;
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
                }
            }
        }
        
        // Сохраняем раздел только если есть данные
        if (Object.keys(sectionData).length > 0) {
            structuredData[tabName] = {
                "Общие данные": sectionData
            };
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
            if (!tabData["Общие данные"]) {
                console.log(`Нет "Общие данные" во вкладке ${tabName}`);
                continue;
            }
            
            const generalData = tabData["Общие данные"];
            
            for (const fieldName in generalData) {
                const fieldObj = generalData[fieldName];
                
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