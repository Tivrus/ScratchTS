/**
 * CBlock - управление логикой c-block (циклы и условия)
 * c-block может содержать блоки внутри себя и динамически растягиваться
 */

import { getChainBlocks, getAllChainBlocks } from './BlockChain.js';
import { BLOCK_FORMS, DEFAULT_BLOCK_HEIGHT, CBLOCK_NESTED_X_OFFSET, SVG_NS } from '../utils/Constants.js';
import PathUtils from '../utils/PathUtils.js';
import { getTranslateValues } from '../utils/DOMUtils.js';
export const C_BLOCK_EMPTY_INNER_SPACE = 24; // Базовое «пустое» пространство внутри c-block

/**
 * Проверить, является ли блок c-block
 * @param {SVGElement} block - Блок для проверки
 * @returns {boolean}
 */
export function isCBlock(block) {
    return block && block.dataset.type === 'c-block';
}

/**
 * Получить блоки внутри c-block (SUBSTACK)
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Array<SVGElement>} Массив блоков внутри c-block
 */
export function getInnerBlocks(cBlock, workspaceSVG) {
    if (!isCBlock(cBlock)) return [];
    
    const substackId = cBlock.dataset.substack;
    if (!substackId) return [];
    
    const firstInnerBlock = workspaceSVG.querySelector(`[data-instance-id="${substackId}"]`);
    if (!firstInnerBlock) return [];
    
    return getChainBlocks(firstInnerBlock, workspaceSVG);
}

/**
 * Проверить, есть ли блоки внутри c-block
 * @param {SVGElement} cBlock - C-block
 * @returns {boolean}
 */
export function hasInnerBlocks(cBlock) {
    return isCBlock(cBlock) && !!cBlock.dataset.substack;
}

/**
 * Проверить, находится ли блок внутри c-block (в SUBSTACK)
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} block - Проверяемый блок
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {boolean} true если блок находится внутри c-block
 */
export function isBlockInsideCBlock(cBlock, block, workspaceSVG) {
    if (!isCBlock(cBlock) || !block) return false;
    
    const innerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    return innerBlocks.includes(block);
}

/**
 * Получить уровень вложенности блока (количество родительских c-block)
 * @param {SVGElement} block - Блок для проверки
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {number} Уровень вложенности (0 для top-level блоков)
 */
export function getNestedLevel(block, workspaceSVG) {
    if (!block || !workspaceSVG) return 0;
    
    let level = 0;
    let currentBlock = block;
    
    while (currentBlock && currentBlock.dataset.parent) {
        const parentId = currentBlock.dataset.parent;
        const parentBlock = workspaceSVG.querySelector(`[data-instance-id="${parentId}"]`);
        if (!parentBlock) break;
        
        if (isCBlock(parentBlock)) {
            level++;
        }
        currentBlock = parentBlock;
    }
    
    return level;
}

/**
 * Вычислить правильную X координату для блока в цепи
 * Правила:
 * 1. Все блоки в одной цепи (на одном уровне) имеют одинаковый X
 * 2. Для внутренних блоков c-block: X = родительский X + уровень_вложенности * 16
 * 3. Для внешних блоков (top-level): X берется от первого блока в цепи
 * 
 * @param {SVGElement} chainFirstBlock - Первый блок в цепи (для определения базового X)
 * @param {SVGElement} targetBlock - Блок, для которого вычисляем X
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {number} Правильная X координата
 */
export function calculateChainBlockX(chainFirstBlock, targetBlock, workspaceSVG) {
    if (!chainFirstBlock || !targetBlock || !workspaceSVG) return 0;
    
    // ВАЖНО: все блоки в одной цепи находятся на одном уровне вложенности
    // и должны иметь одинаковый X. Смещение по X применяется при вставке
    // внутрь c-block через getInsertPosition, где вычисляется правильный X
    // с учетом уровня вложенности родительского c-block.
    const chainFirstTransform = getTranslateValues(chainFirstBlock.getAttribute('transform'));
    
    // Все блоки в цепи используют X первого блока
    return chainFirstTransform.x;
}

/**
 * Вычислить X координату для блока с учетом уровня вложенности (старая функция, оставлена для совместимости)
 * @param {SVGElement} baseBlock - Базовый блок (обычно первый в цепи или c-block)
 * @param {SVGElement} targetBlock - Целевой блок (для которого вычисляем X)
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {number} X координата
 */
