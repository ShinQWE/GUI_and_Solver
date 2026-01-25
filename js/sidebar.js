// sidebar.js - Управление боковой панелью навигации (исправленная версия)

// Глобальные переменные для отслеживания статусов
let guiLoaded = false;
let kbLoaded = false;
let historyLoaded = false;

document.addEventListener('DOMContentLoaded', function() {
    setupSidebarNavigation();
    initializeStatuses();
});

function initializeStatuses() {
    // Инициализируем статусы при загрузке страницы
    updateStatusDisplay();
}

function setupSidebarNavigation() {
    // Функция обновления навигации по вкладкам
    function updateSidebarNavigation() {
        const quickNav = document.getElementById('quickNav');
        if (!quickNav) return;
        
        // Получаем все вкладки
        const tabs = document.querySelectorAll('.tab-header');
        
        // Очищаем навигацию
        quickNav.innerHTML = '';
        
        // Если вкладок нет, показываем сообщение
        if (tabs.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'nav-empty';
            emptyMsg.textContent = 'Загрузите GUI файл';
            emptyMsg.style.cssText = 'text-align: center; color: #666; padding: 20px; font-style: italic;';
            quickNav.appendChild(emptyMsg);
            return;
        }
        
        // Добавляем элементы навигации для каждой вкладки
        tabs.forEach((tab, index) => {
            const navItem = document.createElement('div');
            navItem.className = 'nav-item';
            navItem.textContent = tab.textContent;
            navItem.title = tab.textContent;
            
            navItem.addEventListener('click', function() {
                // Снимаем активный класс со всех элементов
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Добавляем активный класс текущему элементу
                this.classList.add('active');
                
                // Кликаем на соответствующую вкладку
                tab.click();
                
                // Прокручиваем к вкладке
                tab.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            });
            
            quickNav.appendChild(navItem);
        });
        
        // Активируем активную вкладку
        const activeTab = document.querySelector('.tab-header.active');
        if (activeTab) {
            const activeIndex = Array.from(tabs).indexOf(activeTab);
            if (activeIndex !== -1 && quickNav.children[activeIndex]) {
                quickNav.children[activeIndex].classList.add('active');
            }
        }
    }
    
    // Функция для обновления отображения всех статусов
    function updateStatusDisplay() {
        const guiStatusElement = document.getElementById('guiStatus');
        const kbStatusElement = document.getElementById('kbStatus');
        const historyStatusElement = document.getElementById('historyStatus');
        
        if (guiStatusElement) {
            if (guiLoaded) {
                guiStatusElement.textContent = '✅';
                guiStatusElement.style.color = '#28a745';
                guiStatusElement.title = 'GUI файл загружен';
            } else {
                guiStatusElement.textContent = '❌';
                guiStatusElement.style.color = '#dc3545';
                guiStatusElement.title = 'GUI файл не загружен';
            }
        }
        
        if (kbStatusElement) {
            if (kbLoaded) {
                kbStatusElement.textContent = '✅';
                kbStatusElement.style.color = '#28a745';
                kbStatusElement.title = 'База знаний загружена';
            } else {
                kbStatusElement.textContent = '❌';
                kbStatusElement.style.color = '#dc3545';
                kbStatusElement.title = 'База знаний не загружена';
            }
        }
        
        if (historyStatusElement) {
            if (historyLoaded) {
                historyStatusElement.textContent = '✅';
                historyStatusElement.style.color = '#28a745';
                historyStatusElement.title = 'История болезни загружена';
            } else {
                historyStatusElement.textContent = '❌';
                historyStatusElement.style.color = '#dc3545';
                historyStatusElement.title = 'История болезни не загружена';
            }
        }
    }
    
    // Мониторинг изменений для обновления навигации
    function setupNavigationMonitoring() {
        // Обновляем навигацию при изменениях вкладок
        const observer = new MutationObserver(function() {
            updateSidebarNavigation();
        });
        
        // Наблюдаем за заголовками вкладок
        const tabHeaders = document.querySelector('.tab-headers');
        if (tabHeaders) {
            observer.observe(tabHeaders, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // Инициализация
    updateSidebarNavigation();
    updateStatusDisplay();
    setupNavigationMonitoring();
    
    // Перехватываем функцию рендеринга вкладок
    const originalRenderTabs = window.renderTabs;
    if (originalRenderTabs) {
        window.renderTabs = function() {
            originalRenderTabs.apply(this, arguments);
            setTimeout(function() {
                updateSidebarNavigation();
                // При рендеринге вкладок отмечаем, что GUI загружен
                guiLoaded = true;
                updateStatusDisplay();
            }, 100);
        };
    }
}

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ СТАТУСОВ =====

// Обновление статуса GUI файла
window.updateGUIStatus = function(isLoaded) {
    guiLoaded = isLoaded;
    
    const guiStatusElement = document.getElementById('guiStatus');
    if (guiStatusElement) {
        if (isLoaded) {
            guiStatusElement.textContent = '✅';
            guiStatusElement.style.color = '#28a745';
            guiStatusElement.title = 'GUI файл загружен';
        } else {
            guiStatusElement.textContent = '❌';
            guiStatusElement.style.color = '#dc3545';
            guiStatusElement.title = 'GUI файл не загружен';
        }
    }
};

// Обновление статуса базы знаний
window.updateKBStatus = function(isLoaded) {
    kbLoaded = isLoaded;
    
    const kbStatusElement = document.getElementById('kbStatus');
    if (kbStatusElement) {
        if (isLoaded) {
            kbStatusElement.textContent = '✅';
            kbStatusElement.style.color = '#28a745';
            kbStatusElement.title = 'База знаний загружена';
        } else {
            kbStatusElement.textContent = '❌';
            kbStatusElement.style.color = '#dc3545';
            kbStatusElement.title = 'База знаний не загружена';
        }
    }
};

// Обновление статуса истории болезни
window.updateHistoryStatus = function(isLoaded) {
    historyLoaded = isLoaded;
    
    const historyStatusElement = document.getElementById('historyStatus');
    if (historyStatusElement) {
        if (isLoaded) {
            historyStatusElement.textContent = '✅';
            historyStatusElement.style.color = '#28a745';
            historyStatusElement.title = 'История болезни загружена';
        } else {
            historyStatusElement.textContent = '❌';
            historyStatusElement.style.color = '#dc3545';
            historyStatusElement.title = 'История болезни не загружена';
        }
    }
};

// Функция для обновления всех статусов
window.updateAllStatuses = function() {
    // Проверяем GUI
    const isGUILoaded = window.jsonData && 
                       window.jsonData['Описание GUI для ПС'] && 
                       Object.keys(window.jsonData['Описание GUI для ПС']).length > 0;
    
    // Проверяем базу знаний
    const isKBLoaded = window.knowledgeBase !== null && window.knowledgeBase !== undefined;
    
    // Проверяем историю болезни - ТОЛЬКО если пользователь ввел данные или загрузил файл
    let isHistoryLoaded = false;
    
    // Проверяем только если форма была явно заполнена
    if (window.allTabsData) {
        for (const tabName in window.allTabsData) {
            const tabData = window.allTabsData[tabName];
            
            // Ищем хоть одно НЕ пустое поле
            if (tabData.data) {
                for (const fieldName in tabData.data) {
                    const value = tabData.data[fieldName];
                    if (value !== null && value !== undefined && value !== '' && 
                        !(Array.isArray(value) && value.length === 0)) {
                        isHistoryLoaded = true;
                        break;
                    }
                }
            }
            
            if (isHistoryLoaded) break;
        }
    }
    
    // Обновляем статусы
    window.updateGUIStatus(isGUILoaded);
    window.updateKBStatus(isKBLoaded);
    window.updateHistoryStatus(isHistoryLoaded);
};