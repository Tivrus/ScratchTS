import { createWorkspaceBlock } from '../blocks/BlockFactory.js';
import { findNearestConnector, getConnectorPosition, ConnectorType, updateDebugOverlay, initDebugMode } from '../blocks/BlockConnectors.js';
import { getChainBlocks, getTopLevelBlock, isTopLevelBlock, moveChain, breakChain } from '../blocks/BlockChain.js';
import { handleSpecialBlockInsertion } from '../blocks/SpecialBlocks.js';
import { saveWorkspaceState, initWorkspaceState } from '../utils/WorkspaceState.js';
import { initBlockAlignment } from '../utils/BlockAlignment.js';
import { BLOCK_FORMS } from '../utils/Constants.js';
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

function getBlockPathHeight(block) {
    const blockType = block.dataset.type;
    const blockForm = BLOCK_FORMS[blockType];
    return blockForm?.pathHeight || parseFloat(block.dataset.height) || 58;
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
    let currentSplitState = null; // Состояние раздвижения цепи { targetBlock, lowerBlock, originalPositions }

    function cleanupDragListeners() {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        ghostBlock.hide();
        closeChainSplit();
    }
    
    function splitChainForInsertion(targetBlock, draggedBlock) {
        if (!targetBlock.dataset.next) return null;
        
        const lowerBlockId = targetBlock.dataset.next;
        const lowerBlock = workspaceSVG.querySelector(`[data-instance-id="${lowerBlockId}"]`);
        
        if (!lowerBlock) return null;
        
        // Для ghostblock используем только реальную высоту path ПЕРВОГО блока вставляемой цепи
        const firstBlockPathHeight = getBlockPathHeight(draggedBlock);
        
        // Для реального смещения вычисляем полную высоту вставляемой цепи
        const draggedChain = getChainBlocks(draggedBlock, dragOverlaySVG);
        let totalHeight = 0;
        draggedChain.forEach(block => {
            totalHeight += getBlockPathHeight(block);
        });
        
        // Сохраняем оригинальные позиции всех блоков ниже
        const lowerChain = getChainBlocks(lowerBlock, workspaceSVG);
        const originalPositions = new Map();
        
        lowerChain.forEach(block => {
            const transform = getTranslateValues(block.getAttribute('transform'));
            originalPositions.set(block.dataset.instanceId, { x: transform.x, y: transform.y });
        });
        
        // Смещаем нижнюю часть цепи вниз только на высоту ghostblock (первого блока)
        lowerChain.forEach(block => {
            const transform = getTranslateValues(block.getAttribute('transform'));
            block.setAttribute('transform', `translate(${transform.x}, ${transform.y + firstBlockPathHeight})`);
        });
        
        return {
            targetBlock,
            lowerBlock,
            originalPositions,
            splitHeight: firstBlockPathHeight,
            totalInsertHeight: totalHeight // Сохраняем полную высоту для реальной вставки
        };
    }
    
    function closeChainSplit() {
        if (!currentSplitState) return;
        
        const { lowerBlock, originalPositions } = currentSplitState;
        
        // Возвращаем блоки на исходные позиции
        const lowerChain = getChainBlocks(lowerBlock, workspaceSVG);
        lowerChain.forEach(block => {
            const original = originalPositions.get(block.dataset.instanceId);
            if (original) {
                block.setAttribute('transform', `translate(${original.x}, ${original.y})`);
            }
        });
        
        currentSplitState = null;
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
        const draggedTransform = getTranslateValues(draggedBlock.getAttribute('transform'));
        
        // Если подключаем сверху (draggedBlock сверху, targetBlock снизу)
        if (targetConnector === ConnectorType.TOP || targetConnector === ConnectorType.INNER_TOP) {
            // Позиционируем draggedBlock, а затем двигаем targetBlock и всю его цепь
            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;
            
            // X координата берется от перетаскиваемого блока
            const finalX = draggedTransform.x;
            const finalY = draggedConnectorPos.y - workspaceRect.top - offsetY;
            
            // Вычисляем, на сколько нужно сдвинуть targetBlock
            const targetBlockRect = targetBlock.getBoundingClientRect();
            const targetOffsetY = targetConnectorPos.y - targetBlockRect.top;
            const targetFinalY = draggedConnectorPos.y - workspaceRect.top - targetOffsetY;
            
            // Двигаем targetBlock и всю его цепь
            const targetChain = getChainBlocks(targetBlock, workspaceSVG);
            const deltaY = targetFinalY - targetTransform.y;
            
            targetChain.forEach(block => {
                const blockTransform = getTranslateValues(block.getAttribute('transform'));
                block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
            });
            
            // Устанавливаем связи
            targetBlock.dataset.parent = draggedBlock.dataset.instanceId;
            draggedBlock.dataset.next = targetBlock.dataset.instanceId;
            
            // Отключаем использованные коннекторы
            targetBlock.dataset.topConnected = 'true';
            draggedBlock.dataset.bottomConnected = 'true';
            targetBlock.dataset.topLevel = 'false';
            draggedBlock.dataset.topLevel = 'true';
            
        } else if (targetConnector === ConnectorType.BOTTOM || targetConnector === ConnectorType.INNER_BOTTOM) {
            // Подключаем снизу (draggedBlock снизу, targetBlock сверху)
            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;
            
            // X координата берется от целевого блока, чтобы обеспечить идеальное выравнивание
            const finalX = targetTransform.x;
            const finalY = targetConnectorPos.y - workspaceRect.top - offsetY;
            
            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);
            
            // Устанавливаем связи
            draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
            targetBlock.dataset.next = draggedBlock.dataset.instanceId;
            
            // Отключаем использованные коннекторы
            draggedBlock.dataset.topConnected = 'true';
            targetBlock.dataset.bottomConnected = 'true';
            draggedBlock.dataset.topLevel = 'false';
            
        } else if (targetConnector === ConnectorType.MIDDLE) {
            // Вставка блока/цепи в середину цепи
            // Вставляемый блок должен быть позиционирован после targetBlock (верхнего блока)
            
            const lowerBlockId = targetBlock.dataset.next;
            const lowerBlock = workspaceSVG.querySelector(`[data-instance-id="${lowerBlockId}"]`);
            
            // Вычисляем позицию напрямую на основе реальной высоты path targetBlock
            const targetPathHeight = getBlockPathHeight(targetBlock);
            
            const finalX = targetTransform.x;
            const finalY = targetTransform.y + targetPathHeight;
            
            // Позиционируем первый блок вставляемой цепи
            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);
            
            // Проверяем, является ли вставляемый блок специальным (start-block или stop-block)
            const isSpecialBlock = handleSpecialBlockInsertion(draggedBlock, targetBlock, lowerBlock, workspaceSVG);
            
            if (!isSpecialBlock && lowerBlock) {
                // Стандартная логика вставки для обычных блоков
                // Получаем всю вставляемую цепь (она уже в workspaceSVG)
                const insertChain = getChainBlocks(draggedBlock, workspaceSVG);
                const insertChainBottom = insertChain[insertChain.length - 1];
                
                // Вычисляем полную высоту вставляемой цепи (используем реальную высоту path)
                let totalInsertHeight = 0;
                insertChain.forEach(block => {
                    totalInsertHeight += getBlockPathHeight(block);
                });
                
                // Позиционируем все блоки вставляемой цепи
                let currentY = finalY;
                for (let i = 0; i < insertChain.length; i++) {
                    const block = insertChain[i];
                    if (i === 0) continue; // Первый блок уже позиционирован
                    
                    const prevBlock = insertChain[i - 1];
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    currentY += prevPathHeight;
                    
                    block.setAttribute('transform', `translate(${finalX}, ${currentY})`);
                }
                
                // Позиционируем нижнюю часть цепи: она должна быть на totalInsertHeight ниже текущей позиции
                // Вычисляем, где сейчас находится нижний блок относительно targetBlock
                const lowerTransform = getTranslateValues(lowerBlock.getAttribute('transform'));
                const targetTransformCurrent = getTranslateValues(targetBlock.getAttribute('transform'));
                
                // Новая позиция нижнего блока = позиция первого вставляемого блока + полная высота вставляемой цепи
                const lowerFinalY = finalY + totalInsertHeight;
                
                // Смещаем всю нижнюю цепь
                const lowerChain = getChainBlocks(lowerBlock, workspaceSVG);
                const deltaY = lowerFinalY - lowerTransform.y;
                
                lowerChain.forEach(block => {
                    const blockTransform = getTranslateValues(block.getAttribute('transform'));
                    block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
                });
                
                // Разрываем связь между target и lower
                targetBlock.dataset.next = draggedBlock.dataset.instanceId;
                targetBlock.dataset.bottomConnected = 'true';
                
                // Устанавливаем связи для вставляемого блока
                draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
                draggedBlock.dataset.topConnected = 'true';
                draggedBlock.dataset.topLevel = 'false';
                
                insertChainBottom.dataset.next = lowerBlock.dataset.instanceId;
                insertChainBottom.dataset.bottomConnected = 'true';
                
                lowerBlock.dataset.parent = insertChainBottom.dataset.instanceId;
                lowerBlock.dataset.topConnected = 'true';
            } else if (!isSpecialBlock && !lowerBlock) {
                // Вставка в конец цепи (нет нижнего блока)
                draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
                draggedBlock.dataset.topConnected = 'true';
                draggedBlock.dataset.topLevel = 'false';
                
                targetBlock.dataset.next = draggedBlock.dataset.instanceId;
                targetBlock.dataset.bottomConnected = 'true';
            }
        }
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

        const { element, isNew, startX, startY, sourceContainer, isDraggingChain } = activeDrag;
        
        // Убираем класс dragging со всех блоков цепи
        if (isDraggingChain) {
            const chain = getChainBlocks(element, dragOverlaySVG);
            chain.forEach(block => block.classList.remove('dragging'));
        } else {
            element.classList.remove('dragging');
        }

        const blockInSidebar = isBlockInsideSidebar(element, sidebar);
        const pointerInSidebar = isPointerInsideSidebar(sidebar, event);
        const pointerInTrash = isPointerInsideTrash(trashCan, event);
        const insideWorkspace = isPointerInsideWorkspace(workspace, event);

        if (pointerInTrash) {
            animateBlockShrink(element, dragOverlaySVG, () => {
                updateDebugOverlay(workspaceSVG);
                saveWorkspaceState(workspaceSVG);
            });
        } else if (blockInSidebar && pointerInSidebar) {
            animateBlockShrink(element, dragOverlaySVG, () => {
                updateDebugOverlay(workspaceSVG);
                saveWorkspaceState(workspaceSVG);
            });
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
            const workspaceRect = workspaceSVG.getBoundingClientRect();
            const overlayRect = dragOverlaySVG.getBoundingClientRect();
            
            // Если перетаскиваем цепь, возвращаем все блоки
            if (isDraggingChain) {
                const chain = getChainBlocks(element, dragOverlaySVG);
                chain.forEach(block => {
                    const currentTransform = getTranslateValues(block.getAttribute('transform'));
                    const adjustedX = currentTransform.x - (workspaceRect.left - overlayRect.left);
                    const adjustedY = currentTransform.y - (workspaceRect.top - overlayRect.top);
                    block.setAttribute('transform', `translate(${adjustedX}, ${adjustedY})`);
                    workspaceSVG.appendChild(block);
                });
            } else {
                const currentTransform = getTranslateValues(element.getAttribute('transform'));
                const adjustedX = currentTransform.x - (workspaceRect.left - overlayRect.left);
                const adjustedY = currentTransform.y - (workspaceRect.top - overlayRect.top);
                element.setAttribute('transform', `translate(${adjustedX}, ${adjustedY})`);
                workspaceSVG.appendChild(element);
            }
            
            const allWorkspaceBlocks = Array.from(workspaceSVG.querySelectorAll('.workspace-block'));
            const nearestConnection = findNearestConnector(element, allWorkspaceBlocks);
            
            if (nearestConnection) {
                // Если это MIDDLE коннектор, нужно закрыть split перед подключением
                if (nearestConnection.targetConnector === ConnectorType.MIDDLE) {
                    closeChainSplit();
                }
                connectBlocksPhysically(element, nearestConnection, workspaceRect);
            } else {
                element.dataset.topLevel = 'true';
            }
            
            updateDebugOverlay(workspaceSVG);
            saveWorkspaceState(workspaceSVG); // Автосохранение после изменения
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

        const { element, offsetX, offsetY, isDraggingChain } = activeDrag;
        const overlayRect = dragOverlaySVG.getBoundingClientRect();

        const newX = event.clientX - overlayRect.left - offsetX;
        const newY = event.clientY - overlayRect.top - offsetY;
        
        // Если перетаскиваем цепь, перемещаем все блоки
        if (isDraggingChain) {
            const currentTransform = getTranslateValues(element.getAttribute('transform'));
            const deltaX = newX - currentTransform.x;
            const deltaY = newY - currentTransform.y;
            
            // Перемещаем всю цепь
            const chain = getChainBlocks(element, dragOverlaySVG);
            chain.forEach(block => {
                const blockTransform = getTranslateValues(block.getAttribute('transform'));
                block.setAttribute('transform', `translate(${blockTransform.x + deltaX}, ${blockTransform.y + deltaY})`);
            });
        } else {
            element.setAttribute('transform', `translate(${newX}, ${newY})`);
        }

        const allWorkspaceBlocks = Array.from(workspaceSVG.querySelectorAll('.workspace-block'));
        const nearestConnection = findNearestConnector(element, allWorkspaceBlocks);

        if (nearestConnection) {
            const targetConnectorPos = getConnectorPosition(nearestConnection.targetBlock, nearestConnection.targetConnector);
            const draggedConnectorPos = getConnectorPosition(element, nearestConnection.draggedConnector);
            
            // Если это средний коннектор, раздвигаем цепь
            if (nearestConnection.targetConnector === ConnectorType.MIDDLE) {
                // Если еще не раздвинули или раздвинули другую цепь, раздвигаем
                if (!currentSplitState || currentSplitState.targetBlock !== nearestConnection.targetBlock) {
                    closeChainSplit();
                    currentSplitState = splitChainForInsertion(nearestConnection.targetBlock, element);
                }
            } else {
                // Если не средний коннектор, смыкаем цепь обратно
                closeChainSplit();
            }
            
            ghostBlock.show(element, nearestConnection.targetBlock, targetConnectorPos, draggedConnectorPos, nearestConnection.targetConnector);
        } else {
            ghostBlock.hide();
            closeChainSplit();
        }
        
        updateDebugOverlay(workspaceSVG);
    }

    function handlePointerUp(event) {
        endDrag(event);
    }

    function beginDrag(element, event, { isNew, offsetX, offsetY, startX, startY, skipInitialMove = false, sourceContainer = null, isDraggingChain = false }) {
        const currentTransform = getTranslateValues(element.getAttribute('transform'));

        const resolvedStartX = startX ?? currentTransform.x;
        const resolvedStartY = startY ?? currentTransform.y;

        if (!isNew && element.parentNode) {
            sourceContainer = element.parentNode;
        }

        // Если перетаскиваем цепь, перемещаем все блоки в dragOverlay
        if (isDraggingChain) {
            const chain = getChainBlocks(element, sourceContainer || workspaceSVG);
            chain.forEach(block => {
                dragOverlaySVG.appendChild(block);
                block.classList.add('dragging');
            });
        } else {
            dragOverlaySVG.appendChild(element);
            element.classList.add('dragging');
        }

        activeDrag = {
            element,
            offsetX,
            offsetY,
            isNew,
            startX: resolvedStartX,
            startY: resolvedStartY,
            sourceContainer,
            isDraggingChain
        };

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
        
        // Проверяем, является ли блок верхним в цепи
        const topBlock = getTopLevelBlock(block, workspaceSVG);
        const isDraggingTopBlock = topBlock === block;
        
        // Если перетаскиваем не верхний блок, разрываем цепь
        if (!isDraggingTopBlock && block.dataset.parent) {
            const parentBlockId = block.dataset.parent;
            const parentBlock = workspaceSVG.querySelector(`[data-instance-id="${parentBlockId}"]`);
            if (parentBlock) {
                breakChain(parentBlock, block);
                // Сохраняем сразу после разрыва цепи
                saveWorkspaceState(workspaceSVG);
            }
        }

        // После разрыва цепи блок становится верхним, поэтому перетаскиваем всю цепь (от этого блока вниз)
        beginDrag(block, event, {
            isNew: false,
            offsetX,
            offsetY,
            startX: currentTransform.x,
            startY: currentTransform.y,
            isDraggingChain: true // Всегда перетаскиваем цепь (даже если это один блок)
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
    initWorkspaceState(workspaceSVG);
    initBlockAlignment(workspaceSVG);
}

export default initializeDragAndDrop;


