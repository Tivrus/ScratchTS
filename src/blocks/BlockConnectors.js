
import { 
    BLOCK_FORMS, 
    SVG_NS, 
    CONNECTOR_THRESHOLD, 
    CBLOCK_MIDDLE_THRESHOLD,
    CONNECTOR_OFFSETS,
    CONNECTOR_SOCKET_HEIGHT
} from '../utils/Constants.js';

import {getBoundingClientRectRounded} from '../utils/DOMUtils.js';


let DEBUG_MODE = false;
let debugOverlay = null;

export const ConnectorType = {
    TOP: 'top',
    BOTTOM: 'bottom',
    INNER_TOP: 'inner-top',
    MIDDLE: 'middle' // Средний коннектор между соединенными блоками
};

export function getBlockConnectors(blockType, block = null) {
    const baseConnectors = {
        'start-block': {
            [ConnectorType.BOTTOM]: true
        },
        'default-block': {
            [ConnectorType.TOP]: true,
            [ConnectorType.BOTTOM]: true
        },
        'c-block': {
            [ConnectorType.TOP]: true,
            [ConnectorType.INNER_TOP]: true,
            [ConnectorType.BOTTOM]: true
        },
        'stop-block': {
            [ConnectorType.TOP]: true
        },
        'round-block': {},
        'sharp-block': {}
    };

    const connectors = { ...(baseConnectors[blockType] || {}) };
    
    // Если передан блок, проверяем какие коннекторы уже заняты
    if (block) {
        // Для c-block логика коннекторов особая
        if (blockType === 'c-block') {
            // Верхний внешний коннектор
            if (block.dataset.topConnected === 'true') {
                delete connectors[ConnectorType.TOP];
            }
            
            // Нижний внешний коннектор
            if (block.dataset.bottomConnected === 'true') {
                delete connectors[ConnectorType.BOTTOM];
            }
            
            // Если c-block имеет следующий блок (bottomConnected), добавляем средний коннектор
            if (block.dataset.bottomConnected === 'true' && block.dataset.next) {
                connectors[ConnectorType.MIDDLE] = true;
            }
        } else {
            // Для обычных блоков
            if (block.dataset.topConnected === 'true') {
                delete connectors[ConnectorType.TOP];
            }
            if (block.dataset.bottomConnected === 'true') {
                delete connectors[ConnectorType.BOTTOM];
            }
            
            // Если блок имеет следующий блок (bottomConnected), добавляем средний коннектор
            if (block.dataset.bottomConnected === 'true' && block.dataset.next) {
                connectors[ConnectorType.MIDDLE] = true;
            }
        }
    }

    return connectors;
}

export function getConnectorPosition(block, connectorType) {
    if (block.classList.contains('ghost-block')) return null;

    const blockRect = getBoundingClientRectRounded(block);   
    // Коннекторы находятся на левом краю блока, X координата одинакова для всех (кроме INNER_TOP)
    const connectorX = blockRect.left;
    
    const positions = {
        [ConnectorType.TOP]: {
            x: connectorX,
            y: blockRect.top + CONNECTOR_OFFSETS.TOP_Y
        },
        [ConnectorType.BOTTOM]: {
            x: connectorX,
            y: blockRect.bottom - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y
        },
        [ConnectorType.INNER_TOP]: {
            x: connectorX + CONNECTOR_OFFSETS.INNER_TOP_X, // Смещение вправо для внутренних блоков
            y: blockRect.top + CONNECTOR_OFFSETS.INNER_TOP_Y // Позиция внутреннего коннектора
        },
        [ConnectorType.MIDDLE]: {
            x: connectorX,
            y: blockRect.bottom - CONNECTOR_SOCKET_HEIGHT// Средний коннектор
        }
    };

    return positions[connectorType] || null;
}

/**
 * Получает размеры и местоположение зоны коннекта
 * @param {HTMLElement} block - Блок, для которого рассчитывается зона
 * @param {string} connectorType - Тип коннектора
 * @param {HTMLElement} overlaySVG - Опциональный SVG для преобразования координат (для debug overlay)
 * @returns {Object|null} Объект с координатами и размерами зоны {x, y, width, height, centerX, centerY} или null
 */
