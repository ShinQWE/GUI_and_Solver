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
    
    // УБРАТЬ ДУБЛИРОВАНИЕ - закомментировать этот блок
    /*
    if (tempData["Сведения о состоянии"] && !tempData["Сведения при обращении"]) {
        tempData["Сведения при обращении"] = { data: tempData["Сведения о состоянии"].data };
    }
    else if (tempData["Сведения при обращении"] && !tempData["Сведения о состоянии"]) {
        tempData["Сведения о состоянии"] = { data: tempData["Сведения при обращении"].data };
    }
    */
    
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
             'место записи в документе', 'путь к узлу документа', 'Синонимы', 'синоним'].includes(key)) {
            continue;
        }

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
        if (!skipHeaders) {
            div.classList.add('nested');
        }

        if (typeof data[key] === 'object' && data[key] !== null) {
            // Обработка ГРУПП
            if (key === 'Группа' && typeof data[key] === 'object') {
                const groupContainer = document.createElement('div');
                groupContainer.classList.add('group-container');
                groupContainer.style.marginBottom = '20px';
                
                for (const groupName in data[key]) {
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
                    
                    // Рендерим содержимое группы с префиксом для имен полей
                    renderGroupContent(data[key][groupName], groupContent, groupName, tabName);
                    
                    groupContainer.appendChild(groupSection);
                }
                
                div.appendChild(groupContainer);
            }
            // Обработка характеристик для "Анализ крови на гепатит С с определением генотипа"
            else if (key === "Анализ крови на гепатит С с определением генотипа" && 
                data[key]['Характеристика'] && Array.isArray(data[key]['Характеристика'])) {
                
                const sectionDiv = document.createElement('div');
                sectionDiv.classList.add('characteristic-section');
                
                const header = document.createElement('h4');
                header.textContent = key;
                header.style.marginBottom = '10px';
                header.style.color = '#2c3e50';
                sectionDiv.appendChild(header);

                data[key]['Характеристика'].forEach((characteristicGroup, index) => {
                    if (characteristicGroup && characteristicGroup['Результат']) {
                        const resultData = characteristicGroup['Результат'];
                        if (resultData['Качественное значение']) {
                            createMultiSelectDropdown(
                                sectionDiv, 
                                "Результат", 
                                resultData['Качественное значение'], 
                                'Анализ крови на гепатит С с определением генотипа_Результат',
                                tabName
                            );
                        }
                    }
                });
                
                div.appendChild(sectionDiv);
            }
            // Обработка характеристик для других полей с характеристиками
            else if (data[key]['Характеристика'] && Array.isArray(data[key]['Характеристика'])) {
                const sectionDiv = document.createElement('div');
                sectionDiv.classList.add('characteristic-section');
                
                const header = document.createElement('h4');
                header.textContent = key;
                header.style.marginBottom = '10px';
                header.style.color = '#2c3e50';
                sectionDiv.appendChild(header);

                data[key]['Характеристика'].forEach((characteristicGroup, index) => {
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
                
                div.appendChild(sectionDiv);
            }
            else if (data[key]['Числовое значение']) {
                const label = document.createElement('label');
                label.textContent = `${key}: `;
                label.style.fontWeight = 'bold';
                div.appendChild(label);

                const input = document.createElement('input');
                input.type = 'number';
                input.name = key;
                input.style.marginLeft = '10px';
                input.style.padding = '5px';
                input.style.border = '1px solid #ccc';
                input.style.borderRadius = '3px';
                
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

                // Добавляем единицу измерения
                if (data[key]['Числовое значение']['единица измерения']) {
                    const unitSpan = document.createElement('span');
                    unitSpan.textContent = ` ${data[key]['Числовое значение']['единица измерения']}`;
                    unitSpan.style.marginLeft = '5px';
                    unitSpan.style.color = '#666';
                    div.appendChild(unitSpan);
                }
            } 
            else if (data[key]['Качественное значение'] && !isPassportTab) {
                // Для всех качественных значений (кроме паспортных) создаем красивый мультиселект
                createMultiSelectDropdown(div, key, data[key]['Качественное значение'], key, tabName);
            }
            else if (data[key]['Качественное значение'] && isPassportTab) {
                // Для паспортных данных оставляем обычный select
                const label = document.createElement('label');
                label.textContent = `${key}: `;
                label.style.fontWeight = 'bold';
                label.style.display = 'block';
                label.style.marginBottom = '5px';
                div.appendChild(label);

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
                
                if (allTabsData[tabName].data[key] === 'присутствие' || 
                    allTabsData[tabName].data[key] === 'отсутствует') {
                    select.value = allTabsData[tabName].data[key];
                }
                
                const characteristicsDiv = document.createElement('div');
                characteristicsDiv.classList.add('characteristics');
                characteristicsDiv.style.marginTop = '10px';
                characteristicsDiv.style.padding = '10px';
                characteristicsDiv.style.backgroundColor = '#fff';
                characteristicsDiv.style.border = '1px solid #ddd';
                characteristicsDiv.style.borderRadius = '3px';
                
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
                
                renderJSON(data[key], contentDiv, true, tabName);
                
                sectionDiv.appendChild(headerButton);
                sectionDiv.appendChild(contentDiv);
                div.appendChild(sectionDiv);
            }
            else if (key === 'Характеристика' && typeof data[key] === 'object') {
                // Обработка вложенных характеристик
                const charContainer = document.createElement('div');
                charContainer.classList.add('nested-characteristics');
                charContainer.style.marginLeft = '20px';
                charContainer.style.padding = '10px';
                charContainer.style.borderLeft = '2px solid #3498db';
                
                renderJSON(data[key], charContainer, true, tabName);
                div.appendChild(charContainer);
            }
            else {
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
        
        if (div.childNodes.length > 0) {
            container.appendChild(div);
        }
    }
}

// Функция для рендеринга содержимого групп
function renderGroupContent(groupData, container, groupName, tabName) {
    if (groupData && groupData['Наблюдение']) {
        for (const observationName in groupData['Наблюдение']) {
            const observationData = groupData['Наблюдение'][observationName];
            
            if (observationData && observationData['Характеристика'] && Array.isArray(observationData['Характеристика'])) {
                const observationSection = document.createElement('div');
                observationSection.classList.add('observation-section');
                observationSection.style.marginBottom = '15px';
                observationSection.style.padding = '10px';
                observationSection.style.backgroundColor = '#fff';
                observationSection.style.border = '1px solid #ddd';
                observationSection.style.borderRadius = '3px';
                
                const observationHeader = document.createElement('h5');
                observationHeader.textContent = observationName;
                observationHeader.style.margin = '0 0 10px 0';
                observationHeader.style.color = '#34495e';
                observationSection.appendChild(observationHeader);
                
                observationData['Характеристика'].forEach((characteristic, index) => {
                    if (characteristic) {
                        for (const charName in characteristic) {
                            const charData = characteristic[charName];
                            const fieldFullName = `${observationName}_${charName}`;
                            
                            if (charData && charData['Качественное значение']) {
                                createMultiSelectDropdown(
                                    observationSection, 
                                    charName, 
                                    charData['Качественное значение'], 
                                    fieldFullName,
                                    tabName
                                );
                            } else if (charData && charData['Числовое значение']) {
                                const charDiv = document.createElement('div');
                                charDiv.classList.add('characteristic-field');
                                charDiv.style.marginBottom = '10px';
                                
                                const label = document.createElement('label');
                                label.textContent = `${charName}: `;
                                label.style.fontWeight = 'bold';
                                label.style.display = 'block';
                                label.style.marginBottom = '5px';
                                charDiv.appendChild(label);
                                
                                const input = document.createElement('input');
                                input.type = 'number';
                                input.name = fieldFullName;
                                input.style.padding = '5px';
                                input.style.border = '1px solid #ccc';
                                input.style.borderRadius = '3px';
                                input.style.width = '200px';
                                
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
                                    unitSpan.style.marginLeft = '5px';
                                    unitSpan.style.color = '#666';
                                    charDiv.appendChild(unitSpan);
                                }
                                
                                observationSection.appendChild(charDiv);
                            }
                        }
                    }
                });
                
                container.appendChild(observationSection);
            }
        }
    }
    
    // Специальная обработка для группы "Диурез"
    if (groupName === "Диурез") {
        const diuresisSection = document.createElement('div');
        diuresisSection.classList.add('diuresis-section');
        
        if (groupData && groupData['Наблюдение']) {
            for (const fieldName in groupData['Наблюдение']) {
                const fieldData = groupData['Наблюдение'][fieldName];
                const fieldFullName = `Диурез_${fieldName}`;
                
                if (fieldData && fieldData['Качественное значение']) {
                    createMultiSelectDropdown(
                        diuresisSection, 
                        fieldName, 
                        fieldData['Качественное значение'], 
                        fieldFullName,
                        tabName
                    );
                }
            }
        }
        
        container.appendChild(diuresisSection);
    }
}

// Функция для создания красивого выпадающего списка с множественным выбором
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

    // Кнопка для открытия/закрытия списка
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

    // Список опций
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

    // Текущие выбранные значения
    const currentValue = allTabsData[tabName].data[fieldName] || [];
    const selectedValues = Array.isArray(currentValue) ? currentValue : 
                          currentValue ? [currentValue] : [];

    // Создаем чекбоксы для каждой опции
    for (const optionKey in options) {
        const optionDiv = document.createElement('label');
        optionDiv.style.display = 'flex';
        optionDiv.style.alignItems = 'center';
        optionDiv.style.padding = '8px 12px';
        optionDiv.style.cursor = 'pointer';
        optionDiv.style.transition = 'background-color 0.2s ease';
        optionDiv.style.borderBottom = '1px solid #f0f0f0';

        optionDiv.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f8f9fa';
        });

        optionDiv.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = optionKey;
        checkbox.style.marginRight = '10px';
        checkbox.style.cursor = 'pointer';

        if (selectedValues.includes(optionKey)) {
            checkbox.checked = true;
        }

        const optionText = document.createElement('span');
        optionText.textContent = optionKey;
        optionText.style.flex = '1';

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(optionText);
        optionsList.appendChild(optionDiv);
    }

    // Обновляем текст кнопки при выборе
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

    // Сохраняем выбранные значения
    function saveSelectedValues() {
        const checkedBoxes = optionsList.querySelectorAll('input[type="checkbox"]:checked');
        const selected = Array.from(checkedBoxes).map(cb => cb.value);
        allTabsData[tabName].data[fieldName] = selected;
    }

    // Обработчики событий для чекбоксов
    optionsList.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            updateButtonText();
            saveSelectedValues();
        }
    });

    // Открытие/закрытие dropdown
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

    // Закрытие dropdown при клике вне его
    document.addEventListener('click', function(e) {
        if (!dropdownContainer.contains(e.target)) {
            optionsList.style.display = 'none';
            dropdownButton.style.borderRadius = '6px';
            dropdownButton.style.borderBottom = '1px solid #ddd';
            arrow.style.transform = 'rotate(0deg)';
        }
    });

    // Инициализируем текст кнопки
    updateButtonText();

    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(optionsList);
    container.appendChild(dropdownContainer);

    // Добавляем стиль для последнего элемента без границы
    const lastOption = optionsList.lastElementChild;
    if (lastOption) {
        lastOption.style.borderBottom = 'none';
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

    // Создаем структурированные группы
    const structuredData = {};

    for (const tabName in allTabsData) {
        if (!structuredData[tabName]) {
            structuredData[tabName] = {};
        }

        for (const fieldName in allTabsData[tabName].data) {
            const fieldValue = allTabsData[tabName].data[fieldName];
            
            if (fieldValue === null || fieldValue === undefined) {
                continue;
            }

            // Определяем группу для поля
            let groupName = "Общие данные";
            let actualFieldName = fieldName;

            // Определяем observationName для группировки
            let observationName = fieldName;
            if (fieldName.includes("_")) {
                const parts = fieldName.split("_");
                observationName = parts[0]; // Первая часть как название наблюдения
                actualFieldName = parts.slice(1).join("_"); // Остальное как название поля
            }

            // Определяем принадлежность к группам
            if (fieldName.includes("Перелом верхней трети плечевой кости_")) {
                groupName = "Расширенный клинический диагноз";
                actualFieldName = fieldName.replace("Перелом верхней трети плечевой кости_", "");
            } else if (fieldName.includes("Перелом лопатки_")) {
                groupName = "Расширенный клинический диагноз";
                actualFieldName = fieldName.replace("Перелом лопатки_", "");
            } else if (fieldName.includes("Перелом ключицы_")) {
                groupName = "Расширенный клинический диагноз";
                actualFieldName = fieldName.replace("Перелом ключицы_", "");
            } else if (fieldName.includes("Вывих ключицы_")) {
                groupName = "Расширенный клинический диагноз";
                actualFieldName = fieldName.replace("Вывих ключицы_", "");
            } else if (fieldName === "Объем" || fieldName === "Качество мочи") {
                groupName = "Диурез";
            } else if (fieldName.includes("Диурез_")) {
                groupName = "Диурез";
                actualFieldName = fieldName.replace("Диурез_", "");
            }

            // Создаем группу если её нет
            if (!structuredData[tabName][groupName]) {
                structuredData[tabName][groupName] = {};
            }

            // Получаем единицу измерения из структуры GUI
            let unit = getUnitFromGUIStructure(tabName, fieldName, actualFieldName);
            
            // Если не нашли в структуре, используем эвристики как fallback
            if (!unit) {
                unit = getUnitByFieldName(actualFieldName);
            }

            // Сохраняем значение с правильной группировкой
            if (Array.isArray(fieldValue)) {
                // Для групповых полей создаем вложенную структуру
                if (groupName !== "Общие данные") {
                    if (!structuredData[tabName][groupName][observationName]) {
                        structuredData[tabName][groupName][observationName] = {};
                    }
                    structuredData[tabName][groupName][observationName][actualFieldName] = {
                        "Тип": "Множественный выбор",
                        "Значение": fieldValue.join(', ')
                    };
                } else {
                    structuredData[tabName][groupName][actualFieldName] = {
                        "Тип": "Множественный выбор", 
                        "Значение": fieldValue.join(', ')
                    };
                }
            } else if (typeof fieldValue === 'number') {
                // Для групповых полей
                if (groupName !== "Общие данные") {
                    if (!structuredData[tabName][groupName][observationName]) {
                        structuredData[tabName][groupName][observationName] = {};
                    }
                    const fieldData = {
                        "Тип": "Числовое",
                        "Значение": fieldValue
                    };
                    if (unit) {
                        fieldData["Единица измерения"] = unit;
                    }
                    structuredData[tabName][groupName][observationName][actualFieldName] = fieldData;
                } else {
                    const fieldData = {
                        "Тип": "Числовое",
                        "Значение": fieldValue
                    };
                    if (unit) {
                        fieldData["Единица измерения"] = unit;
                    }
                    structuredData[tabName][groupName][actualFieldName] = fieldData;
                }
            } else {
                // Для групповых полей
                if (groupName !== "Общие данные") {
                    if (!structuredData[tabName][groupName][observationName]) {
                        structuredData[tabName][groupName][observationName] = {};
                    }
                    structuredData[tabName][groupName][observationName][actualFieldName] = {
                        "Тип": "Текстовое",
                        "Значение": fieldValue.toString()
                    };
                } else {
                    structuredData[tabName][groupName][actualFieldName] = {
                        "Тип": "Текстовое",
                        "Значение": fieldValue.toString()
                    };
                }
            }
        }
    }

    // ⭐⭐ ВАЖНО: Копируем структурированные данные в выходной формат ⭐⭐
    ibData["Данные"] = JSON.parse(JSON.stringify(structuredData));

    // Проверка на пустые данные
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

// Новая функция для получения единиц измерения из структуры GUI
function getUnitFromGUIStructure(tabName, fieldName, actualFieldName) {
    if (!jsonData || !jsonData['Описание GUI для ПС']) return null;

    try {
        // Ищем поле в структуре GUI
        const tabs = jsonData['Описание GUI для ПС']['Шаблон']['Ввод наблюдений']['Вкладка'];
        
        for (const tabKey in tabs) {
            const tab = tabs[tabKey];
            // Рекурсивно ищем поле с числовым значением
            const fieldData = findFieldInStructure(tab, actualFieldName);
            if (fieldData && fieldData['Числовое значение'] && fieldData['Числовое значение']['единица измерения']) {
                return fieldData['Числовое значение']['единица измерения'];
            }
        }
    } catch (error) {
        console.warn("Ошибка при поиске единицы измерения в структуре GUI:", error);
    }
    
    return null;
}

// Рекурсивная функция поиска поля в структуре
function findFieldInStructure(structure, fieldName) {
    if (!structure || typeof structure !== 'object') return null;
    
    // Если нашли поле с нужным именем
    if (structure[fieldName]) {
        return structure[fieldName];
    }
    
    // Рекурсивно ищем во вложенных структурах
    for (const key in structure) {
        if (typeof structure[key] === 'object') {
            const result = findFieldInStructure(structure[key], fieldName);
            if (result) return result;
        }
    }
    
    return null;
}

// Функция для определения единиц измерения по имени поля (fallback)
function getUnitByFieldName(fieldName) {
    const fieldNameLower = fieldName.toLowerCase();
    
    const unitMappings = {
        'артериальное давление': 'мм.рт.ст.',
        'ад': 'мм.рт.ст.',
        'систолическое': 'мм.рт.ст.',
        'диастолическое': 'мм.рт.ст.',
        'систолическое артериальное давление': 'мм.рт.ст.',
        'диастолическое артериальное давление': 'мм.рт.ст.',
        'температура': '°С',
        'температура тела': '°С',
        'частота сердечных сокращений': 'уд/мин',
        'чсс': 'уд/мин',
        'гемоглобин': 'г/л',
        'лейкоциты': '× 10^9/л',
        'количество лейкоцитов': '× 10^9/л',
        'эритроциты': '× 10^12/л',
        'количество эритроцитов': '× 10^12/л',
        'возраст': 'лет',
        'скорость клубочковой фильтрации': 'мл/мин/1,73м',
        'скф': 'мл/мин/1,73м'
    };
    
    for (const [key, unit] of Object.entries(unitMappings)) {
        if (fieldNameLower.includes(key)) {
            return unit;
        }
    }
    
    return null;
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
            
            // Обрабатываем массивы (множественный выбор) - СОХРАНЯЕМ КАК МАССИВ!
            if (Array.isArray(fieldValue)) {
                if (fieldValue.length > 0) {
                    // Сохраняем как массив, а не как строку
                    patient_data[fieldName] = fieldValue; // ← ИЗМЕНИТЬ ЗДЕСЬ
                }
            } else if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                patient_data[fieldName] = fieldValue;
            }
        }
    }

    // Специальная обработка некоторых полей
    if ("Операции" in patient_data) {
        const operations = patient_data["Операции"];
        if (Array.isArray(operations)) {
            if (operations.includes("Трансплантация печени")) {
                patient_data["Трансплантация печени"] = "проводилась";
            } else if (operations.length === 0 || operations.includes("операций не было")) {
                patient_data["Трансплантация печени"] = "не проводилась";
            }
        } else if (typeof operations === 'string') {
            if (operations.includes("Трансплантация печени")) {
                patient_data["Трансплантация печени"] = "проводилась";
            } else if (operations === "" || operations.includes("операций не было")) {
                patient_data["Трансплантация печени"] = "не проводилась";
            }
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
            // Если значение - массив, берем первый элемент для анализа
            if (Array.isArray(patient_data[src_field])) {
                patient_data[target_field] = patient_data[src_field].length > 0 ? patient_data[src_field][0] : "";
            } else {
                patient_data[target_field] = patient_data[src_field];
            }
        }
    }

    return patient_data;
}