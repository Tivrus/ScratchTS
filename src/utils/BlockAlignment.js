
import {getChainBlocks} from '../blocks/BlockChain.js';
import {getTranslateValues} from './DOMUtils.js';


function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}


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

export function initBlockAlignment(workspaceSVG) {
    if (typeof window !== 'undefined') {
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


