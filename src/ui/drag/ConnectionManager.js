import { 
    handleSpecialBlockInsertion, 
    canConnectFromTop, 
    canConnectFromBottom, 
    handleMiddleInsertionWithSpecialBlocks 
} from '../../blocks/SpecialBlocks.js';

import { 
    isCBlock, 
    insertBlockInside, 
    getInsertPosition, 
    syncCBlockHeight, 
    getNestedLevel, 
    calculateChainBlockX 
} from '../../blocks/CBlock.js';

import { 
    BLOCK_FORMS, 
    CBLOCK_NESTED_X_OFFSET, 
    CONNECTOR_THRESHOLD, 
    CONNECTOR_SOCKET_HEIGHT, 
    GHOST_BLOCK 
} from '../../utils/Constants.js';

import { 
    getChainBlocks, 
    getChainHeight, 
    getTopLevelBlock 
} from '../../blocks/BlockChain.js';

import { 
    getBlockPathHeight, 
    getTranslateValues 
} from './DragHelpers.js';

import { 
    getConnectorPosition, 
    ConnectorType 
} from '../../blocks/BlockConnectors.js';

import {getBoundingClientRectRounded} from '../../utils/DOMUtils.js';


export class ConnectionManager {
    constructor(workspaceSVG) {
        this.workspaceSVG = workspaceSVG;
    }

    findContainingCBlock(block) {
        if (!block) return null;

        let currentBlock = block;
        while (currentBlock && currentBlock.dataset.parent) {
            const parentId = currentBlock.dataset.parent;
            const parentBlock = this.workspaceSVG.querySelector(`[data-instance-id="${parentId}"]`);
            if (!parentBlock) break;
            if (isCBlock(parentBlock)) {
                return parentBlock;
            }
            currentBlock = parentBlock;
        }
        return null;
    }

    /**
     * Вычисляет Y-позицию блока на основе типа коннектора
     * @param {string} connectorType - Тип коннектора (TOP или BOTTOM)
     * @param {number} connectorCenterY - Y-координата середины коннектора
     * @param {number} draggedBlockHeight - Высота перетаскиваемого блока
     * @returns {number} Y-позиция для блока
     */
    calculateBlockYPosition(connectorType, connectorCenterY, draggedBlockHeight) {
        if (connectorType === ConnectorType.TOP) {
            return connectorCenterY + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
        } else if (connectorType === ConnectorType.BOTTOM) {
            return connectorCenterY - CONNECTOR_THRESHOLD / 2;
        }
    }

    /**
     * Сохраняет текущие позиции блоков в цепи
     * @param {Array} chain - Массив блоков в цепи
     * @returns {Map} Map с сохраненными позициями (instanceId -> {x, y})
     */
    saveChainTransforms(chain) {
        const transforms = new Map();
        chain.forEach(block => {
            transforms.set(block.dataset.instanceId, getTranslateValues(block.getAttribute('transform')));
        });
        return transforms;
    }

    /**
     * Позиционирует все блоки в цепи относительно первого блока
     * @param {Array} chain - Массив блоков в цепи
     * @param {HTMLElement} firstBlock - Первый блок в цепи (для расчета X)
     * @param {number} startX - Начальная X координата
     * @param {number} startY - Начальная Y координата
     */
    positionChainBlocks(chain, firstBlock, startX, startY) {
        if (chain.length === 0) return;

        chain[0].setAttribute('transform', `translate(${startX}, ${startY})`);

        if (chain.length > 1) {
            let currentY = startY;
            for (let i = 1; i < chain.length; i++) {
                const block = chain[i];
                const prevBlock = chain[i - 1];
                const prevForm = BLOCK_FORMS[prevBlock.dataset.type] || {};
                const nextForm = BLOCK_FORMS[block.dataset.type] || {};
                const prevPathHeight = getBlockPathHeight(prevBlock);
                const joinDelta = prevPathHeight - CONNECTOR_SOCKET_HEIGHT;
                currentY += joinDelta;

                const blockX = calculateChainBlockX(firstBlock, block, this.workspaceSVG);
                block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
            }
        }
    }

