import { initializeCategories } from './categories/CategoryList.js';
import { initializeBlockLibrary } from './blocks/BlockLibrary.js';
import { initializeDragAndDrop } from './ui/DragAndDrop.js';
import { loadWorkspaceState } from './utils/WorkspaceState.js';
import { loadWorkspaceFromJSON } from './utils/WorkspaceLoader.js';
import { exportWorkspaceToJSON } from './blocks/BlockChain.js';
import { saveWorkspaceState } from './utils/WorkspaceState.js';

document.addEventListener('DOMContentLoaded', async () => {
    const blockLibrary = initializeBlockLibrary();
    const workspaceSVG = document.querySelector('#block-container');

    initializeCategories({
        onCategoryChange: (categoryId) => {
            blockLibrary.loadBlocksForCategory(categoryId);
        }
    });

    initializeDragAndDrop();

    // Загружаем сохраненный workspace при старте
    if (workspaceSVG) {
        try {
            const savedState = await loadWorkspaceState();
            if (savedState && savedState.blocks && Object.keys(savedState.blocks).length > 0) {
                const loaded = await loadWorkspaceFromJSON(savedState, workspaceSVG);
                if (loaded) {
                    console.log('[App] Workspace loaded from saved state');
                }
            }
        } catch (error) {
            console.error('[App] Error loading workspace:', error);
        }
    }

    // Регистрируем функции для вызова из Qt
    if (typeof window !== 'undefined' && workspaceSVG) {
        window.loadWorkspaceFromJSON = async (workspaceData) => {
            try {
                const loaded = await loadWorkspaceFromJSON(workspaceData, workspaceSVG);
                if (loaded) {
                    await saveWorkspaceState(workspaceSVG);
                    console.log('[App] Workspace loaded from JSON');
                    return true;
                }
                return false;
            } catch (error) {
                console.error('[App] Error loading workspace from JSON:', error);
                return false;
            }
        };

        window.clearWorkspace = async () => {
            const allBlocks = workspaceSVG.querySelectorAll('.workspace-block');
            allBlocks.forEach(block => block.remove());
            await saveWorkspaceState(workspaceSVG);
            console.log('[App] Workspace cleared');
        };

        window.getWorkspaceJSON = () => {
            return exportWorkspaceToJSON(workspaceSVG);
        };

        window.saveWorkspace = async () => {
            await saveWorkspaceState(workspaceSVG);
        };

        // // Выводим информацию о доступных функциях в консоль
        // console.log('%c=== Qt Integration Functions ===', 'color: #4c97ff; font-weight: bold; font-size: 14px;');
        // console.log('%cДоступные функции для вызова из Qt:', 'color: #ecf0f1; font-weight: bold;');
        // console.log('%c1. loadWorkspaceFromJSON(workspaceData)', 'color: #4c97ff;');
        // console.log('   Загружает workspace из JSON объекта');
        // console.log('   Параметры: workspaceData (Object) - JSON объект с данными workspace');
        // console.log('   Возвращает: Promise<boolean> - успешность загрузки');
        // console.log('');
        // console.log('%c2. clearWorkspace()', 'color: #4c97ff;');
        // console.log('   Очищает workspace (удаляет все блоки)');
        // console.log('   Возвращает: Promise<void>');
        // console.log('');
        // console.log('%c3. getWorkspaceJSON()', 'color: #4c97ff;');
        // console.log('   Получает текущий workspace в виде JSON');
        // console.log('   Возвращает: Object - JSON объект с данными workspace');
        // console.log('');
        // console.log('%c4. saveWorkspace()', 'color: #4c97ff;');
        // console.log('   Сохраняет текущий workspace');
        // console.log('   Возвращает: Promise<void>');
        // console.log('');
        // console.log('%cПример использования из Qt:', 'color: #53B120; font-weight: bold;');
        // console.log('%c// Загрузить workspace', 'color: #ecf0f1;');
        // console.log('%cwindow.loadWorkspaceFromJSON(workspaceData);', 'color: #f39c12;');
        // console.log('');
        // console.log('%c// Очистить workspace', 'color: #ecf0f1;');
        // console.log('%cwindow.clearWorkspace();', 'color: #f39c12;');
        // console.log('');
        // console.log('%c// Получить JSON workspace', 'color: #ecf0f1;');
        // console.log('%cconst json = window.getWorkspaceJSON();', 'color: #f39c12;');
        // console.log('');
        // console.log('%c// Сохранить workspace', 'color: #ecf0f1;');
        // console.log('%cwindow.saveWorkspace();', 'color: #f39c12;');
        // console.log('%c================================', 'color: #4c97ff; font-weight: bold; font-size: 14px;');
    }
});