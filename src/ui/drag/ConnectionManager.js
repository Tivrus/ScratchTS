import { getConnectorPosition, ConnectorType } from '../../blocks/BlockConnectors.js';
import { getChainBlocks } from '../../blocks/BlockChain.js';
import { handleSpecialBlockInsertion, canConnectFromTop, canConnectFromBottom, handleMiddleInsertionWithSpecialBlocks } from '../../blocks/SpecialBlocks.js';
import { isCBlock, insertBlockInside, getInsertPosition, syncCBlockHeight, getNestedLevel, calculateChainBlockX } from '../../blocks/CBlock.js';
import { getBlockPathHeight, getTranslateValues } from './DragHelpers.js';
import { BLOCK_FORMS, CBLOCK_NESTED_X_OFFSET } from '../../utils/Constants.js';


export default class ConnectionManager {
    constructor(workspaceSVG) {
        this.workspaceSVG = workspaceSVG;
        this._debug = () => typeof window !== 'undefined' && !!window.__CB_DEBUG;
        this._log = (...args) => { if (this._debug()) console.log('[ConnectionManager]', ...args); };
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

    connectBlocks(draggedBlock, connection, workspaceRect) {
        const { targetBlock, targetConnector, draggedConnector } = connection;

        const targetConnectorPos = getConnectorPosition(targetBlock, targetConnector);
        const draggedConnectorPos = getConnectorPosition(draggedBlock, draggedConnector);
        this._log('connectBlocks()', {
            target: targetBlock?.dataset?.instanceId,
            targetType: targetBlock?.dataset?.type,
            targetConnector,
            dragged: draggedBlock?.dataset?.instanceId,
            draggedType: draggedBlock?.dataset?.type,
            draggedConnector
        });

        if (!targetConnectorPos || !draggedConnectorPos) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const targetTransform = getTranslateValues(targetBlock.getAttribute('transform'));
        const draggedTransform = getTranslateValues(draggedBlock.getAttribute('transform'));
        const containingCBlock = this.findContainingCBlock(targetBlock);

        if (targetConnector === ConnectorType.INNER_TOP) {
            this._log('case: INNER_TOP into c-block', { cBlock: targetBlock?.dataset?.instanceId });
            if (!isCBlock(targetBlock)) {
                console.warn('[DragAndDrop] INNER connector used on non c-block');
                draggedBlock.dataset.topLevel = 'true';
                return;
            }

            const insertPos = getInsertPosition(targetBlock, this.workspaceSVG);
            insertBlockInside(targetBlock, draggedBlock, this.workspaceSVG, insertPos.x, insertPos.y, false);
            return;
        }

        if (targetConnector === ConnectorType.TOP) {
            this._log('case: TOP above target', { target: targetBlock?.dataset?.instanceId });
            if (!canConnectFromTop(draggedBlock, targetBlock, this.workspaceSVG)) {
                draggedBlock.dataset.topLevel = 'true';
                return;
            }

            const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
            // Сохраняем старые позиции до перекладки
            const oldTransforms = new Map();
            draggedChain.forEach(b => {
                oldTransforms.set(b.dataset.instanceId, getTranslateValues(b.getAttribute('transform')));
            });
            const lastDraggedBlock = draggedChain[draggedChain.length - 1];

            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;

            // ВАЖНО: вычисляем правильный X для первого блока в цепи с учетом вложенности
            // Все блоки в цепи будут использовать этот же X (или X + смещение для вложенных)
            const finalX = calculateChainBlockX(draggedBlock, draggedBlock, this.workspaceSVG);
            const finalY = draggedConnectorPos.y - workspaceRect.top - offsetY;

            // Позиционируем все блоки в цепи с правильным X
            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);
            if (draggedChain.length > 1) {
                let currentY = finalY;
                for (let i = 0; i < draggedChain.length; i++) {
                    const block = draggedChain[i];
                    if (i === 0) continue;

                    const prevBlock = draggedChain[i - 1];
                    const prevForm = BLOCK_FORMS[prevBlock.dataset.type] || {};
                    const nextForm = BLOCK_FORMS[block.dataset.type] || {};
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    const joinDelta = prevPathHeight - (prevForm.bottomOffset || 0) + (nextForm.topOffset || 0);
                    currentY += joinDelta;

                    // ВАЖНО: все блоки в цепи используют одинаковый X (вычисленный от первого блока)
                    const blockX = calculateChainBlockX(draggedBlock, block, this.workspaceSVG);
                    block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
                }
            }
            // Сдвигаем внутренности во всех c-block внутри перетаскиваемой цепи
            // ВАЖНО: внутренние блоки должны сохранять правильный X относительно родительского c-block
            const shiftInnerDraggedTop = (cBlock, dy) => {
                if (!cBlock || !isCBlock(cBlock)) return;
                const substackId = cBlock.dataset.substack;
                if (!substackId) return;
                const firstInner = this.workspaceSVG.querySelector(`[data-instance-id="${substackId}"]`);
                const innerChain = getChainBlocks(firstInner, this.workspaceSVG);
                const cBlockTransform = getTranslateValues(cBlock.getAttribute('transform'));
                innerChain.forEach(inner => {
                    const t = getTranslateValues(inner.getAttribute('transform'));
                    // Вычисляем правильный X для внутреннего блока с учетом вложенности
                    const nestedLevel = getNestedLevel(inner, this.workspaceSVG);
                    const correctX = cBlockTransform.x + (nestedLevel * CBLOCK_NESTED_X_OFFSET);
                    inner.setAttribute('transform', `translate(${correctX}, ${t.y + dy})`);
                    if (isCBlock(inner)) {
                        shiftInnerDraggedTop(inner, dy);
                    }
                });
            };
            draggedChain.forEach(block => {
                if (!isCBlock(block)) return;
                const oldT = oldTransforms.get(block.dataset.instanceId) || { x: 0, y: 0 };
                const newT = getTranslateValues(block.getAttribute('transform'));
                shiftInnerDraggedTop(block, newT.y - oldT.y);
            });

            // Точная стыковка по DOM-коннекторам (устраняет визуальные зазоры/перекрытия на 5px и т.п.)
            const lastBottomPos = getConnectorPosition(lastDraggedBlock, ConnectorType.BOTTOM);
            const targetTopPos = getConnectorPosition(targetBlock, ConnectorType.TOP);
            // Экранные координаты и transform Y находятся в одном пространстве с одинаковой шкалой,
            // поэтому разность по Y можно применять напрямую как смещение по transform.
            const targetChain = getChainBlocks(targetBlock, this.workspaceSVG);
            const deltaY = (lastBottomPos ? lastBottomPos.y : 0) - (targetTopPos ? targetTopPos.y : 0);
            const deltaX = finalX - targetTransform.x;
            
            // Сдвигаем внешнюю цепь (выравниваем X до finalX, поднимаем/опускаем по Y)
            // ВАЖНО: все блоки в цепи должны иметь одинаковый X (вычисленный от draggedBlock)
            // finalX уже вычислен с учетом вложенности draggedBlock
            targetChain.forEach(block => {
                const blockTransform = getTranslateValues(block.getAttribute('transform'));
                // Используем finalX для выравнивания всех блоков в targetChain
                block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
            });
            // ВАЖНО: для каждого c-block в этой цепи нужно сдвинуть его внутренние блоки на deltaY,
            // НО сохраняя их правильный X относительно родительского c-block (с учетом вложенности).
            // Внутренние блоки НЕ должны выравниваться по finalX внешней цепи.
            const shiftInnerRecursively = (cBlock) => {
                if (!cBlock || !isCBlock(cBlock)) return;
                const substackId = cBlock.dataset.substack;
                if (!substackId) return;
                const firstInner = this.workspaceSVG.querySelector(`[data-instance-id="${substackId}"]`);
                const innerChain = getChainBlocks(firstInner, this.workspaceSVG);
                const cBlockTransform = getTranslateValues(cBlock.getAttribute('transform'));
                innerChain.forEach(inner => {
                    const t = getTranslateValues(inner.getAttribute('transform'));
                    // Вычисляем правильный X для внутреннего блока с учетом вложенности
                    const nestedLevel = getNestedLevel(inner, this.workspaceSVG);
                    const correctX = cBlockTransform.x + (nestedLevel * CBLOCK_NESTED_X_OFFSET);
                    inner.setAttribute('transform', `translate(${correctX}, ${t.y + deltaY})`);
                    if (isCBlock(inner)) {
                        shiftInnerRecursively(inner);
                    }
                });
            };
            targetChain.forEach(block => {
                if (isCBlock(block)) {
                    shiftInnerRecursively(block);
                }
            });

            targetBlock.dataset.parent = lastDraggedBlock.dataset.instanceId;
            targetBlock.dataset.topConnected = 'true';
            targetBlock.dataset.topLevel = 'false';
            lastDraggedBlock.dataset.next = targetBlock.dataset.instanceId;
            lastDraggedBlock.dataset.bottomConnected = 'true';
            draggedBlock.dataset.topLevel = 'true';

            if (containingCBlock) {
                this._log('TOP: syncCBlockHeight for containingCBlock', containingCBlock?.dataset?.instanceId);
                syncCBlockHeight(containingCBlock, this.workspaceSVG);
            }
            return;
        }

        if (targetConnector === ConnectorType.BOTTOM) {
            this._log('case: BOTTOM below target', { target: targetBlock?.dataset?.instanceId });
            if (!canConnectFromBottom(draggedBlock, targetBlock, this.workspaceSVG)) {
                draggedBlock.dataset.topLevel = 'true';
                return;
            }

            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;

            // ВАЖНО: вычисляем правильный X для первого блока в цепи с учетом вложенности
            // Все блоки в цепи будут использовать этот же X (или X + смещение для вложенных)
            const finalX = calculateChainBlockX(targetBlock, targetBlock, this.workspaceSVG);
            const finalY = targetConnectorPos.y - workspaceRect.top - offsetY;

            const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
            const oldTransforms = new Map();
            draggedChain.forEach(b => {
                oldTransforms.set(b.dataset.instanceId, getTranslateValues(b.getAttribute('transform')));
            });

            // Позиционируем все блоки в цепи с правильным X
            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);

            if (draggedChain.length > 1) {
                let currentY = finalY;
                for (let i = 0; i < draggedChain.length; i++) {
                    const block = draggedChain[i];
                    if (i === 0) continue;

                    const prevBlock = draggedChain[i - 1];
                    const prevForm = BLOCK_FORMS[prevBlock.dataset.type] || {};
                    const nextForm = BLOCK_FORMS[block.dataset.type] || {};
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    const joinDelta = prevPathHeight - (prevForm.bottomOffset || 0) + (nextForm.topOffset || 0);
                    currentY += joinDelta;

                    // ВАЖНО: все блоки в цепи используют одинаковый X (вычисленный от первого блока)
                    const blockX = calculateChainBlockX(targetBlock, block, this.workspaceSVG);
                    block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
                }
            }
            // Сдвиг внутренностей c-block в перетаскиваемой цепи
            // ВАЖНО: внутренние блоки должны сохранять правильный X относительно родительского c-block
            const shiftInnerDraggedBottom = (cBlock, dy) => {
                if (!cBlock || !isCBlock(cBlock)) return;
                const substackId = cBlock.dataset.substack;
                if (!substackId) return;
                const firstInner = this.workspaceSVG.querySelector(`[data-instance-id="${substackId}"]`);
                const innerChain = getChainBlocks(firstInner, this.workspaceSVG);
                const cBlockTransform = getTranslateValues(cBlock.getAttribute('transform'));
                innerChain.forEach(inner => {
                    const t = getTranslateValues(inner.getAttribute('transform'));
                    // Вычисляем правильный X для внутреннего блока с учетом вложенности
                    const nestedLevel = getNestedLevel(inner, this.workspaceSVG);
                    const correctX = cBlockTransform.x + (nestedLevel * CBLOCK_NESTED_X_OFFSET);
                    inner.setAttribute('transform', `translate(${correctX}, ${t.y + dy})`);
                    if (isCBlock(inner)) {
                        shiftInnerDraggedBottom(inner, dy);
                    }
                });
            };
            draggedChain.forEach(block => {
                if (!isCBlock(block)) return;
                const oldT = oldTransforms.get(block.dataset.instanceId) || { x: 0, y: 0 };
                const newT = getTranslateValues(block.getAttribute('transform'));
                shiftInnerDraggedBottom(block, newT.y - oldT.y);
            });

            draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
            targetBlock.dataset.next = draggedBlock.dataset.instanceId;

            draggedBlock.dataset.topConnected = 'true';
            targetBlock.dataset.bottomConnected = 'true';
            draggedBlock.dataset.topLevel = 'false';

            if (containingCBlock) {
                this._log('BOTTOM: syncCBlockHeight for containingCBlock', containingCBlock?.dataset?.instanceId);
                syncCBlockHeight(containingCBlock, this.workspaceSVG);
            }
            return;
        }