export function getConnectorZoneBounds(block, connectorType, overlaySVG = null) {
    const connectorPos = getConnectorPosition(block, connectorType);
    if (!connectorPos) return null;
    
    const blockRect = getBoundingClientRectRounded(block);
    const blockType = block.dataset.type;
    const blockForm = BLOCK_FORMS[blockType];
    
    // Ширина зоны равна ширине блока
    const zoneWidth = parseFloat(block.dataset.width) || blockForm?.width || 150;
    
    // Высота зоны зависит от типа коннектора
    let zoneHeight = CONNECTOR_THRESHOLD;
    if (blockType === 'c-block' && connectorType === ConnectorType.MIDDLE) {
        const hasExternalBelow = block.dataset.bottomConnected === 'true' && !!block.dataset.next;
        if (hasExternalBelow) {
            zoneHeight = CBLOCK_MIDDLE_THRESHOLD;
        }
    }
    
    // Зона выровнена по левому краю блока (с учетом viewBox offset)
    let zoneX = blockRect.left;
    
    // Зона центрирована по Y относительно коннектора
    let zoneY = connectorPos.y - zoneHeight / 2;
    
    // Для MIDDLE коннектора у c-block смещаем зону чуть ниже
    if (blockType === 'c-block' && connectorType === ConnectorType.MIDDLE) {
        const hasExternalBelow = block.dataset.bottomConnected === 'true' && !!block.dataset.next;
        if (hasExternalBelow) {
            zoneY += CONNECTOR_OFFSETS.CBLOCK_MIDDLE_ZONE_Y; // Смещаем зону вниз
        }
    }
    
    // Если передан overlaySVG, преобразуем координаты в координаты overlay
    if (overlaySVG) {
        const overlayRect = getBoundingClientRectRounded(overlaySVG);
        const blockLeftInOverlay = blockRect.left - overlayRect.left;
        zoneX = blockLeftInOverlay;
        
        return {
            x: zoneX,
            y: zoneY - overlayRect.top,
            width: zoneWidth,
            height: zoneHeight,
            centerX: connectorPos.x - overlayRect.left,
            centerY: connectorPos.y - overlayRect.top
        };
    }
    
    return {
        x: zoneX,
        y: zoneY,
        width: zoneWidth,
        height: zoneHeight,
        centerX: connectorPos.x,
        centerY: connectorPos.y
    };
}

/**
 * Получает прямоугольник зоны коннекта для проверки пересечения
 */
function getConnectorZone(targetBlock, targetConnectorType) {
    const zoneBounds = getConnectorZoneBounds(targetBlock, targetConnectorType);
    if (!zoneBounds) return null;
    
    return {
        x: zoneBounds.x,
        y: zoneBounds.y,
        width: zoneBounds.width,
        height: zoneBounds.height
    };
}

/**
 * Проверяет, пересекается ли блок с зоной коннекта
 */
function isBlockIntersectingZone(block, zone) {
    if (!block || !zone) return false;
    
    const blockRect = getBoundingClientRectRounded(block);
    
    // Проверяем пересечение прямоугольников
    return !(
        blockRect.right < zone.x ||
        blockRect.left > zone.x + zone.width ||
        blockRect.bottom < zone.y ||
        blockRect.top > zone.y + zone.height
    );
}

/**
 * Получает первый блок в цепи, ища родительские блоки в предоставленном массиве блоков
 */
function getFirstBlockInChain(block, allBlocks) {
    if (!block || !allBlocks) return block;
    
    let currentBlock = block;
    // Идем вверх по цепи через parent
    while (currentBlock && currentBlock.dataset.parent) {
        const parentId = currentBlock.dataset.parent;
        const parentBlock = allBlocks.find(b => b.dataset.instanceId === parentId);
        
        if (parentBlock) {
            currentBlock = parentBlock;
        } else {
            break;
        }
    }
    
    return currentBlock;
}