    /**
     * Сдвигает внутренние блоки c-block на указанное смещение по Y
     * @param {HTMLElement} cBlock - C-block, внутренние блоки которого нужно сдвинуть
     * @param {number} deltaY - Смещение по Y
     */
    shiftInnerBlocks(cBlock, deltaY) {
        if (!cBlock || !isCBlock(cBlock)) return;

        const substackId = cBlock.dataset.substack;
        if (!substackId) return;

        const firstInner = this.workspaceSVG.querySelector(`[data-instance-id="${substackId}"]`);
        if (!firstInner) return;

        const innerChain = getChainBlocks(firstInner, this.workspaceSVG);
        const cBlockTransform = getTranslateValues(cBlock.getAttribute('transform'));

        innerChain.forEach(inner => {
            const t = getTranslateValues(inner.getAttribute('transform'));
            const nestedLevel = getNestedLevel(inner, this.workspaceSVG);
            const correctX = cBlockTransform.x + (nestedLevel * CBLOCK_NESTED_X_OFFSET);
            inner.setAttribute('transform', `translate(${correctX}, ${t.y + deltaY})`);

            if (isCBlock(inner)) {
                this.shiftInnerBlocks(inner, deltaY);
            }
        });
    }

    /**
     * Сдвигает внутренние блоки всех c-block в цепи на основе изменения их позиций
     * @param {Array} chain - Массив блоков в цепи
     * @param {Map} oldTransforms - Старые позиции блоков
     */
    shiftInnerBlocksInChain(chain, oldTransforms) {
        chain.forEach(block => {
            if (!isCBlock(block)) return;

            const oldT = oldTransforms.get(block.dataset.instanceId) || { x: 0, y: 0 };
            const newT = getTranslateValues(block.getAttribute('transform'));
            const deltaY = newT.y - oldT.y;

            if (deltaY !== 0) {
                this.shiftInnerBlocks(block, deltaY);
            }
        });
    }

    /**
     * Устанавливает связи между блоками при подключении сверху
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {HTMLElement} lastDraggedBlock - Последний блок в перетаскиваемой цепи
     * @param {HTMLElement} targetBlock - Целевой блок
     */
    connectBlocksTop(draggedBlock, lastDraggedBlock, targetBlock) {
        targetBlock.dataset.parent = lastDraggedBlock.dataset.instanceId;
        targetBlock.dataset.topConnected = 'true';
        targetBlock.dataset.topLevel = 'false';
        lastDraggedBlock.dataset.next = targetBlock.dataset.instanceId;
        lastDraggedBlock.dataset.bottomConnected = 'true';
        draggedBlock.dataset.topLevel = 'true';
    }

    /**
     * Устанавливает связи между блоками при подключении снизу
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {HTMLElement} targetBlock - Целевой блок
     */
    connectBlocksBottom(draggedBlock, targetBlock) {
        draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
        targetBlock.dataset.next = draggedBlock.dataset.instanceId;
        draggedBlock.dataset.topConnected = 'true';
        targetBlock.dataset.bottomConnected = 'true';
        draggedBlock.dataset.topLevel = 'false';
    }

    /**
     * Синхронизирует высоту c-block и выводит высоту цепи
     * @param {HTMLElement} containingCBlock - C-block, содержащий блоки
     * @param {HTMLElement} topLevelBlock - Верхний блок цепи для расчета высоты
     */
    finalizeConnection(containingCBlock, topLevelBlock) {
        if (containingCBlock) {
            syncCBlockHeight(containingCBlock, this.workspaceSVG);
        }

        if (topLevelBlock) {
            getChainHeight(topLevelBlock, this.workspaceSVG);
        }
    }

