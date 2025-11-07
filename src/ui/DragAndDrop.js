import { createWorkspaceBlock } from '../blocks/BlockFactory.js';
import { findNearestConnector, getConnectorPosition, ConnectorType, updateDebugOverlay, initDebugMode } from '../blocks/BlockConnectors.js';
import GhostBlock from './GhostBlock.js';

function getColorFromTemplate(template) {
    if (template?.dataset?.color) {
        return template.dataset.color;
    }

    const path = template?.querySelector('path');
    return path?.getAttribute('fill') ?? null;
}

function isPointerInsideWorkspace(workspace, event) {
    const rect = workspace.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function isPointerInsideSidebar(sidebar, event) {
    const rect = sidebar.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function isBlockInsideSidebar(element, sidebar) {
    const blockRect = element.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    
    const blockCenterX = blockRect.left + blockRect.width / 2;
    const blockCenterY = blockRect.top + blockRect.height / 2;
    
    return blockCenterX >= sidebarRect.left && blockCenterX <= sidebarRect.right &&
           blockCenterY >= sidebarRect.top && blockCenterY <= sidebarRect.bottom;
}

function isPointerInsideTrash(trashCan, event) {
    const rect = trashCan.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

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

export function initializeDragAndDrop({
    workspaceSelector = '#workspace',
    blockTemplatesSelector = '#block-templates',
    workspaceSVGSelector = '#block-container',
    dragOverlaySVGSelector = '#drag-overlay-svg',
    sidebarSelector = '#sidebar',
    trashCanSelector = '#trash-can'
} = {}) {
    const workspace = document.querySelector(workspaceSelector);
    const templatesContainer = document.querySelector(blockTemplatesSelector);
    const workspaceSVG = document.querySelector(workspaceSVGSelector);
    const dragOverlaySVG = document.querySelector(dragOverlaySVGSelector);
    const sidebar = document.querySelector(sidebarSelector);
    const trashCan = document.querySelector(trashCanSelector);

    if (!workspace || !templatesContainer || !workspaceSVG || !dragOverlaySVG || !sidebar || !trashCan) {
        console.warn('[DragAndDrop] Workspace, SVG, drag overlay, sidebar, trash-can or templates container not found.');
        return;
    }

    let activeDrag = null;
    const ghostBlock = new GhostBlock(workspaceSVG);

    function cleanupDragListeners() {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        ghostBlock.hide();
    }

    function connectBlocksPhysically(draggedBlock, connection, workspaceRect) {
        const { targetBlock, targetConnector, draggedConnector } = connection;
        
        const targetConnectorPos = getConnectorPosition(targetBlock, targetConnector);
        const draggedConnectorPos = getConnectorPosition(draggedBlock, draggedConnector);
        
        if (!targetConnectorPos || !draggedConnectorPos) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }
        
        // Получаем X координату целевого блока из его transform
        const targetTransform = getTranslateValues(targetBlock.getAttribute('transform'));
        
        // Для Y координаты вычисляем offset относительно верха блока
        const draggedBlockRect = draggedBlock.getBoundingClientRect();
        const offsetY = draggedConnectorPos.y - draggedBlockRect.top;
        
        // X координата берется от целевого блока, чтобы обеспечить идеальное выравнивание
        const finalX = targetTransform.x;
        const finalY = targetConnectorPos.y - workspaceRect.top - offsetY;
        
        draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);
        
        // Устанавливаем связи между блоками
        if (targetConnector === ConnectorType.BOTTOM || targetConnector === ConnectorType.INNER_BOTTOM) {
            draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
            targetBlock.dataset.next = draggedBlock.dataset.instanceId;
            
            // Отключаем использованные коннекторы
            draggedBlock.dataset.topConnected = 'true';
            targetBlock.dataset.bottomConnected = 'true';
        } else if (targetConnector === ConnectorType.TOP || targetConnector === ConnectorType.INNER_TOP) {
            targetBlock.dataset.parent = draggedBlock.dataset.instanceId;
            draggedBlock.dataset.next = targetBlock.dataset.instanceId;
            
            // Отключаем использованные коннекторы
            targetBlock.dataset.topConnected = 'true';
            draggedBlock.dataset.bottomConnected = 'true';
        }
        
        draggedBlock.dataset.topLevel = 'false';
    }

    function animateBlockShrink(element, callback) {
        const blockRect = element.getBoundingClientRect();
        const blockCenterX = blockRect.left + blockRect.width / 2;
        const blockCenterY = blockRect.top + blockRect.height / 2;
        
        const overlayRect = dragOverlaySVG.getBoundingClientRect();
        const relativeCenterX = blockCenterX - overlayRect.left;
        const relativeCenterY = blockCenterY - overlayRect.top;
        
        element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        element.style.transformOrigin = `${relativeCenterX}px ${relativeCenterY}px`;
        element.style.transform = 'scale(0.1)';
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.remove();
            if (callback) callback();
        }, 300);
    }

    function endDrag(event) {
        if (!activeDrag) {
            cleanupDragListeners();
            return;
        }

        const { element, isNew, startX, startY, sourceContainer } = activeDrag;
        element.classList.remove('dragging');

        const blockInSidebar = isBlockInsideSidebar(element, sidebar);
        const pointerInSidebar = isPointerInsideSidebar(sidebar, event);
        const pointerInTrash = isPointerInsideTrash(trashCan, event);
        const insideWorkspace = isPointerInsideWorkspace(workspace, event);

        if (pointerInTrash) {
            animateBlockShrink(element, dragOverlaySVG, () => updateDebugOverlay(workspaceSVG));
        } else if (blockInSidebar && pointerInSidebar) {
            animateBlockShrink(element, dragOverlaySVG, () => updateDebugOverlay(workspaceSVG));
        } else if (blockInSidebar && !pointerInSidebar) {
            const currentTransform = getTranslateValues(element.getAttribute('transform'));
            const workspaceRect = workspaceSVG.getBoundingClientRect();
            const overlayRect = dragOverlaySVG.getBoundingClientRect();
            const sidebarRect = sidebar.getBoundingClientRect();
            
            const adjustedX = sidebarRect.right - overlayRect.left + 10;
            const adjustedY = currentTransform.y;
            
            const finalX = adjustedX - (workspaceRect.left - overlayRect.left);
            const finalY = adjustedY - (workspaceRect.top - overlayRect.top);
            
            element.setAttribute('transform', `translate(${finalX}, ${finalY})`);
            element.dataset.topLevel = 'true';
            workspaceSVG.appendChild(element);
            updateDebugOverlay(workspaceSVG);
        } else if (insideWorkspace) {
            const currentTransform = getTranslateValues(element.getAttribute('transform'));
            const workspaceRect = workspaceSVG.getBoundingClientRect();
            const overlayRect = dragOverlaySVG.getBoundingClientRect();
            
            const adjustedX = currentTransform.x - (workspaceRect.left - overlayRect.left);
            const adjustedY = currentTransform.y - (workspaceRect.top - overlayRect.top);
            
            element.setAttribute('transform', `translate(${adjustedX}, ${adjustedY})`);
            
            // Сначала добавляем блок в workspace, чтобы getBoundingClientRect работал корректно
            workspaceSVG.appendChild(element);
            
            const allWorkspaceBlocks = Array.from(workspaceSVG.querySelectorAll('.workspace-block'));
            const nearestConnection = findNearestConnector(element, allWorkspaceBlocks);
            
            if (nearestConnection) {
                connectBlocksPhysically(element, nearestConnection, workspaceRect);
            } else {
                element.dataset.topLevel = 'true';
            }
            
            updateDebugOverlay(workspaceSVG);
        } else {
            if (isNew) {
                element.remove();
            } else {
                element.setAttribute('transform', `translate(${startX}, ${startY})`);
                if (sourceContainer) {
                    sourceContainer.appendChild(element);
                }
            }
        }

        activeDrag = null;
        cleanupDragListeners();
    }

    function handlePointerMove(event) {
        if (!activeDrag) {
            return;
        }

        event.preventDefault();

        const { element, offsetX, offsetY } = activeDrag;
        const overlayRect = dragOverlaySVG.getBoundingClientRect();

        const x = event.clientX - overlayRect.left - offsetX;
        const y = event.clientY - overlayRect.top - offsetY;

        element.setAttribute('transform', `translate(${x}, ${y})`);

        const allWorkspaceBlocks = Array.from(workspaceSVG.querySelectorAll('.workspace-block'));
        const nearestConnection = findNearestConnector(element, allWorkspaceBlocks);

        if (nearestConnection) {
            const targetConnectorPos = getConnectorPosition(nearestConnection.targetBlock, nearestConnection.targetConnector);
            const draggedConnectorPos = getConnectorPosition(element, nearestConnection.draggedConnector);
            ghostBlock.show(element, nearestConnection.targetBlock, targetConnectorPos, draggedConnectorPos);
        } else {
            ghostBlock.hide();
        }
        
        updateDebugOverlay(workspaceSVG);
    }

    function handlePointerUp(event) {
        endDrag(event);
    }

    function beginDrag(element, event, { isNew, offsetX, offsetY, startX, startY, skipInitialMove = false, sourceContainer = null }) {
        const currentTransform = getTranslateValues(element.getAttribute('transform'));

        const resolvedStartX = startX ?? currentTransform.x;
        const resolvedStartY = startY ?? currentTransform.y;

        if (!isNew && element.parentNode) {
            sourceContainer = element.parentNode;
        }

        dragOverlaySVG.appendChild(element);

        activeDrag = {
            element,
            offsetX,
            offsetY,
            isNew,
            startX: resolvedStartX,
            startY: resolvedStartY,
            sourceContainer
        };

        element.classList.add('dragging');

        if (!skipInitialMove) {
            handlePointerMove(event);
        }

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp, { passive: false });
    }

    function handleTemplatePointerDown(event) {
        const template = event.target.closest('.block-template');
        if (!template) {
            return;
        }

        event.preventDefault();

        const blockConfig = template._blockConfig;
        if (!blockConfig) {
            console.warn('[DragAndDrop] Block config not found on template.');
            return;
        }

        const templateRect = template.getBoundingClientRect();
        const overlayRect = dragOverlaySVG.getBoundingClientRect();

        const color = getColorFromTemplate(template);
        
        const initialX = templateRect.left - overlayRect.left + 11;
        const initialY = templateRect.top - overlayRect.top + 11;

        const blockElement = createWorkspaceBlock(blockConfig, { color, x: initialX, y: initialY });
        if (!blockElement) {
            return;
        }

        blockElement.addEventListener('pointerdown', handleWorkspaceBlockPointerDown);

        const offsetX = event.clientX - templateRect.left - 11;
        const offsetY = event.clientY - templateRect.top - 11;

        beginDrag(blockElement, event, {
            isNew: true,
            offsetX,
            offsetY,
            startX: initialX,
            startY: initialY,
            skipInitialMove: true
        });
    }

    function handleWorkspaceBlockPointerDown(event) {
        const block = event.currentTarget;
        event.preventDefault();
        event.stopPropagation();

        const blockRect = block.getBoundingClientRect();
        const offsetX = event.clientX - blockRect.left;
        const offsetY = event.clientY - blockRect.top;

        const currentTransform = getTranslateValues(block.getAttribute('transform'));

        beginDrag(block, event, {
            isNew: false,
            offsetX,
            offsetY,
            startX: currentTransform.x,
            startY: currentTransform.y
        });
    }

    templatesContainer.addEventListener('pointerdown', handleTemplatePointerDown);
    templatesContainer.addEventListener('dragstart', (event) => event.preventDefault());
    
    workspaceSVG.addEventListener('pointerdown', (event) => {
        const block = event.target.closest('.workspace-block');
        if (block) {
            handleWorkspaceBlockPointerDown.call(block, event);
        }
    });
    
    initDebugMode();
}

export default initializeDragAndDrop;