export function findNearestConnector(draggedBlock, allBlocks, workspaceSVG = null) {
    if (!draggedBlock || !allBlocks || allBlocks.length === 0) {
        return null;
    }

    // Получаем первый блок в цепи (или сам блок, если он первый)
    // Используем allBlocks для поиска, так как при перетаскивании блоки могут быть в dragOverlaySVG
    const firstBlockInChain = getFirstBlockInChain(draggedBlock, allBlocks);

    const draggedType = draggedBlock.dataset.type;
    const draggedConnectors = getBlockConnectors(draggedType, draggedBlock);
    // Нельзя коннектить удерживаемый c-block его внутренними коннекторами
    if (draggedType === 'c-block') {
        delete draggedConnectors[ConnectorType.INNER_TOP];
        // у перетаскиваемого c-block также не используем MIDDLE как исходящий
        delete draggedConnectors[ConnectorType.MIDDLE];
    }

    let nearestConnection = null;
    let minDistance = Infinity;

    allBlocks.forEach(targetBlock => {
        if (targetBlock === draggedBlock) return;
        if (targetBlock.classList.contains('ghost-block')) return;

        const targetType = targetBlock.dataset.type;
        const targetConnectors = getBlockConnectors(targetType, targetBlock);

        Object.keys(draggedConnectors).forEach(draggedConnectorType => {
            Object.keys(targetConnectors).forEach(targetConnectorType => {
                if (!canConnect(draggedConnectorType, targetConnectorType, draggedBlock, targetBlock)) return;

                const targetPos = getConnectorPosition(targetBlock, targetConnectorType);
                if (!targetPos) return;

                // Получаем зону коннекта
                const connectorZone = getConnectorZone(targetBlock, targetConnectorType);
                if (!connectorZone) return;

                // Проверяем пересечение первого блока в цепи с зоной коннекта
                if (isBlockIntersectingZone(firstBlockInChain, connectorZone)) {
                    // Вычисляем расстояние от центра первого блока до коннектора для сортировки
                    const firstBlockRect = getBoundingClientRectRounded(firstBlockInChain);
                    const firstBlockCenter = {
                        x: firstBlockRect.left + firstBlockRect.width / 2,
                        y: firstBlockRect.top + firstBlockRect.height / 2
                    };
                    
                    const distance = Math.sqrt(
                        Math.pow(firstBlockCenter.x - targetPos.x, 2) +
                        Math.pow(firstBlockCenter.y - targetPos.y, 2)
                    );

                    // Выбираем ближайшее пересечение
                    if (distance < minDistance) {
                        minDistance = distance;
                        // Получаем позицию соответствующего коннектора на перетаскиваемом блоке для отображения ghost block
                        const draggedConnectorPos = getConnectorPosition(draggedBlock, draggedConnectorType);
                        nearestConnection = {
                            targetBlock,
                            targetConnector: targetConnectorType,
                            draggedConnector: draggedConnectorType,
                            distance,
                            position: targetPos,
                            draggedConnectorPos: draggedConnectorPos || firstBlockCenter
                        };
                    }
                }
            });
        });
    });

    return nearestConnection;
}

function canConnect(draggedConnector, targetConnector, draggedBlock, targetBlock) {
    const validConnections = {
        [ConnectorType.TOP]: [
            ConnectorType.BOTTOM,
            ConnectorType.INNER_TOP, // Можно вставлять сверху в пустой c-block
            ConnectorType.MIDDLE
        ],
        [ConnectorType.BOTTOM]: [
            ConnectorType.TOP
        ],
        [ConnectorType.INNER_TOP]: [ConnectorType.TOP],  // c-block принимает блоки сверху внутрь
        [ConnectorType.MIDDLE]: [ConnectorType.TOP] // Средний коннектор принимает блоки сверху
    };

    if (targetConnector === ConnectorType.MIDDLE && draggedBlock?.dataset?.type === 'c-block') {
        return false;
    }

    return validConnections[draggedConnector]?.includes(targetConnector) || false;
}

export function getBlockData(block) {
    if (!block) return null;

    return {
        id: block.dataset.instanceId,
        opcode: block.dataset.id,
        type: block.dataset.type,
        next: block.dataset.next || null,
        parent: block.dataset.parent || null,
        topLevel: block.dataset.topLevel === 'true'
    };
}

