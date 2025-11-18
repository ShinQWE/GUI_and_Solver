// Глобальный объект для хранения данных всех вкладок
let allTabsData = {
    "Сведения паспортные": { data: {} },
    "Сведения при обращении": { data: {} },
    "Сведения о состоянии": { data: {} },
    "Сведения в динамике": { data: {} }
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
        clearForm();
        for (const tabName in allTabsData) {
            allTabsData[tabName].data = {};
        }
        window.allTabsData = allTabsData;
        
        const historyData = patientHistory["История болезни или наблюдений v.4"];
        if (!historyData) throw new Error("Неверный формат файла истории болезни");
        
        const ibId = Object.keys(historyData)[0];
        const patientRecord = historyData[ibId];
        if (!patientRecord || !patientRecord["Данные"]) throw new Error("Отсутствуют данные пациента в файле");
        
        const patientData = patientRecord["Данные"];
        
        for (const tabName in allTabsData) {
            if (patientData[tabName]) {
                const tabData = patientData[tabName];
                for (const fieldName in tabData) {
                    const fieldData = tabData[fieldName];
                    if (fieldData && typeof fieldData === 'object') {
                        allTabsData[tabName].data[fieldName] = fieldData["Значение"] || fieldData;
                    } else {
                        allTabsData[tabName].data[fieldName] = fieldData;
                    }
                }
            }
        }
        
        const activeTab = document.querySelector('.tab-header.active');
        if (activeTab) renderTabContent(activeTab.innerText.trim());
        showNotification("Данные истории болезни загружены в форму!", "success");
    } catch (error) {
        showNotification("Ошибка загрузки истории болезни: " + error.message, "error");
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
    allTabsData = tempData;
}

function showNotification(message, type = "success") {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.color = type === "success" ? "green" : "red";
    setTimeout(() => { notification.textContent = ''; }, 3000);
}

function clearForm() {
    for (const tabName in allTabsData) {
        allTabsData[tabName].data = {};
    }
    const activeTab = document.querySelector('.tab-header.active');
    if (activeTab) renderTabContent(activeTab.innerText.trim());
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
    
    if (tabName === "Сведения паспортные") {
        renderPassportData(tabStructure, tabContents);
    } else {
        renderJSON(tabStructure, tabContents, false, tabName);
    }
}

