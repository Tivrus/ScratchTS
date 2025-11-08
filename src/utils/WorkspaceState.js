/**
 * WorkspaceState - управление состоянием рабочей области и автосохранение
 */

import { exportWorkspaceToJSON } from '../blocks/BlockChain.js';

let autoSaveEnabled = true;
let lastSavedState = null;
let workspaceSVGRef = null; // Ссылка на workspace для глобальных функций
const API_URL = 'http://localhost:3001/api';

/**
 * Сохранить состояние рабочей области
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export async function saveWorkspaceState(workspaceSVG) {
    if (!autoSaveEnabled) return;
    
    const state = exportWorkspaceToJSON(workspaceSVG);
    const stateJSON = JSON.stringify(state, null, 2);
    
    // Проверяем, изменилось ли состояние
    if (stateJSON === lastSavedState) {
        return;
    }
    
    lastSavedState = stateJSON;
    
    // Сохраняем в localStorage как резервную копию
    try {
        localStorage.setItem('workspace', stateJSON);
    } catch (error) {
        console.error('[WorkspaceState] Failed to save to localStorage:', error);
    }
    
    // Сохраняем в файл через API
    try {
        const response = await fetch(`${API_URL}/save-workspace`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: stateJSON
        });
        
        const result = await response.json();
        
        if (result.success) {
            
            // Вызываем событие для уведомления других компонентов
            window.dispatchEvent(new CustomEvent('workspace-saved', { detail: state }));
        } else {
            console.error('[WorkspaceState] Failed to save workspace:', result.error);
        }
    } catch (error) {
        console.error('[WorkspaceState] Failed to save workspace to file:', error);
        console.log('[WorkspaceState] Make sure the server is running (npm start)');
    }
}

/**
 * Загрузить состояние рабочей области
 * @returns {Promise<Object|null>} Загруженное состояние или null
 */
export async function loadWorkspaceState() {
    // Сначала пытаемся загрузить из файла через API
    try {
        const response = await fetch(`${API_URL}/load-workspace`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const stateJSON = JSON.stringify(result.data, null, 2);
            lastSavedState = stateJSON;
            return result.data;
        }
    } catch (error) {
        console.error('[WorkspaceState] Failed to load from file:', error);
    }
    
    // Если не получилось загрузить из файла, пытаемся из localStorage
    try {
        const stateJSON = localStorage.getItem('scratchts_workspace');
        if (stateJSON) {
            const state = JSON.parse(stateJSON);
            lastSavedState = stateJSON;
            return state;
        }
    } catch (error) {
        console.error('[WorkspaceState] Failed to load workspace:', error);
    }
    
    return null;
}

/**
 * Очистить сохраненное состояние
 */
export function clearWorkspaceState() {
    try {
        localStorage.removeItem('scratchts_workspace');
        lastSavedState = null;
    } catch (error) {
        console.error('[WorkspaceState] Failed to clear workspace:', error);
    }
}

/**
 * Включить/выключить автосохранение
 * @param {boolean} enabled - Включить или выключить
 */
export function setAutoSaveEnabled(enabled) {
    autoSaveEnabled = enabled;
}


/**
 * Экспортировать состояние в файл
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @param {string} filename - Имя файла
 */
export function exportToFile(workspaceSVG, filename = 'workspace.json') {
    const state = exportWorkspaceToJSON(workspaceSVG);
    const stateJSON = JSON.stringify(state, null, 2);
    
    const blob = new Blob([stateJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * Импортировать состояние из файла
 * @param {File} file - Файл для импорта
 * @returns {Promise<Object>} Промис с загруженным состоянием
 */
export function importFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const state = JSON.parse(event.target.result);
                resolve(state);
            } catch (error) {
                reject(new Error('Invalid JSON file'));
            }
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsText(file);
    });
}

/**
 * Инициализировать глобальные функции для работы с состоянием
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function initWorkspaceState(workspaceSVG) {
    workspaceSVGRef = workspaceSVG;
    
    // Регистрируем глобальные функции для удобства использования в консоли
    if (typeof window !== 'undefined') {
        window.saveWorkspace = () => {
            if (workspaceSVGRef) {
                saveWorkspaceState(workspaceSVGRef);
            } else {
                console.error('[WorkspaceState] Workspace not initialized');
            }
        };
        
        window.loadWorkspace = async () => {
            const state = await loadWorkspaceState();
            if (state) {
                console.log('[WorkspaceState] Workspace loaded:', state);
                return state;
            } else {
                return null;
            }
        };
        
        window.clearWorkspace = () => {
            clearWorkspaceState();
        };
        
        window.exportWorkspace = (filename) => {
            if (workspaceSVGRef) {
                exportToFile(workspaceSVGRef, filename);
            } else {
                console.error('[WorkspaceState] Workspace not initialized');
            }
        };
        
        window.getWorkspaceJSON = () => {
            if (workspaceSVGRef) {
                const state = exportWorkspaceToJSON(workspaceSVGRef);
                return state;
            } else {
                console.error('[WorkspaceState] Workspace not initialized');
                return null;
            }
        };
        
    }
}

