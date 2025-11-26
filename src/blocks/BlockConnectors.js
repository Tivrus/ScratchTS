
import { BLOCK_FORMS, SVG_NS } from '../utils/Constants.js';
import { getTopLevelBlock } from './BlockChain.js';

const CONNECTOR_THRESHOLD = 50;
const CBLOCK_MIDDLE_THRESHOLD = 25; // уменьшенная зона для внешнего MIDDLE у c-block с нижней цепью
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
    if (!block) return null;
    if (block.classList.contains('ghost-block')) return null;

    const blockRect = block.getBoundingClientRect();
    const blockType = block.dataset.type;
    const blockForm = BLOCK_FORMS[blockType];
    
    if (!blockForm) {
        console.warn('[BlockConnectors] Unknown block type:', blockType);
        return null;
    }
    
    // Получаем смещения из Constants
    const bottomOffset = blockForm.bottomOffset || 0;
    const topOffset = blockForm.topOffset || 0;
    
    // ViewBox начинается с (-1, -1), поэтому path с координатой x=0 
    // фактически рисуется на 1 пиксель правее левого края SVG
    // Нужно учесть это смещение для правильного позиционирования коннектора
    const viewBoxXOffset = 1;
    const connectorX = blockRect.left + viewBoxXOffset;

    const positions = {
        [ConnectorType.TOP]: {
            x: connectorX,
            y: blockRect.top + topOffset + 1 // +1 для viewBox Y offset
        },
        [ConnectorType.BOTTOM]: {
            x: connectorX,
            y: blockRect.bottom - bottomOffset + 1
        },
        [ConnectorType.INNER_TOP]: {
            x: connectorX + 16, // Смещение вправо для внутренних блоков
            y: blockRect.top + 48 + 1 // Позиция внутреннего коннектора
        },
        [ConnectorType.MIDDLE]: {
            x: connectorX,
            y: blockRect.bottom - bottomOffset + 1 // Средний коннектор на месте bottom
        }
    };

    return positions[connectorType] || null;
}

/**
 * Получает прямоугольник зоны коннекта для проверки пересечения
 */
function getConnectorZone(targetBlock, targetConnectorType) {
    if (!targetBlock) return null;
    
    const targetPos = getConnectorPosition(targetBlock, targetConnectorType);
    if (!targetPos) return null;
    
    const blockRect = targetBlock.getBoundingClientRect();
    const blockType = targetBlock.dataset.type;
    const blockForm = BLOCK_FORMS[blockType];
    
    // Ширина зоны равна ширине блока
    const zoneWidth = parseFloat(targetBlock.dataset.width) || blockForm?.width || 150;
    
    // Высота зоны зависит от типа коннектора
    let zoneHeight = CONNECTOR_THRESHOLD;
    if (blockType === 'c-block' && targetConnectorType === ConnectorType.MIDDLE) {
        const hasExternalBelow = targetBlock.dataset.bottomConnected === 'true' && !!targetBlock.dataset.next;
        if (hasExternalBelow) {
            zoneHeight = CBLOCK_MIDDLE_THRESHOLD;
        }
    }
    
    // Зона выровнена по левому краю блока (с учетом viewBox offset)
    const viewBoxXOffset = 1;
    const zoneX = blockRect.left + viewBoxXOffset;
    
    // Зона центрирована по Y относительно коннектора
    let zoneY = targetPos.y - zoneHeight / 2;
    
    // Для MIDDLE коннектора у c-block смещаем зону чуть ниже
    if (blockType === 'c-block' && targetConnectorType === ConnectorType.MIDDLE) {
        const hasExternalBelow = targetBlock.dataset.bottomConnected === 'true' && !!targetBlock.dataset.next;
        if (hasExternalBelow) {
            zoneY += 10;
        }
    }
    
    return {
        x: zoneX,
        y: zoneY,
        width: zoneWidth,
        height: zoneHeight
    };
}

/**
 * Проверяет, пересекается ли блок с зоной коннекта
 */