    /**
     * Обрабатывает подключение к INNER_TOP коннектору (внутри c-block)
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {HTMLElement} targetBlock - Целевой c-block
     */
    handleInnerTopConnection(draggedBlock, targetBlock) {
        if (!isCBlock(targetBlock)) {
            console.warn('[DragAndDrop] INNER connector used on non c-block');
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const insertPos = getInsertPosition(targetBlock, this.workspaceSVG);
        insertBlockInside(targetBlock, draggedBlock, this.workspaceSVG, insertPos.x, insertPos.y, false);
    }

    /**
     * Обрабатывает подключение к TOP коннектору (подключение сверху)
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {HTMLElement} targetBlock - Целевой блок
     * @param {Object} targetConnectorPos - Позиция коннектора целевого блока
     * @param {Object} draggedConnectorPos - Позиция коннектора перетаскиваемого блока
     * @param {Object} workspaceRect - Прямоугольник рабочей области
     * @param {Object} targetTransform - Transform целевого блока
     */
    handleTopConnection(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, workspaceRect, targetTransform) {
        if (!canConnectFromTop(draggedBlock, targetBlock, this.workspaceSVG)) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
        const oldTransforms = this.saveChainTransforms(draggedChain);
        const lastDraggedBlock = draggedChain[draggedChain.length - 1];

        const draggedBlockRect = getBoundingClientRectRounded(draggedBlock);
        const offsetX = draggedConnectorPos.x - draggedBlockRect.left;

        const finalX = targetConnectorPos.x - workspaceRect.left - offsetX;
        const finalY = this.calculateBlockYPosition(ConnectorType.TOP, targetConnectorPos.y, draggedBlockRect.height);

        this.positionChainBlocks(draggedChain, draggedBlock, finalX, finalY);
        this.shiftInnerBlocksInChain(draggedChain, oldTransforms);

        // Точная стыковка по DOM-коннекторам
        const lastBottomPos = getConnectorPosition(lastDraggedBlock, ConnectorType.BOTTOM);
        const targetTopPos = getConnectorPosition(targetBlock, ConnectorType.TOP);
        const targetChain = getChainBlocks(targetBlock, this.workspaceSVG);
        const deltaY = (lastBottomPos ? lastBottomPos.y : 0) - (targetTopPos ? targetTopPos.y : 0);

        targetChain.forEach(block => {
            const blockTransform = getTranslateValues(block.getAttribute('transform'));
            block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
        });

        targetChain.forEach(block => {
            if (isCBlock(block)) {
                this.shiftInnerBlocks(block, deltaY);
            }
        });

        this.connectBlocksTop(draggedBlock, lastDraggedBlock, targetBlock);
    }

    /**
     * Обрабатывает подключение к BOTTOM коннектору (подключение снизу)
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {HTMLElement} targetBlock - Целевой блок
     * @param {Object} targetConnectorPos - Позиция коннектора целевого блока
     * @param {Object} draggedConnectorPos - Позиция коннектора перетаскиваемого блока
     * @param {Object} workspaceRect - Прямоугольник рабочей области
     */
    handleBottomConnection(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, workspaceRect) {
        console.log('=== BOTTOM CONNECTOR DEBUG ===');
        console.log('targetConnector:', ConnectorType.BOTTOM);
        console.log('draggedConnector:', draggedConnectorPos);
        console.log('targetBlock:', {
            id: targetBlock?.dataset?.instanceId,
            type: targetBlock?.dataset?.type
        });
        console.log('draggedBlock:', {
            id: draggedBlock?.dataset?.instanceId,
            type: draggedBlock?.dataset?.type
        });
        console.log('targetConnectorPos:', targetConnectorPos);
        console.log('draggedConnectorPos:', draggedConnectorPos);

        if (!canConnectFromBottom(draggedBlock, targetBlock, this.workspaceSVG)) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const draggedBlockRect = getBoundingClientRectRounded(draggedBlock);
        const offsetX = draggedConnectorPos.x - draggedBlockRect.left;

        console.log('Calculation details:', {
            draggedBlockRect: {
                left: draggedBlockRect.left,
                top: draggedBlockRect.top,
                width: draggedBlockRect.width,
                height: draggedBlockRect.height
            },
            offsetX: offsetX,
            workspaceRect: {
                left: workspaceRect.left,
                top: workspaceRect.top
            },
            targetConnectorPosY: targetConnectorPos.y,
            draggedConnectorPosY: draggedConnectorPos.y
        });

        const finalX = targetConnectorPos.x - workspaceRect.left - offsetX;
        const finalY = this.calculateBlockYPosition(ConnectorType.BOTTOM, targetConnectorPos.y, draggedBlockRect.height);

        console.log('Final position:', {
            finalX: finalX,
            finalY: finalY,
            calculationMethod: 'calculateBlockYPosition with ConnectorType.BOTTOM',
            note: 'targetConnector is BOTTOM, using BOTTOM in calculateBlockYPosition'
        });
        console.log('=== END BOTTOM CONNECTOR DEBUG ===');

        const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
        const oldTransforms = this.saveChainTransforms(draggedChain);

        this.positionChainBlocks(draggedChain, targetBlock, finalX, finalY);
        this.shiftInnerBlocksInChain(draggedChain, oldTransforms);

        this.connectBlocksBottom(draggedBlock, targetBlock);
    }

    /**
     * Обрабатывает подключение к MIDDLE коннектору (вставка между блоками)
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {HTMLElement} targetBlock - Целевой блок
     * @param {Object} targetTransform - Transform целевого блока
     * @param {HTMLElement} lowerBlock - Блок, который был ниже целевого
     */
    handleMiddleConnection(draggedBlock, targetBlock, targetTransform, lowerBlock) {
        let targetPathHeight = getBlockPathHeight(targetBlock);
        if (isCBlock(targetBlock)) {
            targetPathHeight = targetPathHeight - 10;
        }

        const finalX = calculateChainBlockX(targetBlock, targetBlock, this.workspaceSVG);
        const targetType = targetBlock.dataset.type;
        const targetForm = BLOCK_FORMS[targetType];
        const finalY = targetTransform.y + targetPathHeight - CONNECTOR_SOCKET_HEIGHT;

        const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
        const oldTransforms = this.saveChainTransforms(draggedChain);

        this.positionChainBlocks(draggedChain, targetBlock, finalX, finalY);

        const isSpecialBlock = handleSpecialBlockInsertion(draggedBlock, targetBlock, lowerBlock, this.workspaceSVG);
        const specialChainHandled = handleMiddleInsertionWithSpecialBlocks(draggedBlock, targetBlock, lowerBlock, this.workspaceSVG);

        if (!isSpecialBlock && !specialChainHandled && lowerBlock) {
            this.handleMiddleInsertionWithLowerBlock(draggedChain, targetBlock, lowerBlock, finalX, finalY);
        } else if (!isSpecialBlock && !lowerBlock) {
            this.connectBlocksBottom(draggedBlock, targetBlock);
        }

        this.shiftInnerBlocksInChain(draggedChain, oldTransforms);
    }

    /**
     * Обрабатывает вставку блока между двумя существующими блоками
     * @param {Array} insertChain - Цепь вставляемых блоков
     * @param {HTMLElement} targetBlock - Блок сверху
     * @param {HTMLElement} lowerBlock - Блок снизу
     * @param {number} finalX - X координата для позиционирования
     * @param {number} finalY - Y координата для позиционирования
     */
    handleMiddleInsertionWithLowerBlock(insertChain, targetBlock, lowerBlock, finalX, finalY) {
        const insertChainBottom = insertChain[insertChain.length - 1];

        // Позиционируем все блоки вставляемой цепи
        let currentY = finalY;
        for (let i = 1; i < insertChain.length; i++) {
            const block = insertChain[i];
            const prevBlock = insertChain[i - 1];
            const prevForm = BLOCK_FORMS[prevBlock.dataset.type] || {};
            const nextForm = BLOCK_FORMS[block.dataset.type] || {};
            const prevPathHeight = getBlockPathHeight(prevBlock);
            const joinDelta = prevPathHeight - CONNECTOR_SOCKET_HEIGHT;
            currentY += joinDelta;

            const blockX = calculateChainBlockX(targetBlock, block, this.workspaceSVG);
            block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
        }

        // Вычисляем позицию для нижнего блока
        const lowerTransform = getTranslateValues(lowerBlock.getAttribute('transform'));
        const lastInsertedPathHeight = getBlockPathHeight(insertChainBottom);
        const lastInsertedForm = BLOCK_FORMS[insertChainBottom.dataset.type] || {};
        const lowerFinalY = (insertChain.length === 1 ? finalY : currentY) + lastInsertedPathHeight - CONNECTOR_SOCKET_HEIGHT;

        // Сдвигаем нижнюю цепь
        const lowerChain = getChainBlocks(lowerBlock, this.workspaceSVG);
        const deltaY = lowerFinalY - lowerTransform.y;
        console.log('deltaY', deltaY);

        lowerChain.forEach(block => {
            const blockTransform = getTranslateValues(block.getAttribute('transform'));
            const blockX = calculateChainBlockX(lowerChain[0], block, this.workspaceSVG);
            block.setAttribute('transform', `translate(${blockX}, ${blockTransform.y + deltaY})`);
        });

        // Устанавливаем связи
        targetBlock.dataset.next = insertChain[0].dataset.instanceId;
        targetBlock.dataset.bottomConnected = 'true';
        insertChain[0].dataset.parent = targetBlock.dataset.instanceId;
        insertChain[0].dataset.topConnected = 'true';
        insertChain[0].dataset.topLevel = 'false';
        insertChainBottom.dataset.next = lowerBlock.dataset.instanceId;
        insertChainBottom.dataset.bottomConnected = 'true';
        lowerBlock.dataset.parent = insertChainBottom.dataset.instanceId;
        lowerBlock.dataset.topConnected = 'true';
    }

    /**
     * Основной метод для подключения блоков
     * @param {HTMLElement} draggedBlock - Перетаскиваемый блок
     * @param {Object} connection - Объект с информацией о подключении
     * @param {Object} workspaceRect - Прямоугольник рабочей области
     */
    connectBlocks(draggedBlock, connection, workspaceRect) {
        const { targetBlock, targetConnector, draggedConnector } = connection;

        const targetConnectorPos = getConnectorPosition(targetBlock, targetConnector);
        const draggedConnectorPos = getConnectorPosition(draggedBlock, draggedConnector);

        if (!targetConnectorPos || !draggedConnectorPos) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const targetTransform = getTranslateValues(targetBlock.getAttribute('transform'));
        const containingCBlock = this.findContainingCBlock(targetBlock);

        if (targetConnector === ConnectorType.INNER_TOP) {
            this.handleInnerTopConnection(draggedBlock, targetBlock);
            return;
        }

        if (targetConnector === ConnectorType.TOP) {
            this.handleTopConnection(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, workspaceRect, targetTransform);
            this.finalizeConnection(containingCBlock, getTopLevelBlock(draggedBlock, this.workspaceSVG) || draggedBlock);
            return;
        }

        if (targetConnector === ConnectorType.BOTTOM) {
            this.handleBottomConnection(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, workspaceRect);
            this.finalizeConnection(containingCBlock, getTopLevelBlock(targetBlock, this.workspaceSVG) || targetBlock);
            return;
        }

        if (targetConnector === ConnectorType.MIDDLE) {
            const lowerBlockId = targetBlock.dataset.next;
            const lowerBlock = this.workspaceSVG.querySelector(`[data-instance-id="${lowerBlockId}"]`);
            this.handleMiddleConnection(draggedBlock, targetBlock, targetTransform, lowerBlock);
            this.finalizeConnection(containingCBlock, getTopLevelBlock(targetBlock, this.workspaceSVG) || targetBlock);
        }
    }
}