export function calculateBlockX(baseBlock, targetBlock, workspaceSVG) {
    return calculateChainBlockX(baseBlock, targetBlock, workspaceSVG);
}

/**
 * Получить высоту внутренней части c-block (суммарная высота вложенных блоков)
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {number} Высота в пикселях
 */
export function getInnerHeight(cBlock, workspaceSVG) {
    const innerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    if (innerBlocks.length === 0) return 0;
    
    // Точный расчет высоты: первая высота целиком, далее учитываем коннекторные стыки
    // ВАЖНО: 
    // 1. topOffset первого блока не должен учитываться (блок начинается с позиции innerOffsetY)
    // 2. bottomOffset последнего блока не должен учитываться (уже учтен в базовой высоте c-block)
    let totalHeight = 0;
    for (let i = 0; i < innerBlocks.length; i++) {
        const block = innerBlocks[i];
        const type = block.dataset.type;
        const form = BLOCK_FORMS[type] || {};
        const pathHeight = type === 'c-block'
            ? (parseFloat(block.dataset.height) || form?.pathHeight || DEFAULT_BLOCK_HEIGHT)
            : (form?.pathHeight || parseFloat(block.dataset.height) || DEFAULT_BLOCK_HEIGHT);
        
        if (i === 0) {
            // Для первого блока вычитаем topOffset, так как блок начинается с позиции innerOffsetY
            const firstTopOffset = form.topOffset || 0;
            totalHeight += pathHeight - firstTopOffset;
        } else {
            const prev = innerBlocks[i - 1];
            const prevType = prev.dataset.type;
            const prevForm = BLOCK_FORMS[prevType] || {};
            const prevPathHeight = prevType === 'c-block'
                ? (parseFloat(prev.dataset.height) || prevForm?.pathHeight || DEFAULT_BLOCK_HEIGHT)
                : (prevForm?.pathHeight || parseFloat(prev.dataset.height) || DEFAULT_BLOCK_HEIGHT);
            const joinDelta = prevPathHeight - (prevForm.bottomOffset || 0) + (form.topOffset || 0);
            totalHeight += joinDelta;
        }
    }
    
    // Вычитаем bottomOffset последнего блока, так как он уже учтен в базовой высоте c-block
    // ВАЖНО: для обычных блоков нужно вычитать bottomOffset + 1 (избыток 10 пикселей)
    // для c-block нужно вычитать bottomOffset - 5 (избыток 5 пикселей)
    const lastBlock = innerBlocks[innerBlocks.length - 1];
    const lastBlockType = lastBlock.dataset.type;
    const lastBlockForm = BLOCK_FORMS[lastBlockType] || {};
    const lastBottomOffset = lastBlockForm.bottomOffset || 0;
    
    // Корректировка для разных типов блоков
    let correction = 0;
    if (lastBlockType === 'c-block') {
        // Для c-block: bottomOffset = 10, избыток = 5, значит нужно вычесть 10 - 5 = 5
        correction = -5;
    } else {
        // Для обычных блоков: bottomOffset = 9, избыток = 10, значит нужно вычесть 9 + 1 = 10
        correction = 1;
    }
    
    return totalHeight - lastBottomOffset - correction;
}

/**
 * Получить количество блоков внутри c-block
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {number} Количество блоков
 */
export function getInnerBlocksCount(cBlock, workspaceSVG) {
    const innerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    return innerBlocks.length;
}

/**
 * Получить актуальную высоту c-block
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {number} Высота в пикселях
 */
export function getCBlockHeight(cBlock, workspaceSVG) {
    if (!isCBlock(cBlock)) return 0;
    
    // Если есть сохраненная высота, используем её
    if (cBlock.dataset.height) {
        return parseFloat(cBlock.dataset.height);
    }
    
    // Иначе вычисляем базовую высоту + эффективную высоту внутренних блоков
    const baseHeight = BLOCK_FORMS['c-block'].height;
    const effectiveInnerHeight = getEffectiveInnerHeight(cBlock, workspaceSVG);
    
    return baseHeight + effectiveInnerHeight;
}

/**
 * Получить состояние c-block (для отладки и управления)
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Object} Объект с информацией о состоянии c-block
 */
