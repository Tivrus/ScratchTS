import { isCBlock, getInnerBlocks, exportCBlockToJSON, hasInnerBlocks } from './CBlock.js';
import { getTranslateValues } from '../utils/DOMUtils.js';

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

export function getAllChainBlocks(startBlock, workspaceSVG) {
    if (!startBlock) return [];
    
    const allBlocks = [];
    const chain = getChainBlocks(startBlock, workspaceSVG);
    
    // Для каждого блока в цепи
    chain.forEach(block => {
        allBlocks.push(block);
        
        // Если это c-block, добавляем все его внутренние блоки рекурсивно
        if (isCBlock(block)) {
            const innerBlocks = getInnerBlocks(block, workspaceSVG);
            if (innerBlocks.length > 0) {
                // Рекурсивно получаем все блоки из внутренней цепи
                const innerChainBlocks = getAllChainBlocks(innerBlocks[0], workspaceSVG);
                allBlocks.push(...innerChainBlocks);
            }
        }
    });
    
    return allBlocks;
}

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


export function isTopLevelBlock(block) {
    return block && block.dataset.topLevel === 'true';
}

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
    
    // Обрабатываем все topLevel блоки
    topLevelBlocks.forEach(topBlock => {
        const chain = getChainBlocks(topBlock, workspaceSVG);
        
        // Сохраняем цепи из 2+ блоков или одиночные c-block с внутренними блоками
        const shouldSave = chain.length >= 2 || 
            (chain.length === 1 && isCBlock(chain[0]) && hasInnerBlocks(chain[0]));
        
        if (!shouldSave) {
            return;
        }
        
        chain.forEach(block => {
            processBlock(block);
        });
    });
    
    return { blocks };
}