function renderPassportData(tabStructure, container) {
    const passportData = findNestedObject(tabStructure, 'Наблюдение');
    const passportGroup = findNestedObject(tabStructure, 'Группа');
    
    if (passportData) renderJSON(passportData, container, false, "Сведения паспортные");
    
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

function renderJSON(data, container, skipHeaders = false, tabName) {
    for (const key in data) {
        if (['Качественное значение', 'Числовое значение', 'единица измерения', 
             'место записи в документе', 'путь к узлу документа', 'Синонимы', 'синоним'].includes(key)) continue;

        const isPassportTab = tabName === "Сведения паспортные";
        const isIntermediateNode = !isPassportTab && [
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
            } else if (data[key]['Качественное значение'] && !isPassportTab) {
                createMultiSelectDropdown(div, key, data[key]['Качественное значение'], key, tabName);
            } else if (data[key]['Качественное значение'] && isPassportTab) {
                renderPassportSelect(data[key], key, div, tabName);
            } else if (data[key]['присутствие'] || data[key]['отсутствует']) {
                renderPresenceField(data[key], key, div, tabName);
            } else if (['Дневник наблюдений', 'Анамнез заболевания', 'Назначение лечения', 
                     'Жалобы', 'Осмотр', 'Опрос', 'Сведения паспортные', 
                     'Сведения при обращении', 'Сведения в динамике', 'Исследования',
                     'Диагноз', 'Идентификация', 'История болезни'].includes(key)) {
                renderCollapsibleSection(data[key], key, div, tabName);
            } else if (key === 'Характеристика' && typeof data[key] === 'object') {
                renderNestedCharacteristics(data[key], div, tabName);
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
        
        if (div.childNodes.length > 0) container.appendChild(div);
    }
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
            renderObservation(observationData, observationName, container, tabName);
        }
    }
    
    if (groupName === "Диурез") {
        const diuresisSection = document.createElement('div');
        diuresisSection.classList.add('diuresis-section');
        if (groupData && groupData['Наблюдение']) {
            for (const fieldName in groupData['Наблюдение']) {
                const fieldData = groupData['Наблюдение'][fieldName];
                const fieldFullName = `Диурез_${fieldName}`;
                if (fieldData && fieldData['Качественное значение']) {
                    createMultiSelectDropdown(diuresisSection, fieldName, fieldData['Качественное значение'], fieldFullName, tabName);
                }
            }
        }
        container.appendChild(diuresisSection);
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

function renderCharacteristicField(charData, charName, fieldFullName, container, tabName) {
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
            renderJSON(characteristicGroup, characteristicContainer, true, tabName);
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

function renderPassportSelect(data, key, container, tabName) {
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
    
    const headerButton = document.createElement('button');
    headerButton.classList.add('section-header');
    headerButton.textContent = key;
    headerButton.style.width = '100%';
    headerButton.style.padding = '12px';
    headerButton.style.backgroundColor = '#3498db';
    headerButton.style.color = 'white';
    headerButton.style.border = 'none';
    headerButton.style.borderRadius = '5px';
    headerButton.style.cursor = 'pointer';
    headerButton.style.textAlign = 'left';
    headerButton.style.fontSize = '16px';
    headerButton.style.fontWeight = 'bold';
    
    headerButton.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        if (content.style.display === 'block') {
            content.style.display = 'none';
            this.style.backgroundColor = '#3498db';
        } else {
            content.style.display = 'block';
            this.style.backgroundColor = '#2980b9';
        }
    });
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('section-content');
    contentDiv.style.display = 'none';
    contentDiv.style.padding = '15px';
    contentDiv.style.border = '1px solid #ddd';
    contentDiv.style.borderRadius = '0 0 5px 5px';
    contentDiv.style.backgroundColor = '#f8f9fa';
    
    renderJSON(data, contentDiv, true, tabName);
    
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

function createMultiSelectDropdown(container, labelText, options, fieldName, tabName) {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.classList.add('multi-select-dropdown');
    dropdownContainer.style.marginBottom = '15px';
    dropdownContainer.style.position = 'relative';

    const label = document.createElement('label');
    label.textContent = `${labelText}: `;
    label.style.fontWeight = 'bold';
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.cursor = 'pointer';
    dropdownContainer.appendChild(label);

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

    const currentValue = allTabsData[tabName].data[fieldName] || [];
    const selectedValues = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];

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
        allTabsData[tabName].data[fieldName] = selected;
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

    for (const tabName in allTabsData) {
        if (!structuredData[tabName]) structuredData[tabName] = {};

        for (const fieldName in allTabsData[tabName].data) {
            const fieldValue = allTabsData[tabName].data[fieldName];
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') continue;

            if (Array.isArray(fieldValue)) {
                structuredData[tabName][fieldName] = { "Тип": "Выбор", "Значение": fieldValue.join(', ') };
            } else if (typeof fieldValue === 'number') {
                structuredData[tabName][fieldName] = { "Тип": "Числовое", "Значение": fieldValue };
            } else {
                structuredData[tabName][fieldName] = { "Тип": "Текстовое", "Значение": fieldValue.toString() };
            }
        }
    }

    let isEmpty = true;
    for (const tabName in structuredData) {
        if (Object.keys(structuredData[tabName]).length > 0) {
            isEmpty = false;
            break;
        }
    }
    
    if (isEmpty) {
        showNotification("Нет данных для сохранения!", "error");
        return;
    }

    ibData["Данные"] = JSON.parse(JSON.stringify(structuredData));

    const jsonOutput = JSON.stringify(outputData, (key, value) => {
        if (value === null || value === undefined || (typeof value === 'object' && Object.keys(value).length === 0)) {
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
    return structuredData;
}

function extract_patient_data() {
    const patient_data = {};
    for (const tabName in allTabsData) {
        for (const fieldName in allTabsData[tabName].data) {
            const fieldValue = allTabsData[tabName].data[fieldName];
            if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                patient_data[fieldName] = fieldValue;
            }
        }
    }
    return patient_data;
}

window.showNotification = showNotification;
window.extract_patient_data = extract_patient_data;


// AI ИНТЕГРАЦИЯ - добавьте эти функции

// 1. Добавьте обработчик кнопки
document.addEventListener('DOMContentLoaded', function() {
    const aiButton = document.getElementById('aiRecommendationsButton');
    if (aiButton) {
        aiButton.addEventListener('click', getAIRecommendations);
        console.log("✅ Кнопка AI-рекомендаций зарегистрирована");
    } else {
        console.log("❌ Кнопка AI-рекомендаций не найдена");
    }
});

// 2. Основная функция AI-рекомендаций - ИСПРАВЛЕННАЯ ВЕРСИЯ
async function getAIRecommendations() {
    console.log("🔄 Запуск AI-рекомендаций...");
    
    const loadingElement = document.getElementById('aiLoading');
    const aiButton = document.getElementById('aiRecommendationsButton');
    
    try {
        // Показываем индикатор загрузки и блокируем кнопку
        if (loadingElement) loadingElement.style.display = 'block';
        if (aiButton) {
            aiButton.disabled = true;
            aiButton.innerHTML = '⏳ Генерация...';
        }
        
        showNotification("🔄 Запрос к AI-ассистенту...", "success");
        
        // Проверяем есть ли данные
        const patientData = extract_patient_data();
        console.log("Данные пациента:", patientData);
        
        if (Object.keys(patientData).length === 0) {
            showNotification("❌ Нет данных пациента для анализа!", "error");
            return;
        }
        
        // Форматируем данные для AI
        const formattedData = formatForAIAssistant(patientData);
        console.log("Форматированные данные:", formattedData);
        
        // Вызываем AI и получаем ВЕСЬ результат
        showNotification("📡 Отправка данных в AI-ассистенту...", "success");
        const aiResult = await callAIAssistant(formattedData);
        
        // Проверяем успешность и показываем результаты
        if (aiResult.success) {
            showAIResults(aiResult.recommendations, patientData);
            showNotification("✅ AI-рекомендации получены!", "success");
        } else {
            throw new Error(aiResult.error || 'Неизвестная ошибка AI');
        }
        
    } catch (error) {
        console.error("❌ Ошибка AI-анализа:", error);
        showNotification("Ошибка: " + error.message, "error");
    } finally {
        // Всегда скрываем индикатор и разблокируем кнопку
        if (loadingElement) loadingElement.style.display = 'none';
        if (aiButton) {
            aiButton.disabled = false;
            aiButton.innerHTML = '🤖 AI-рекомендации';
        }
    }
}

// 3. Форматирование данных для AI
function formatForAIAssistant(patientData) {
    const ibId = "ИБ_" + new Date().getTime();
    
    const formattedData = {
        "История болезни или наблюдений v.4": {
            [ibId]: {
                "дата обращения": new Date().toLocaleString('ru-RU'),
                "Данные": {
                    "Сведения при обращении": {}
                }
            }
        }
    };
    
    const targetSection = formattedData["История болезни или наблюдений v.4"][ibId]["Данные"]["Сведения при обращении"];
    
    // Преобразуем данные
    for (const tabName in allTabsData) {
        for (const fieldName in allTabsData[tabName].data) {
            const value = allTabsData[tabName].data[fieldName];
            if (value !== null && value !== undefined && value !== '') {
                targetSection[fieldName] = {
                    "Тип": Array.isArray(value) ? "Выбор" : 
                          typeof value === 'number' ? "Числовое" : "Текстовое",
                    "Значение": Array.isArray(value) ? value.join(', ') : value.toString()
                };
            }
        }
    }
    
    // Добавляем обязательные поля
    if (!targetSection["Клинический диагноз"]) {
        targetSection["Клинический диагноз"] = {
            "Тип": "Текстовое",
            "Значение": "Диагноз не указан"
        };
    }
    
    return formattedData;
}

// 4. Вызов AI-ассистента - ИСПРАВЛЕННАЯ ВЕРСИЯ
async function callAIAssistant(patientJSON) {
    const API_URL = 'http://127.0.0.1:5000/api/analyze';
    
    console.log("📡 Отправка запроса к AI...");
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(patientJSON)
        });
        
        console.log("📨 Ответ получен, статус:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("📊 Результат AI:", result);
        
        return result; // ВОЗВРАЩАЕМ ВЕСЬ РЕЗУЛЬТАТ, а не только recommendations
        
    } catch (error) {
        console.error('❌ Ошибка вызова AI:', error);
        
        let errorMessage = 'Ошибка при получении AI-рекомендаций: ';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Сервер AI-ассистента недоступен. Убедитесь, что сервер запущен.';
        } else {
            errorMessage += error.message;
        }
        
        throw new Error(errorMessage);
    }
}