export function getCBlockState(cBlock, workspaceSVG) {
    if (!isCBlock(cBlock)) return null;
    
    const innerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    const hasBlocks = innerBlocks.length > 0;
    const innerHeight = getInnerHeight(cBlock, workspaceSVG);
    const effectiveInnerHeight = getEffectiveInnerHeight(cBlock, workspaceSVG);
    const totalHeight = getCBlockHeight(cBlock, workspaceSVG);
    const baseHeight = BLOCK_FORMS['c-block'].height;
    
    return {
        hasInnerBlocks: hasBlocks,
        innerBlocksCount: innerBlocks.length,
        innerBlocks: innerBlocks,
        innerHeight,
        effectiveInnerHeight,
        totalHeight,
        baseHeight,
        hasNext: !!cBlock.dataset.next,
        isTopLevel: cBlock.dataset.topLevel === 'true',
        innerConnectorActive: !hasBlocks // Внутренний коннектор активен только если нет блоков
    };
}

/**
 * Синхронизировать высоту c-block с внутренними блоками
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function syncCBlockHeight(cBlock, workspaceSVG) {
    if (!isCBlock(cBlock)) return;
    
    const baseHeight = BLOCK_FORMS['c-block'].height;
    const effectiveInnerHeight = getEffectiveInnerHeight(cBlock, workspaceSVG);
    const correctHeight = baseHeight + effectiveInnerHeight;
    
    const currentHeight = parseFloat(cBlock.dataset.height) || baseHeight;
    const diff = correctHeight - currentHeight;
    
    if (Math.abs(diff) > 0.1) {
        // Высота не синхронизирована, обновляем
        if (typeof window !== 'undefined' && window.__CB_DEBUG) {
            console.log('[CBlock] syncCBlockHeight', {
                cBlock: cBlock?.dataset?.instanceId,
                currentHeight,
                correctHeight,
                effectiveInnerHeight,
                diff
            });
        }
        resizeCBlock(cBlock, diff, workspaceSVG);
    }
}

/**
 * Синхронизировать размеры всех родительских c-block для указанного блока
 * Проходим вверх по parent-цепочке и для каждого встретившегося c-block вызываем syncCBlockHeight
 * @param {SVGElement} block - Блок, от которого начинаем подниматься вверх (обычно это сам c-block)
 * @param {SVGElement} workspaceSVG
 */
export function syncCBlockAncestors(block, workspaceSVG) {
    let current = block;
    const visited = new Set();
    while (current && current.dataset && current.dataset.parent && !visited.has(current.dataset.parent)) {
        visited.add(current.dataset.parent);
        const parentId = current.dataset.parent;
        const parentBlock = workspaceSVG.querySelector(`[data-instance-id="${parentId}"]`);
        if (!parentBlock) break;
        if (isCBlock(parentBlock)) {
            if (typeof window !== 'undefined' && window.__CB_DEBUG) {
                console.log('[CBlock] syncCBlockAncestors -> parent c-block', parentBlock.dataset.instanceId);
            }
            syncCBlockHeight(parentBlock, workspaceSVG);
            // Продолжаем подниматься, т.к. родительский c-block мог изменить высоту, что влияет на его родителей
        }
        current = parentBlock;
    }
}

/**
 * Синхронизировать высоты всех c-block в рабочей области
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function syncAllCBlockHeights(workspaceSVG) {
    if (!workspaceSVG) return;
    
    // Находим все c-block в рабочей области
    const allBlocks = workspaceSVG.querySelectorAll('.workspace-block');
    const cBlocks = Array.from(allBlocks).filter(block => isCBlock(block));
    
    // Синхронизируем высоту каждого c-block
    cBlocks.forEach(cBlock => {
        syncCBlockHeight(cBlock, workspaceSVG);
    });
}

/**
 * Растянуть c-block по вертикали
 * @param {SVGElement} cBlock - C-block для растяжения
 * @param {number} additionalHeight - Дополнительная высота (может быть отрицательной для сжатия)
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области (опционально, для смещения блоков после c-block)
 */