        if (targetConnector === ConnectorType.MIDDLE) {
            this._log('case: MIDDLE between target and its next', { target: targetBlock?.dataset?.instanceId, next: targetBlock?.dataset?.next });
            const lowerBlockId = targetBlock.dataset.next;
            const lowerBlock = this.workspaceSVG.querySelector(`[data-instance-id="${lowerBlockId}"]`);

            // Для c-block нужно использовать оригинальную высоту для расчета позиции вставки
            // Если c-block был растянут ghost resize, его dataset.height увеличен, но блоки уже смещены
            // Поэтому используем базовую высоту + реальную innerHeight (без ghost resize)
            let targetPathHeight = getBlockPathHeight(targetBlock);
            if (isCBlock(targetBlock)) {
               targetPathHeight = targetPathHeight-10;
            }
            this._log('MIDDLE: targetPathHeight', targetPathHeight);
            // ВАЖНО: вычисляем правильный X для первого блока в цепи с учетом вложенности
            // Все блоки в цепи будут использовать этот же X (или X + смещение для вложенных)
            const finalX = calculateChainBlockX(targetBlock, targetBlock, this.workspaceSVG);
            const finalY = targetTransform.y + targetPathHeight;

            const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
            const oldTransforms = new Map();
            draggedChain.forEach(b => {
                oldTransforms.set(b.dataset.instanceId, getTranslateValues(b.getAttribute('transform')));
            });

            // Позиционируем все блоки в цепи с правильным X
            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);