function isBlockIntersectingZone(block, zone) {
    if (!block || !zone) return false;
    
    const blockRect = block.getBoundingClientRect();
    
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
                    const firstBlockRect = firstBlockInChain.getBoundingClientRect();
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
    const overlayRect = overlaySVG.getBoundingClientRect();
    
    allBlocks.forEach(block => {
        const blockType = block.dataset.type;
        const connectors = getBlockConnectors(blockType, block);
        
        // Получаем позицию блока через transform, а не getBoundingClientRect
        const transform = block.getAttribute('transform') || '';
        const transformMatch = /translate\(([^,]+),\s*([^)]+)\)/.exec(transform);
        const blockX = transformMatch ? parseFloat(transformMatch[1]) || 0 : 0;
        const blockY = transformMatch ? parseFloat(transformMatch[2]) || 0 : 0;
        
        // Получаем размеры блока
        const blockWidth = parseFloat(block.dataset.width) || 150;
        const blockForm = BLOCK_FORMS[blockType];
        const bottomOffset = blockForm?.bottomOffset || 0;
        const topOffset = blockForm?.topOffset || 0;
        
        Object.keys(connectors).forEach(connectorType => {
            const pos = getConnectorPosition(block, connectorType);
            if (!pos) return;
            
            // Преобразуем координаты коннектора в координаты overlay SVG
            const centerX = pos.x - overlayRect.left;
            const centerY = pos.y - overlayRect.top;
            
            // Визуализируем реальный локальный порог
            let zoneHeight = CONNECTOR_THRESHOLD;
            if (blockType === 'c-block' && connectorType === ConnectorType.MIDDLE) {
                const hasExternalBelow = block.dataset.bottomConnected === 'true' && !!block.dataset.next;
                if (hasExternalBelow) {
                    zoneHeight = CBLOCK_MIDDLE_THRESHOLD;
                }
            }
            
            // Получаем позицию блока в viewport для правильного выравнивания зоны
            const blockRect = block.getBoundingClientRect();
            const blockLeftInOverlay = blockRect.left - overlayRect.left;
            
            // Ширина зоны должна соответствовать ширине блока
            const zoneWidth = blockWidth;
            
            // Зона должна быть выровнена по левому краю блока, а не центрирована на коннекторе
            // Коннектор находится на левом краю блока (с учетом viewBox offset)
            const viewBoxXOffset = 1; // ViewBox начинается с (-1, -1)
            const zoneX = blockLeftInOverlay + viewBoxXOffset;
            
            // Зона коннекта центрирована по Y относительно коннектора
            let zoneY = centerY - zoneHeight / 2;
            
            // Для MIDDLE коннектора у c-block смещаем зону чуть ниже
            if (blockType === 'c-block' && connectorType === ConnectorType.MIDDLE) {
                const hasExternalBelow = block.dataset.bottomConnected === 'true' && !!block.dataset.next;
                if (hasExternalBelow) {
                    zoneY += 10; // Смещаем зону на 10px вниз
                }
            }
            
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', zoneX);
            rect.setAttribute('y', zoneY);
            rect.setAttribute('width', zoneWidth);
            rect.setAttribute('height', zoneHeight);
            rect.setAttribute('fill', 'rgba(0, 255, 0, 0.15)');
            rect.setAttribute('stroke', '#00ff00');
            rect.setAttribute('stroke-width', '1.5');
            rect.setAttribute('pointer-events', 'none');
            rect.setAttribute('rx', '4');
            rect.setAttribute('ry', '4');
            
            const dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', centerX);
            dot.setAttribute('cy', centerY);
            dot.setAttribute('r', '5');
            dot.setAttribute('fill', '#ff0000');
            dot.setAttribute('stroke', '#ffffff');
            dot.setAttribute('stroke-width', '1.5');
            dot.setAttribute('pointer-events', 'none');
            
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', centerX + 8);
            label.setAttribute('y', centerY - 8);
            label.setAttribute('fill', '#00ff00');
            label.setAttribute('font-size', '11');
            label.setAttribute('font-weight', 'bold');
            label.setAttribute('font-family', 'Arial, sans-serif');
            label.textContent = connectorType;
            label.setAttribute('pointer-events', 'none');
            label.setAttribute('style', 'text-shadow: 0 0 3px rgba(0,0,0,0.8);');
            
            debugOverlay.appendChild(rect);
            debugOverlay.appendChild(dot);
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