export function resizeCBlock(cBlock, additionalHeight, workspaceSVG = null) {
    if (!isCBlock(cBlock)) return;
    if (Math.abs(additionalHeight) < 0.01) return; // Игнорируем микроскопические изменения
    
    const pathElement = cBlock.querySelector('path');
    if (!pathElement) return;
    
    const currentPath = pathElement.getAttribute('d');
    const resizeConfig = PathUtils.getBlockResizeConfig('c-block');
    
    if (!resizeConfig || !resizeConfig.vIndices || resizeConfig.vIndices.length === 0) {
        console.warn('[CBlock] No vertical resize configuration for c-block');
        return;
    }
    
    // Получаем текущую высоту
    const currentHeight = parseFloat(cBlock.dataset.height) || BLOCK_FORMS['c-block'].height;
    
    // Растягиваем path по вертикали
    const newPath = PathUtils.resizeBlockPath(currentPath, {
        horizontal: 0,
        vertical: additionalHeight,
        hIndices: [],
        vIndices: resizeConfig.vIndices
    });
    
    pathElement.setAttribute('d', newPath);
    
    // Обновляем высоту в dataset
    const newHeight = currentHeight + additionalHeight;
    cBlock.dataset.height = String(newHeight);
    
    // Сохраняем текущую высоту внутренней части
    const currentInnerHeight = parseFloat(cBlock.dataset.innerHeight) || 0;
    cBlock.dataset.innerHeight = String(currentInnerHeight + additionalHeight);
    
    // ВАЖНО: Смещаем все блоки, которые стоят ПОСЛЕ c-block
    if (workspaceSVG) {
        if (typeof window !== 'undefined' && window.__CB_DEBUG) {
            console.log('[CBlock] resizeCBlock', {
                cBlock: cBlock?.dataset?.instanceId,
                additionalHeight,
                newHeight,
                next: cBlock?.dataset?.next
            });
        }
        updateBlocksAfterCBlock(cBlock, additionalHeight, workspaceSVG);
        // Пропагируем изменение вверх: родительские c-block должны синхронизировать высоту,
        // поскольку высота текущего c-block изменилась.
        syncCBlockAncestors(cBlock, workspaceSVG);
    }
}

/**
 * Вставить блок внутрь c-block
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} insertBlock - Вставляемый блок (верхний в цепи)
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @param {number} x - X координата для вставки
 * @param {number} y - Y координата для вставки
 * @param {boolean} atBottom - Вставить в конец (true) или в начало (false)
 */