            const isSpecialBlock = handleSpecialBlockInsertion(draggedBlock, targetBlock, lowerBlock, this.workspaceSVG);
            const specialChainHandled = handleMiddleInsertionWithSpecialBlocks(draggedBlock, targetBlock, lowerBlock, this.workspaceSVG);

            if (!isSpecialBlock && !specialChainHandled && lowerBlock) {
                const insertChain = draggedChain;
                const insertChainBottom = insertChain[insertChain.length - 1];

                let totalInsertHeight = 0;
                insertChain.forEach(block => {
                    totalInsertHeight += getBlockPathHeight(block);
                });
                this._log('MIDDLE: totalInsertHeight', totalInsertHeight, 'lowerBlock', lowerBlock?.dataset?.instanceId);

                let currentY = finalY;
                for (let i = 0; i < insertChain.length; i++) {
                    const block = insertChain[i];
                    if (i === 0) continue;

                    const prevBlock = insertChain[i - 1];
                    const prevForm = BLOCK_FORMS[prevBlock.dataset.type] || {};
                    const nextForm = BLOCK_FORMS[block.dataset.type] || {};
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    const joinDelta = prevPathHeight - (prevForm.bottomOffset || 0) + (nextForm.topOffset || 0);
                    currentY += joinDelta;

                    // ВАЖНО: все блоки в цепи используют одинаковый X (вычисленный от первого блока)
                    const blockX = calculateChainBlockX(targetBlock, block, this.workspaceSVG);
                    block.setAttribute('transform', `translate(${blockX}, ${currentY})`);
                }

                const lowerTransform = getTranslateValues(lowerBlock.getAttribute('transform'));
                const lowerFinalY = finalY + totalInsertHeight;

                const lowerChain = getChainBlocks(lowerBlock, this.workspaceSVG);
                const deltaY = lowerFinalY - lowerTransform.y;

                // ВАЖНО: все блоки в lowerChain должны иметь одинаковый X (вычисленный от первого блока)
                lowerChain.forEach(block => {
                    const blockTransform = getTranslateValues(block.getAttribute('transform'));
                    const blockX = calculateChainBlockX(lowerChain[0], block, this.workspaceSVG);
                    block.setAttribute('transform', `translate(${blockX}, ${blockTransform.y + deltaY})`);
                });

                targetBlock.dataset.next = draggedBlock.dataset.instanceId;
                targetBlock.dataset.bottomConnected = 'true';

                draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
                draggedBlock.dataset.topConnected = 'true';
                draggedBlock.dataset.topLevel = 'false';

                insertChainBottom.dataset.next = lowerBlock.dataset.instanceId;
                insertChainBottom.dataset.bottomConnected = 'true';

                lowerBlock.dataset.parent = insertChainBottom.dataset.instanceId;
                lowerBlock.dataset.topConnected = 'true';
            } else if (!isSpecialBlock && !lowerBlock) {
                this._log('MIDDLE: no lowerBlock, connect tail-to-null');
                draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
                draggedBlock.dataset.topConnected = 'true';
                draggedBlock.dataset.topLevel = 'false';

                targetBlock.dataset.next = draggedBlock.dataset.instanceId;
                targetBlock.dataset.bottomConnected = 'true';
            }

