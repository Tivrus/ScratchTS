/**
 * BlockAlignment - утилиты для выравнивания блоков по сетке
 */

import { getChainBlocks } from '../blocks/BlockChain.js';

/**
 * Округлить число до ближайшего кратного заданному значению
 * @param {number} value - Значение для округления
 * @param {number} gridSize - Размер сетки (по умолчанию 10)
 * @returns {number} Округленное значение
 */
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
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
 * Выровнять один блок по сетке
 * @param {SVGElement} block - Блок для выравнивания
 * @param {number} gridSize - Размер сетки (по умолчанию 10)
 */
function alignBlock(block, gridSize = 10) {
    const transform = getTranslateValues(block.getAttribute('transform'));
    const alignedX = snapToGrid(transform.x, gridSize);
    const alignedY = snapToGrid(transform.y, gridSize);
    
    // Обновляем позицию только если она изменилась
    if (alignedX !== transform.x || alignedY !== transform.y) {
        block.setAttribute('transform', `translate(${alignedX}, ${alignedY})`);
        return true;
    }
    
    return false;
}

/**
 * Выровнять цепь блоков по сетке
 * @param {SVGElement} topBlock - Верхний блок цепи
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @param {number} gridSize - Размер сетки (по умолчанию 10)
 * @returns {boolean} true если цепь была выровнена, false если нет
 */
function alignChain(topBlock, workspaceSVG, gridSize = 10) {
    const chain = getChainBlocks(topBlock, workspaceSVG);
    
    if (chain.length === 0) {
        return false;
    }
    
    // Получаем текущую позицию первого блока
    const firstBlockTransform = getTranslateValues(chain[0].getAttribute('transform'));
    const alignedX = snapToGrid(firstBlockTransform.x, gridSize);
    const alignedY = snapToGrid(firstBlockTransform.y, gridSize);
    
    // Вычисляем смещение
    const deltaX = alignedX - firstBlockTransform.x;
    const deltaY = alignedY - firstBlockTransform.y;
    
    // Если смещение нулевое, ничего не делаем
    if (deltaX === 0 && deltaY === 0) {
        return false;
    }
    
    // Применяем смещение ко всем блокам цепи
    chain.forEach(block => {
        const transform = getTranslateValues(block.getAttribute('transform'));
        const newX = transform.x + deltaX;
        const newY = transform.y + deltaY;
        block.setAttribute('transform', `translate(${newX}, ${newY})`);
    });
    
    return true;
}

/**
 * Выровнять все блоки и цепи в рабочей области по сетке
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 * @param {number} gridSize - Размер сетки (по умолчанию 10)
 * @returns {Object} Статистика выравнивания
 */
export function alignAllBlocks(workspaceSVG, gridSize = 10) {
    if (!workspaceSVG) {
        console.error('[BlockAlignment] Workspace SVG not found');
        return { aligned: 0, total: 0 };
    }
    
    const allBlocks = workspaceSVG.querySelectorAll('.workspace-block');
    const processedBlocks = new Set();
    let alignedCount = 0;
    let totalChains = 0;
    
    // Находим все верхние блоки (topLevel === true)
    const topLevelBlocks = Array.from(allBlocks).filter(block => 
        block.dataset.topLevel === 'true'
    );
    
    // Обрабатываем каждый верхний блок и его цепь
    topLevelBlocks.forEach(topBlock => {
        // Пропускаем уже обработанные блоки
        if (processedBlocks.has(topBlock.dataset.instanceId)) {
            return;
        }
        
        const chain = getChainBlocks(topBlock, workspaceSVG);
        
        // Отмечаем все блоки цепи как обработанные
        chain.forEach(block => {
            processedBlocks.add(block.dataset.instanceId);
        });
        
        // Выравниваем цепь (или одиночный блок)
        const wasAligned = chain.length > 1 
            ? alignChain(topBlock, workspaceSVG, gridSize)
            : alignBlock(topBlock, gridSize);
        
        if (wasAligned) {
            alignedCount++;
        }
        
        totalChains++;
    });
    
    return {
        aligned: alignedCount,
        total: totalChains,
        gridSize: gridSize
    };
}

/**
 * Инициализировать глобальные функции для выравнивания
 * @param {SVGElement} workspaceSVG - SVG контейнер рабочей области
 */
export function initBlockAlignment(workspaceSVG) {
    if (typeof window !== 'undefined') {
        /**
         * Глобальная функция для выравнивания всех блоков
         * @param {number} gridSize - Размер сетки (по умолчанию 10)
         */
        window.alignBlocks = (gridSize = 10) => {
            if (workspaceSVG) {
                const result = alignAllBlocks(workspaceSVG, gridSize);
                return result;
            } else {
                console.error('[BlockAlignment] Workspace not initialized');
                return null;
            }
        };
        
        console.log('[BlockAlignment] Usage: alignBlocks() or alignBlocks(20) for different grid size');
    }
}

export default alignAllBlocks;