export function insertBlockInside(cBlock, insertBlock, workspaceSVG, x, y, atBottom = false) {
    if (!isCBlock(cBlock)) return;
    
    const insertChain = getChainBlocks(insertBlock, workspaceSVG);
    const existingInnerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    
    // Вычисляем ТОЧНУЮ высоту вставляемой цепи с учетом коннекторных отступов
    let insertChainHeight = 0;
    for (let i = 0; i < insertChain.length; i++) {
        const block = insertChain[i];
        const type = block.dataset.type;
        const form = BLOCK_FORMS[type] || {};
        const pathHeight = form?.pathHeight || parseFloat(block.dataset.height) || DEFAULT_BLOCK_HEIGHT;
        if (i === 0) {
            insertChainHeight += pathHeight;
        } else {
            const prev = insertChain[i - 1];
            const prevType = prev.dataset.type;
            const prevForm = BLOCK_FORMS[prevType] || {};
            const prevPathHeight = prevForm?.pathHeight || parseFloat(prev.dataset.height) || DEFAULT_BLOCK_HEIGHT;
            const joinDelta = prevPathHeight - (prevForm.bottomOffset || 0) + (form.topOffset || 0);
            insertChainHeight += joinDelta;
        }
    }
    
    // Если внутри уже есть блоки, вставляем в конец или в начало
    if (existingInnerBlocks.length > 0) {
        if (atBottom) {
            // Добавляем в конец существующих блоков
            const lastInnerBlock = existingInnerBlocks[existingInnerBlocks.length - 1];
            const lastTransform = getTranslateValues(lastInnerBlock.getAttribute('transform'));
            const lastBlockType = lastInnerBlock.dataset.type;
            const lastBlockForm = BLOCK_FORMS[lastBlockType];
            const lastBlockHeight = lastBlockForm?.pathHeight || parseFloat(lastInnerBlock.dataset.height) || DEFAULT_BLOCK_HEIGHT;
            const nextForm = BLOCK_FORMS[insertBlock.dataset.type] || {};
            
            // Позиция для нового блока
            const insertY = lastTransform.y + (lastBlockHeight - (lastBlockForm.bottomOffset || 0) + (nextForm.topOffset || 0));
            
            // Позиционируем вставляемую цепь
            // ВАЖНО: все блоки в цепи должны иметь одинаковый X (вычисленный от первого блока)
            insertBlock.setAttribute('transform', `translate(${x}, ${insertY})`);
            let currentY = insertY;
            for (let i = 1; i < insertChain.length; i++) {
                const block = insertChain[i];
                const prevBlock = insertChain[i - 1];
                const prevBlockType = prevBlock.dataset.type;
                const prevBlockForm = BLOCK_FORMS[prevBlockType];
                const prevBlockHeight = prevBlockForm?.pathHeight || parseFloat(prevBlock.dataset.height) || DEFAULT_BLOCK_HEIGHT;
                const nextForm2 = BLOCK_FORMS[block.dataset.type] || {};
                const joinDelta = prevBlockHeight - (prevBlockForm.bottomOffset || 0) + (nextForm2.topOffset || 0);
                currentY += joinDelta;
                // ВАЖНО: все блоки в цепи используют одинаковый X (вычисленный от первого блока)
                const blockX = calculateChainBlockX(insertBlock, block, workspaceSVG);
                block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
            }
            
            // Соединяем цепи
            lastInnerBlock.dataset.next = insertBlock.dataset.instanceId;
            lastInnerBlock.dataset.bottomConnected = 'true';
            
            insertBlock.dataset.parent = lastInnerBlock.dataset.instanceId;
            insertBlock.dataset.topConnected = 'true';
            insertBlock.dataset.topLevel = 'false';
        } else {
            // Вставляем в начало существующих блоков
            const firstInnerBlock = existingInnerBlocks[0];
            
            // Позиционируем вставляемую цепь
            // ВАЖНО: все блоки в цепи должны иметь одинаковый X (вычисленный от первого блока)
            insertBlock.setAttribute('transform', `translate(${x}, ${y})`);
            let currentY = y;
            for (let i = 1; i < insertChain.length; i++) {
                const block = insertChain[i];
                const prevBlock = insertChain[i - 1];
                const prevBlockType = prevBlock.dataset.type;
                const prevBlockForm = BLOCK_FORMS[prevBlockType];
                const prevBlockHeight = prevBlockForm?.pathHeight || parseFloat(prevBlock.dataset.height) || DEFAULT_BLOCK_HEIGHT;
                const nextForm = BLOCK_FORMS[block.dataset.type] || {};
                const joinDelta = prevBlockHeight - (prevBlockForm.bottomOffset || 0) + (nextForm.topOffset || 0);
                currentY += joinDelta;
                // ВАЖНО: все блоки в цепи используют одинаковый X (вычисленный от первого блока)
                const blockX = calculateChainBlockX(insertBlock, block, workspaceSVG);
                block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
            }
            
            // Смещаем существующие блоки вниз
            existingInnerBlocks.forEach(block => {
                const transform = getTranslateValues(block.getAttribute('transform'));
                block.setAttribute('transform', `translate(${transform.x}, ${transform.y + insertChainHeight})`);
            });
            
            // Обновляем связи
            const lastInsertBlock = insertChain[insertChain.length - 1];
            lastInsertBlock.dataset.next = firstInnerBlock.dataset.instanceId;
            lastInsertBlock.dataset.bottomConnected = 'true';
            
            firstInnerBlock.dataset.parent = lastInsertBlock.dataset.instanceId;
            firstInnerBlock.dataset.topConnected = 'true';
            
            insertBlock.dataset.parent = cBlock.dataset.instanceId;
            insertBlock.dataset.topConnected = 'true';
            insertBlock.dataset.topLevel = 'false';
            
            // Обновляем substack c-block
            cBlock.dataset.substack = insertBlock.dataset.instanceId;
        }
    } else {
        // Первая вставка внутрь c-block
        cBlock.dataset.substack = insertBlock.dataset.instanceId;
        
        // Позиционируем вставляемую цепь
        // ВАЖНО: все блоки в цепи должны иметь одинаковый X (вычисленный от первого блока)
        insertBlock.setAttribute('transform', `translate(${x}, ${y})`);
        let currentY = y;
        for (let i = 1; i < insertChain.length; i++) {
            const block = insertChain[i];
            const prevBlock = insertChain[i - 1];
            const prevBlockType = prevBlock.dataset.type;
            const prevBlockForm = BLOCK_FORMS[prevBlockType];
            const prevBlockHeight = prevBlockForm?.pathHeight || parseFloat(prevBlock.dataset.height) || DEFAULT_BLOCK_HEIGHT;
            const nextForm = BLOCK_FORMS[block.dataset.type] || {};
            const joinDelta = prevBlockHeight - (prevBlockForm.bottomOffset || 0) + (nextForm.topOffset || 0);
            currentY += joinDelta;
            // ВАЖНО: все блоки в цепи используют одинаковый X (вычисленный от первого блока)
            const blockX = calculateChainBlockX(insertBlock, block, workspaceSVG);
            block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
        }
        
        insertBlock.dataset.parent = cBlock.dataset.instanceId;
        insertBlock.dataset.topConnected = 'true';
        insertBlock.dataset.topLevel = 'false';
    }
    
    // Вычисляем ПРАВИЛЬНУЮ высоту c-block на основе ВСЕХ внутренних блоков
    const baseHeight = BLOCK_FORMS['c-block'].height;
    const effectiveInnerHeight = getEffectiveInnerHeight(cBlock, workspaceSVG);
    const correctHeight = baseHeight + effectiveInnerHeight;
    
    const currentHeight = parseFloat(cBlock.dataset.height) || baseHeight;
    const heightDiff = correctHeight - currentHeight;
    
    // Растягиваем/сжимаем c-block до правильной высоты (не инкрементально!)
    if (Math.abs(heightDiff) > 0.1) {
        resizeCBlock(cBlock, heightDiff, workspaceSVG);
    }
    
    // После изменения текущего c-block необходимо синхронизировать всех родительских c-block (внешние)
    syncCBlockAncestors(cBlock, workspaceSVG);
}