// 5. Показ результатов
function showAIResults(recommendations, patientData) {
    const resultsDiv = document.getElementById('results');
    const analysisResultsDiv = document.getElementById('analysisResults');
    
    if (!resultsDiv || !analysisResultsDiv) {
        console.error("❌ Не найдены элементы для отображения результатов");
        showNotification("❌ Не найдено место для отображения результатов", "error");
        return;
    }
    
    const formattedRecommendations = recommendations.replace(/\n/g, '<br>');
    
    analysisResultsDiv.innerHTML = `
        <div class="analysis-result ai-recommendations">
            <div style="background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%); 
                       padding: 20px; border-radius: 8px; margin-top: 15px; 
                       border-left: 5px solid #4169e1; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h3 style="color: #4169e1; margin-top: 0; display: flex; align-items: center;">
                    🤖 AI-рекомендации
                    <span style="margin-left: auto; font-size: 12px; color: #666;">
                        ${new Date().toLocaleString('ru-RU')}
                    </span>
                </h3>
                <div style="line-height: 1.6; font-family: Arial, sans-serif;">
                    ${formattedRecommendations}
                </div>
            </div>
            
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #666; font-size: 14px;">
                    📊 Показать переданные данные
                </summary>
                <div style="margin-top: 10px;">
                    <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; 
                               border-radius: 4px; margin-top: 10px; max-height: 200px; 
                               overflow-y: auto; font-size: 11px;">
${JSON.stringify(patientData, null, 2)}
                    </pre>
                </div>
            </details>
        </div>
    `;
    
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// 6. Сделаем функции глобальными
window.getAIRecommendations = getAIRecommendations;
window.formatForAIAssistant = formatForAIAssistant;
window.callAIAssistant = callAIAssistant;
window.showAIResults = showAIResults;