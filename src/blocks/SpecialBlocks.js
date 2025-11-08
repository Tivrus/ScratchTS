/**
 * SpecialBlocks - логика для специальных типов блоков (start-block, stop-block)
 */

import { getChainBlocks } from './BlockChain.js';

/**
 * Проверить, является ли блок специальным (start-block или stop-block)
 * @param {SVGElement} block - Блок для проверки
 * @returns {string|null} Тип специального блока или null
 */
export function getSpecialBlockType(block) {
    if (!block || !block.dataset) return null;
    
    const blockType = block.dataset.type;
    if (blockType === 'start-block' || blockType === 'stop-block') {
        return blockType;
    }
    
    return null;
}

/**
 * Проверить, имеет ли блок верхний коннектор
 * @param {SVGElement} block - Блок для проверки
 * @returns {boolean}
 */
export function hasTopConnector(block) {
    const blockType = block.dataset.type;
    // start-block не имеет верхнего коннектора
    return blockType !== 'start-block';
}

/**
 * Проверить, имеет ли блок нижний коннектор
 * @param {SVGElement} block - Блок для проверки
 * @returns {boolean}
 */
export function hasBottomConnector(block) {
    const blockType = block.dataset.type;
    // stop-block не имеет нижнего коннектора
    return blockType !== 'stop-block';
}

/**
 * Получить значения translate из transform атрибута
 * @param {string} transformAttr - Значение атрибута transform
 * @returns {Object} Объект с x и y координатами
 */
function getTranslateValues(transformAttr) {
    if (!transformAttr) {
        return { x: 0, y: 0 };
    }
    const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(transformAttr);
    if (match) {
        return {
            x: parseFloat(match[1]) || 0,
            y: parseFloat(match[2]) || 0
        };
    }
    return { x: 0, y: 0 };
}

