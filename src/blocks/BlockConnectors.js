/**
 * BlockConnectors - система коннекторов для соединения блоков
 */

import { BLOCK_FORMS } from '../utils/Constants.js';

const CONNECTOR_THRESHOLD = 50;
let DEBUG_MODE = false;
let debugOverlay = null;

export const ConnectorType = {
    TOP: 'top',
    BOTTOM: 'bottom',
    INNER_TOP: 'inner-top',
    INNER_BOTTOM: 'inner-bottom'
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
            [ConnectorType.INNER_BOTTOM]: true,
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
        if (block.dataset.topConnected === 'true') {
            delete connectors[ConnectorType.TOP];
        }
        if (block.dataset.bottomConnected === 'true') {
            delete connectors[ConnectorType.BOTTOM];
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
            x: connectorX,
            y: blockRect.top + 48 + 1
        },
        [ConnectorType.INNER_BOTTOM]: {
            x: connectorX,
            y: blockRect.bottom - bottomOffset - 32 + 1
        }
    };

    return positions[connectorType] || null;
}

export function findNearestConnector(draggedBlock, allBlocks) {
    if (!draggedBlock || !allBlocks || allBlocks.length === 0) {
        return null;
    }

    const draggedRect = draggedBlock.getBoundingClientRect();
    const draggedType = draggedBlock.dataset.type;
    const draggedConnectors = getBlockConnectors(draggedType);

    let nearestConnection = null;
    let minDistance = CONNECTOR_THRESHOLD;

    allBlocks.forEach(targetBlock => {
        if (targetBlock === draggedBlock) return;
        if (targetBlock.classList.contains('ghost-block')) return;

        const targetType = targetBlock.dataset.type;
        const targetConnectors = getBlockConnectors(targetType);

        Object.keys(draggedConnectors).forEach(draggedConnectorType => {
            const draggedPos = getConnectorPosition(draggedBlock, draggedConnectorType);
            if (!draggedPos) return;

            Object.keys(targetConnectors).forEach(targetConnectorType => {
                if (!canConnect(draggedConnectorType, targetConnectorType)) return;

                const targetPos = getConnectorPosition(targetBlock, targetConnectorType);
                if (!targetPos) return;

                const distance = Math.sqrt(
                    Math.pow(draggedPos.x - targetPos.x, 2) +
                    Math.pow(draggedPos.y - targetPos.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestConnection = {
                        targetBlock,
                        targetConnector: targetConnectorType,
                        draggedConnector: draggedConnectorType,
                        distance,
                        position: targetPos
                    };
                }
            });
        });
    });

    return nearestConnection;
}

function canConnect(draggedConnector, targetConnector) {
    const validConnections = {
        [ConnectorType.TOP]: [ConnectorType.BOTTOM, ConnectorType.INNER_BOTTOM],
        [ConnectorType.BOTTOM]: [ConnectorType.TOP, ConnectorType.INNER_TOP],
        [ConnectorType.INNER_TOP]: [ConnectorType.BOTTOM],
        [ConnectorType.INNER_BOTTOM]: [ConnectorType.TOP]
    };

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

export function enableDebugMode(workspaceSVG) {
    DEBUG_MODE = true;
    
    if (!debugOverlay) {
        debugOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        debugOverlay.setAttribute('id', 'connector-debug-overlay');
        workspaceSVG.appendChild(debugOverlay);
    }
    
    console.log('[BlockConnectors] Debug mode enabled. Connector zones will be visualized.');
    updateDebugOverlay(workspaceSVG);
}

export function disableDebugMode() {
    DEBUG_MODE = false;
    
    if (debugOverlay) {
        debugOverlay.remove();
        debugOverlay = null;
    }
    
    console.log('[BlockConnectors] Debug mode disabled.');
}

export function updateDebugOverlay(workspaceSVG) {
    if (!DEBUG_MODE || !debugOverlay) return;
    
    debugOverlay.innerHTML = '';
    
    const blocks = workspaceSVG.querySelectorAll('.workspace-block:not(.ghost-block)');
    blocks.forEach(block => {
        const blockType = block.dataset.type;
        const connectors = getBlockConnectors(blockType);
        const blockRect = block.getBoundingClientRect();
        const workspaceRect = workspaceSVG.getBoundingClientRect();
        
        Object.keys(connectors).forEach(connectorType => {
            const pos = getConnectorPosition(block, connectorType);
            if (!pos) return;
            
            const centerX = pos.x - workspaceRect.left;
            const centerY = pos.y - workspaceRect.top;
            
            const zoneWidth = parseFloat(block.dataset.width) || blockRect.width;
            const zoneHeight = CONNECTOR_THRESHOLD;
            
            // Смещение зоны от блока (5px внутрь блока, остальное снаружи)
            let offsetY = 0;
            if (connectorType === ConnectorType.TOP) {
                offsetY = -(zoneHeight / 2) + 5; // Зона выше блока
            } else if (connectorType === ConnectorType.BOTTOM) {
                offsetY = (zoneHeight / 2) - 5; // Зона ниже блока
            } else if (connectorType === ConnectorType.INNER_TOP) {
                offsetY = (zoneHeight / 2) - 5; // Зона внутри блока, ниже коннектора
            } else if (connectorType === ConnectorType.INNER_BOTTOM) {
                offsetY = -(zoneHeight / 2) + 5; // Зона внутри блока, выше коннектора
            }
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', centerX - zoneWidth / 2);
            rect.setAttribute('y', centerY - zoneHeight / 2 + offsetY);
            rect.setAttribute('width', zoneWidth);
            rect.setAttribute('height', zoneHeight);
            rect.setAttribute('fill', 'rgba(0, 255, 0, 0.2)');
            rect.setAttribute('stroke', '#00ff00');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('pointer-events', 'none');
            
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', centerX);
            dot.setAttribute('cy', centerY);
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#ff0000');
            dot.setAttribute('pointer-events', 'none');
            
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', centerX + 10);
            label.setAttribute('y', centerY);
            label.setAttribute('fill', '#00ff00');
            label.setAttribute('font-size', '12');
            label.setAttribute('font-weight', 'bold');
            label.textContent = connectorType;
            label.setAttribute('pointer-events', 'none');
            
            debugOverlay.appendChild(rect);
            debugOverlay.appendChild(dot);
            debugOverlay.appendChild(label);
        });
    });
}

export function initDebugMode() {
    if (typeof window !== 'undefined') {
        window.enableConnectorDebug = () => {
            const workspaceSVG = document.querySelector('#block-container');
            if (workspaceSVG) {
                enableDebugMode(workspaceSVG);
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