/**
 * Удалить блок из c-block
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} removeBlock - Удаляемый блок
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function removeBlockFromInside(cBlock, removeBlock, workspaceSVG) {
    if (!isCBlock(cBlock)) return;
    
    const innerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    if (innerBlocks.length === 0) return;
    
    // Находим индекс удаляемого блока
    const removeIndex = innerBlocks.findIndex(b => b === removeBlock);
    if (removeIndex === -1) return;
    
    // Получаем цепь от удаляемого блока до конца
    const removeChain = getChainBlocks(removeBlock, workspaceSVG);
    
    // Высчитываем высоту удаляемой цепи (нужна для смещения оставшихся блоков)
    let removeChainHeight = 0;
    removeChain.forEach(block => {
        const blockType = block.dataset.type;
        const blockForm = BLOCK_FORMS[blockType];
        const pathHeight = blockForm?.pathHeight || parseFloat(block.dataset.height) || DEFAULT_BLOCK_HEIGHT;
        removeChainHeight += pathHeight;
    });
    
    // Разрываем связи
    if (removeIndex === 0) {
        // Удаляем первый блок
        if (removeChain.length < innerBlocks.length) {
            // Есть блоки после удаляемой цепи
            const nextBlockAfterRemoved = innerBlocks[removeChain.length];
            cBlock.dataset.substack = nextBlockAfterRemoved.dataset.instanceId;
            nextBlockAfterRemoved.dataset.parent = cBlock.dataset.instanceId;
        } else {
            // Удаляем все блоки внутри
            cBlock.dataset.substack = '';
        }
    } else {
        // Удаляем не первый блок
        const prevBlock = innerBlocks[removeIndex - 1];
        prevBlock.dataset.next = '';
        prevBlock.dataset.bottomConnected = 'false';
    }
    
    removeBlock.dataset.parent = '';
    removeBlock.dataset.topConnected = 'false';
    removeBlock.dataset.topLevel = 'true';
    
    // Смещаем оставшиеся блоки (которые были ниже) вверх на высоту удаленной цепи
    const remainingBlocks = innerBlocks.slice(removeIndex + removeChain.length);
    remainingBlocks.forEach(block => {
        const transform = getTranslateValues(block.getAttribute('transform'));
        block.setAttribute('transform', `translate(${transform.x}, ${transform.y - removeChainHeight})`);
    });
    
    // Вычисляем ПРАВИЛЬНУЮ высоту c-block на основе оставшихся внутренних блоков
    const baseHeight = BLOCK_FORMS['c-block'].height;
    const effectiveInnerHeight = getEffectiveInnerHeight(cBlock, workspaceSVG);
    const correctHeight = baseHeight + effectiveInnerHeight;
    
    const currentHeight = parseFloat(cBlock.dataset.height) || baseHeight;
    const heightDiff = correctHeight - currentHeight;
    
    // Растягиваем/сжимаем c-block до правильной высоты (не инкрементально!)
    if (Math.abs(heightDiff) > 0.1) {
        resizeCBlock(cBlock, heightDiff, workspaceSVG);
    }
    
    // Синхронизируем родителей при уменьшении/перестроении внутренней части
    syncCBlockAncestors(cBlock, workspaceSVG);
}

function getEffectiveInnerHeight(cBlock, workspaceSVG) {
    const innerHeight = getInnerHeight(cBlock, workspaceSVG);
    return Math.max(0, innerHeight - C_BLOCK_EMPTY_INNER_SPACE);
}

/**
 * Получить количество коннекторов c-block
 * @param {SVGElement} cBlock - C-block
 * @returns {number} 2 (с блоками внутри) или 3 (пустой)
 */