export function enableDebugMode(workspaceSVG, dragOverlaySVG = null) {
    DEBUG_MODE = true;
    
    if (!debugOverlay) {
        debugOverlay = document.createElementNS(SVG_NS, 'g');
        debugOverlay.setAttribute('id', 'connector-debug-overlay');
        // Добавляем в drag-overlay, чтобы быть поверх всех блоков
        const targetSVG = dragOverlaySVG || workspaceSVG;
        targetSVG.appendChild(debugOverlay);
    }
    
    console.log('[BlockConnectors] Debug mode enabled. Connector zones will be visualized.');
    updateDebugOverlay(workspaceSVG, dragOverlaySVG);
}

export function disableDebugMode() {
    DEBUG_MODE = false;
    
    if (debugOverlay) {
        debugOverlay.remove();
        debugOverlay = null;
    }
    
    console.log('[BlockConnectors] Debug mode disabled.');
}

export function updateDebugOverlay(workspaceSVG, dragOverlaySVG = null) {
    if (!DEBUG_MODE || !debugOverlay) return;
    
    debugOverlay.innerHTML = '';
    
    // Получаем блоки из обоих контейнеров (workspace и drag-overlay)
    const workspaceBlocks = Array.from(workspaceSVG.querySelectorAll('.workspace-block:not(.ghost-block)'));
    const dragOverlayBlocks = dragOverlaySVG 
        ? Array.from(dragOverlaySVG.querySelectorAll('.workspace-block:not(.ghost-block)'))
        : [];
    
    // Объединяем блоки, исключая дубликаты
    const allBlocks = [...workspaceBlocks];
    dragOverlayBlocks.forEach(block => {
        if (!allBlocks.find(b => b.dataset.instanceId === block.dataset.instanceId)) {
            allBlocks.push(block);
        }
    });
    
    // Определяем, какой SVG использовать для координат (тот, где находится overlay)
    const overlaySVG = dragOverlaySVG || workspaceSVG;
    const overlayRect = getBoundingClientRectRounded(overlaySVG);
    
    allBlocks.forEach(block => {
        const blockType = block.dataset.type;
        const connectors = getBlockConnectors(blockType, block);
        
        Object.keys(connectors).forEach(connectorType => {
            // Используем общую функцию для расчета зоны коннекта
            const zoneBounds = getConnectorZoneBounds(block, connectorType, overlaySVG);
            
            // Создаем визуализацию зоны коннекта
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', zoneBounds.x);
            rect.setAttribute('y', zoneBounds.y);
            rect.setAttribute('width', zoneBounds.width);
            rect.setAttribute('height', zoneBounds.height);
            rect.setAttribute('fill', 'rgba(0, 255, 170, 0.15)');
            rect.setAttribute('stroke', '#00ff00');
            rect.setAttribute('stroke-width', '0.5');
            rect.setAttribute('pointer-events', 'none');
            rect.setAttribute('rx', '2');
            rect.setAttribute('ry', '2');
            
            // Создаем подпись коннектора
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', zoneBounds.centerX + 8);
            label.setAttribute('y', zoneBounds.centerY - 8);
            label.setAttribute('fill', '#00ff00');
            label.setAttribute('font-size', '11');
            label.setAttribute('font-weight', 'bold');
            label.setAttribute('font-family', 'Arial, sans-serif');
            label.textContent = connectorType;
            label.setAttribute('pointer-events', 'none');
            label.setAttribute('style', 'text-shadow: 0 0 3px rgba(0,0,0,0.8);');
            
            debugOverlay.appendChild(rect);
            debugOverlay.appendChild(label);
        });
    });
}

export function initDebugMode(workspaceSVG = null, dragOverlaySVG = null) {
    if (typeof window !== 'undefined') {
        window.enableConnectorDebug = () => {
            const wsSVG = workspaceSVG || document.querySelector('#block-container');
            const doSVG = dragOverlaySVG || document.querySelector('#drag-overlay-svg');
            if (wsSVG) {
                enableDebugMode(wsSVG, doSVG);
            } else {
                console.error('[BlockConnectors] Workspace SVG not found');
            }
        };
        
        window.disableConnectorDebug = () => {
            disableDebugMode();
        };
        
        console.log('[BlockConnectors] Debug functions registered: enableConnectorDebug(), disableConnectorDebug()');
    }
}

