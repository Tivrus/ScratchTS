/**
 * BlockChain - управление цепями блоков
 * Цепь — это группа связанных блоков, которые можно перетаскивать как единое целое
 */

import { isCBlock, getInnerBlocks, exportCBlockToJSON } from './CBlock.js';

/**
 * Получить все блоки в цепи, начиная с указанного блока
 * @param {SVGElement} startBlock - Начальный блок цепи
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Array<SVGElement>} Массив блоков в цепи
 */
export function getChainBlocks(startBlock, workspaceSVG) {
    if (!startBlock) return [];
    
    const chain = [startBlock];
    let currentBlock = startBlock;
    
    // Идем вниз по цепи через next
    while (currentBlock.dataset.next) {
        const nextBlockId = currentBlock.dataset.next;
        const nextBlock = workspaceSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
        
        if (nextBlock) {
            chain.push(nextBlock);
            currentBlock = nextBlock;
        } else {
            break;
        }
    }
    
    return chain;
}

/**
 * Получить верхний блок цепи (блок с topLevel="true")
 * @param {SVGElement} block - Любой блок в цепи
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {SVGElement|null} Верхний блок цепи
 */
export function getTopLevelBlock(block, workspaceSVG) {
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
 * Проверить, является ли блок верхним в цепи
 * @param {SVGElement} block - Блок для проверки
 * @returns {boolean} true если блок верхний в цепи
 */
export function isTopLevelBlock(block) {
    return block && block.dataset.topLevel === 'true';
}

/**
 * Переместить всю цепь блоков
 * @param {SVGElement} topBlock - Верхний блок цепи
 * @param {number} deltaX - Смещение по X
 * @param {number} deltaY - Смещение по Y
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function moveChain(topBlock, deltaX, deltaY, workspaceSVG) {
    const chain = getChainBlocks(topBlock, workspaceSVG);
    
    chain.forEach(block => {
        const transform = getTranslateValues(block.getAttribute('transform'));
        const newX = transform.x + deltaX;
        const newY = transform.y + deltaY;
        block.setAttribute('transform', `translate(${newX}, ${newY})`);
    });
}

/**
 * Разорвать цепь между двумя блоками
 * @param {SVGElement} upperBlock - Верхний блок
 * @param {SVGElement} lowerBlock - Нижний блок
 */
export function breakChain(upperBlock, lowerBlock) {
    if (!upperBlock || !lowerBlock) return;
    
    // Разрываем связи
    upperBlock.dataset.next = '';
    upperBlock.dataset.bottomConnected = 'false';
    
    lowerBlock.dataset.parent = '';
    lowerBlock.dataset.topConnected = 'false';
    lowerBlock.dataset.topLevel = 'true';
}

/**
 * Соединить две цепи
 * @param {SVGElement} upperChainBottom - Нижний блок верхней цепи
 * @param {SVGElement} lowerChainTop - Верхний блок нижней цепи
 */
export function connectChains(upperChainBottom, lowerChainTop) {
    if (!upperChainBottom || !lowerChainTop) return;
    
    upperChainBottom.dataset.next = lowerChainTop.dataset.instanceId;
    upperChainBottom.dataset.bottomConnected = 'true';
    
    lowerChainTop.dataset.parent = upperChainBottom.dataset.instanceId;
    lowerChainTop.dataset.topConnected = 'true';
    lowerChainTop.dataset.topLevel = 'false';
}

/**
 * Вставить блок/цепь между двумя блоками
 * @param {SVGElement} upperBlock - Верхний блок
 * @param {SVGElement} insertBlock - Вставляемый блок (верхний в цепи)
 * @param {SVGElement} lowerBlock - Нижний блок
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function insertBlockBetween(upperBlock, insertBlock, lowerBlock, workspaceSVG) {
    if (!upperBlock || !insertBlock || !lowerBlock) return;
    
    // Получаем нижний блок вставляемой цепи
    const insertChain = getChainBlocks(insertBlock, workspaceSVG);
    const insertChainBottom = insertChain[insertChain.length - 1];
    
    // Разрываем связь между upper и lower
    upperBlock.dataset.next = insertBlock.dataset.instanceId;
    lowerBlock.dataset.parent = insertChainBottom.dataset.instanceId;
    
    // Устанавливаем связи для вставляемого блока
    insertBlock.dataset.parent = upperBlock.dataset.instanceId;
    insertBlock.dataset.topConnected = 'true';
    insertBlock.dataset.topLevel = 'false';
    
    insertChainBottom.dataset.next = lowerBlock.dataset.instanceId;
    insertChainBottom.dataset.bottomConnected = 'true';
    
    lowerBlock.dataset.topConnected = 'true';
}

/**
 * Экспортировать цепь в JSON формат
 * @param {SVGElement} topBlock - Верхний блок цепи
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Object} JSON представление цепи
 */
export function exportChainToJSON(topBlock, workspaceSVG) {
    const blocks = {};
    const chain = getChainBlocks(topBlock, workspaceSVG);
    
    chain.forEach(block => {
        const blockData = {
            opcode: block.dataset.id,
            next: block.dataset.next || null,
            parent: block.dataset.parent || null,
            inputs: {},
            fields: {},
            topLevel: block.dataset.topLevel === 'true'
        };
        
        // Добавляем координаты для topLevel блоков
        if (blockData.topLevel) {
            const transform = getTranslateValues(block.getAttribute('transform'));
            blockData.x = transform.x;
            blockData.y = transform.y;
        }
        
        blocks[block.dataset.instanceId] = blockData;
    });
    
    return { blocks };
}

/**
 * Экспортировать все цепи рабочей области в JSON
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Object} JSON представление всех цепей
 */
export function exportWorkspaceToJSON(workspaceSVG) {
    const allBlocks = workspaceSVG.querySelectorAll('.workspace-block');
    const blocks = {};
    const processedBlocks = new Set();
    
    // Находим все верхние блоки цепей (topLevel === true)
    const topLevelBlocks = Array.from(allBlocks).filter(block => 
        block.dataset.topLevel === 'true'
    );
    
    // Рекурсивная функция для обработки блока и его внутренних блоков
    function processBlock(block) {
        // Проверяем, что у блока есть instanceId
        if (!block.dataset.instanceId || block.dataset.instanceId === 'undefined') {
            return;
        }
        
        // Пропускаем уже обработанные блоки
        if (processedBlocks.has(block.dataset.instanceId)) {
            return;
        }
        
        processedBlocks.add(block.dataset.instanceId);
        
        let blockData;
        
        // Если это c-block, используем специальную функцию экспорта
        if (isCBlock(block)) {
            blockData = exportCBlockToJSON(block, workspaceSVG);
            
            // Обрабатываем внутренние блоки c-block
            const innerBlocks = getInnerBlocks(block, workspaceSVG);
            innerBlocks.forEach(innerBlock => {
                processBlock(innerBlock);
            });
        } else {
            blockData = {
                opcode: block.dataset.id,
                next: block.dataset.next || null,
                parent: block.dataset.parent || null,
                inputs: {},
                fields: {},
                topLevel: block.dataset.topLevel === 'true'
            };
            
            // Добавляем координаты для topLevel блоков
            if (blockData.topLevel) {
                const transform = getTranslateValues(block.getAttribute('transform'));
                blockData.x = Math.round(transform.x);
                blockData.y = Math.round(transform.y);
            }
        }
        
        blocks[block.dataset.instanceId] = blockData;
    }
    
    // Обрабатываем только цепи (где есть next или parent)
    topLevelBlocks.forEach(topBlock => {
        const chain = getChainBlocks(topBlock, workspaceSVG);
        
        // Сохраняем только цепи из 2+ блоков
        if (chain.length < 2) {
            return;
        }
        
        chain.forEach(block => {
            processBlock(block);
        });
    });
    
    return { blocks };
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