            // Сдвигаем внутренности в перетаскиваемой цепи
            // ВАЖНО: внутренние блоки должны сохранять правильный X относительно родительского c-block
            const shiftInnerDraggedMiddle = (cBlock, dy) => {
                if (!cBlock || !isCBlock(cBlock)) return;
                const substackId = cBlock.dataset.substack;
                if (!substackId) return;
                const firstInner = this.workspaceSVG.querySelector(`[data-instance-id="${substackId}"]`);
                const innerChain = getChainBlocks(firstInner, this.workspaceSVG);
                const cBlockTransform = getTranslateValues(cBlock.getAttribute('transform'));
                innerChain.forEach(inner => {
                    const t = getTranslateValues(inner.getAttribute('transform'));
                    // Вычисляем правильный X для внутреннего блока с учетом вложенности
                    const nestedLevel = getNestedLevel(inner, this.workspaceSVG);
                    const correctX = cBlockTransform.x + (nestedLevel * CBLOCK_NESTED_X_OFFSET);
                    inner.setAttribute('transform', `translate(${correctX}, ${t.y + dy})`);
                    if (isCBlock(inner)) {
                        shiftInnerDraggedMiddle(inner, dy);
                    }
                });
            };
            draggedChain.forEach(block => {
                if (!isCBlock(block)) return;
                const oldT = oldTransforms.get(block.dataset.instanceId) || { x: 0, y: 0 };
                const newT = getTranslateValues(block.getAttribute('transform'));
                shiftInnerDraggedMiddle(block, newT.y - oldT.y);
            });

            if (containingCBlock) {
                this._log('MIDDLE: syncCBlockHeight for containingCBlock', containingCBlock?.dataset?.instanceId);
                syncCBlockHeight(containingCBlock, this.workspaceSVG);
            }
        }
    }
}