/**
 * Обработать вставку start-block в середину цепи
 * Отсекает все блоки выше (включая targetBlock) и смещает их
 * @param {SVGElement} startBlock - Вставляемый start-block
 * @param {SVGElement} targetBlock - Блок, после которого вставляется
 * @param {SVGElement} lowerBlock - Блок, который был ниже targetBlock
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function handleStartBlockInsertion(startBlock, targetBlock, lowerBlock, workspaceSVG) {

    // Получаем верхнюю часть цепи (от topLevel до targetBlock включительно)
    const topLevelBlock = getTopLevelBlockInChain(targetBlock, workspaceSVG);
    const upperChain = getChainBlocks(topLevelBlock, workspaceSVG);
    
    // Находим индекс targetBlock в upperChain
    const targetIndex = upperChain.findIndex(b => b === targetBlock);
    
    // Отсекаем верхнюю часть (от topLevel до targetBlock включительно)
    const cutChain = upperChain.slice(0, targetIndex + 1);
    
    // Разрываем связь между targetBlock и lowerBlock
    targetBlock.dataset.next = '';
    targetBlock.dataset.bottomConnected = 'false';
    
    if (lowerBlock) {
        lowerBlock.dataset.parent = '';
        lowerBlock.dataset.topConnected = 'false';
    }
    
    // Смещаем отсеченную цепь на 50px вправо и вниз
    const offset = { x: 50, y: 50 };
    cutChain.forEach(block => {
        const transform = getTranslateValues(block.getAttribute('transform'));
        block.setAttribute('transform', `translate(${transform.x + offset.x}, ${transform.y + offset.y})`);
    });
    
    // start-block подключается к lowerBlock (если он есть)
    if (lowerBlock) {
        startBlock.dataset.next = lowerBlock.dataset.instanceId;
        startBlock.dataset.bottomConnected = 'true';
        
        lowerBlock.dataset.parent = startBlock.dataset.instanceId;
        lowerBlock.dataset.topConnected = 'true';
        lowerBlock.dataset.topLevel = 'false';
    }
    
    // start-block становится началом новой цепи
    startBlock.dataset.topLevel = 'true';
    startBlock.dataset.parent = '';
    startBlock.dataset.topConnected = 'false';
  
}

/**
 * Обработать вставку stop-block в середину цепи
 * Отсекает все блоки ниже (включая lowerBlock) и смещает их
 * @param {SVGElement} stopBlock - Вставляемый stop-block
 * @param {SVGElement} targetBlock - Блок, после которого вставляется
 * @param {SVGElement} lowerBlock - Блок, который был ниже targetBlock
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function handleStopBlockInsertion(stopBlock, targetBlock, lowerBlock, workspaceSVG) {

    if (!lowerBlock) {
        // Нет нижней части для отсечения
        stopBlock.dataset.parent = targetBlock.dataset.instanceId;
        stopBlock.dataset.topConnected = 'true';
        stopBlock.dataset.topLevel = 'false';
        
        targetBlock.dataset.next = stopBlock.dataset.instanceId;
        targetBlock.dataset.bottomConnected = 'true';
        return;
    }
    
    // Получаем нижнюю часть цепи (от lowerBlock и ниже)
    const lowerChain = getChainBlocks(lowerBlock, workspaceSVG);
    
    // Разрываем связь между targetBlock и lowerBlock
    targetBlock.dataset.next = '';
    targetBlock.dataset.bottomConnected = 'false';
    
    lowerBlock.dataset.parent = '';
    lowerBlock.dataset.topConnected = 'false';
    lowerBlock.dataset.topLevel = 'true';
    
    // Смещаем отсеченную цепь на 50px вправо и вниз
    const offset = { x: 50, y: 50 };
    lowerChain.forEach(block => {
        const transform = getTranslateValues(block.getAttribute('transform'));
        block.setAttribute('transform', `translate(${transform.x + offset.x}, ${transform.y + offset.y})`);
    });
    
    // stop-block подключается к targetBlock
    stopBlock.dataset.parent = targetBlock.dataset.instanceId;
    stopBlock.dataset.topConnected = 'true';
    stopBlock.dataset.topLevel = 'false';
    
    targetBlock.dataset.next = stopBlock.dataset.instanceId;
    targetBlock.dataset.bottomConnected = 'true';
    
    // stop-block не имеет нижнего коннектора
    stopBlock.dataset.next = '';
    stopBlock.dataset.bottomConnected = 'false';
    
}

/**
 * Получить верхний блок цепи (блок с topLevel="true")
 * @param {SVGElement} block - Любой блок в цепи
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {SVGElement|null} Верхний блок цепи
 */
function getTopLevelBlockInChain(block, workspaceSVG) {
    if (!block) return null;
    
    let currentBlock = block;
    
    // Идем вверх по цепи через parent
    while (currentBlock.dataset.parent) {
        const parentBlockId = currentBlock.dataset.parent;
        const parentBlock = workspaceSVG.querySelector(`[data-instance-id="${parentBlockId}"]`);
        
        if (parentBlock) {
            currentBlock = parentBlock;
        } else {
            break;
        }
    }
    
    return currentBlock;
}

/**
 * Проверить, нужна ли специальная обработка для вставки блока
 * @param {SVGElement} insertedBlock - Вставляемый блок
 * @param {SVGElement} targetBlock - Блок, после которого вставляется
 * @param {SVGElement} lowerBlock - Блок, который был ниже targetBlock
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {boolean} true если была применена специальная обработка
 */
export function handleSpecialBlockInsertion(insertedBlock, targetBlock, lowerBlock, workspaceSVG) {
    const specialType = getSpecialBlockType(insertedBlock);
    
    if (!specialType) {
        return false; // Не специальный блок
    }
    
    if (specialType === 'start-block') {
        handleStartBlockInsertion(insertedBlock, targetBlock, lowerBlock, workspaceSVG);
        return true;
    }
    
    if (specialType === 'stop-block') {
        handleStopBlockInsertion(insertedBlock, targetBlock, lowerBlock, workspaceSVG);
        return true;
    }
    
    return false;
}