export function getCBlockConnectorCount(cBlock) {
    if (!isCBlock(cBlock)) return 0;
    // Пустой c-block: TOP, INNER_TOP, BOTTOM = 3
    // C-block с блоками: TOP, BOTTOM = 2 (внутренние блоки используют свои коннекторы)
    return hasInnerBlocks(cBlock) ? 2 : 3;
}

/**
 * Экспортировать c-block в JSON с SUBSTACK
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Object} JSON представление c-block
 */
export function exportCBlockToJSON(cBlock, workspaceSVG) {
    const blockData = {
        opcode: cBlock.dataset.id,
        next: cBlock.dataset.next || null,
        parent: cBlock.dataset.parent || null,
        inputs: {},
        fields: {},
        topLevel: cBlock.dataset.topLevel === 'true'
    };
    
    // Добавляем SUBSTACK если есть внутренние блоки
    const innerBlocks = getInnerBlocks(cBlock, workspaceSVG);
    if (innerBlocks.length > 0) {
        blockData.inputs.SUBSTACK = [2, innerBlocks[0].dataset.instanceId];
    }
    
    // Добавляем координаты для topLevel блоков
    if (blockData.topLevel) {
        const transform = getTranslateValues(cBlock.getAttribute('transform'));
        blockData.x = Math.round(transform.x);
        blockData.y = Math.round(transform.y);
    }
    
    return blockData;
}

/**
 * Рассчитать позицию для вставки блока внутрь c-block
 * @param {SVGElement} cBlock - C-block
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @returns {Object} {x, y} координаты для вставки
 */
export function getInsertPosition(cBlock, workspaceSVG) {
    const cBlockTransform = getTranslateValues(cBlock.getAttribute('transform'));
    
    // Внутренние блоки должны быть с отступом по X
    // Используем константу для смещения
    const innerOffsetY = 48; // Отступ сверху (ниже первой строки c-block)
    
    // Вычисляем уровень вложенности c-block и применяем соответствующее смещение
    const nestedLevel = getNestedLevel(cBlock, workspaceSVG);
    const innerOffsetX = (nestedLevel + 1) * CBLOCK_NESTED_X_OFFSET;
    
    return {
        x: cBlockTransform.x + innerOffsetX,
        y: cBlockTransform.y + innerOffsetY
    };
}

/**
 * Обновить позиции блоков после c-block при изменении его размера
 * @param {SVGElement} cBlock - C-block
 * @param {number} heightDelta - Изменение высоты
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function updateBlocksAfterCBlock(cBlock, heightDelta, workspaceSVG) {
    if (!cBlock.dataset.next) return;
    if (Math.abs(heightDelta) < 0.01) return; // Игнорируем микроскопические изменения
    
    const nextBlockId = cBlock.dataset.next;
    const nextBlock = workspaceSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
    
    if (!nextBlock) return;
    
    // Смещаем ВСЮ цепь после c-block включая внутренние блоки других c-block
    const allBlocksAfter = getAllChainBlocks(nextBlock, workspaceSVG);
    if (typeof window !== 'undefined' && window.__CB_DEBUG) {
        console.log('[CBlock] updateBlocksAfterCBlock shift', {
            cBlock: cBlock?.dataset?.instanceId,
            heightDelta,
            afterIds: allBlocksAfter.map(b => b.dataset.instanceId)
        });
    }
    allBlocksAfter.forEach(block => {
        const transform = getTranslateValues(block.getAttribute('transform'));
        block.setAttribute('transform', `translate(${transform.x}, ${transform.y + heightDelta})`);
    });
}

