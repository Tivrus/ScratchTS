import { getConnectorPosition, ConnectorType } from '../../blocks/BlockConnectors.js';
import { getChainBlocks } from '../../blocks/BlockChain.js';
import { handleSpecialBlockInsertion, canConnectFromTop, canConnectFromBottom, handleMiddleInsertionWithSpecialBlocks } from '../../blocks/SpecialBlocks.js';
import { isCBlock, insertBlockInside, getInsertPosition, syncCBlockHeight } from '../../blocks/CBlock.js';
import { getBlockPathHeight, getTranslateValues } from './DragHelpers.js';

export default class ConnectionManager {
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

    connectBlocks(draggedBlock, connection, workspaceRect) {
        const { targetBlock, targetConnector, draggedConnector } = connection;

        const targetConnectorPos = getConnectorPosition(targetBlock, targetConnector);
        const draggedConnectorPos = getConnectorPosition(draggedBlock, draggedConnector);

        if (!targetConnectorPos || !draggedConnectorPos) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const targetTransform = getTranslateValues(targetBlock.getAttribute('transform'));
        const draggedTransform = getTranslateValues(draggedBlock.getAttribute('transform'));
        const containingCBlock = this.findContainingCBlock(targetBlock);

        if (targetConnector === ConnectorType.INNER_TOP) {
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
            if (!canConnectFromTop(draggedBlock, targetBlock, this.workspaceSVG)) {
                draggedBlock.dataset.topLevel = 'true';
                return;
            }

            const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
            const lastDraggedBlock = draggedChain[draggedChain.length - 1];

            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;

            const finalX = draggedTransform.x;
            const finalY = draggedConnectorPos.y - workspaceRect.top - offsetY;

            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);
            if (draggedChain.length > 1) {
                let currentY = finalY;
                for (let i = 0; i < draggedChain.length; i++) {
                    const block = draggedChain[i];
                    if (i === 0) continue;

                    const prevBlock = draggedChain[i - 1];
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    currentY += prevPathHeight;

                    block.setAttribute('transform', `translate(${finalX}, ${currentY})`);
                }
            }

            let totalDraggedHeight = 0;
            draggedChain.forEach(block => {
                totalDraggedHeight += getBlockPathHeight(block);
            });

            const targetFinalY = finalY + totalDraggedHeight;

            const targetChain = getChainBlocks(targetBlock, this.workspaceSVG);
            const deltaY = targetFinalY - targetTransform.y;

            targetChain.forEach(block => {
                const blockTransform = getTranslateValues(block.getAttribute('transform'));
                block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
            });

            targetBlock.dataset.parent = lastDraggedBlock.dataset.instanceId;
            targetBlock.dataset.topConnected = 'true';
            targetBlock.dataset.topLevel = 'false';
            lastDraggedBlock.dataset.next = targetBlock.dataset.instanceId;
            lastDraggedBlock.dataset.bottomConnected = 'true';
            draggedBlock.dataset.topLevel = 'true';

            if (containingCBlock) {
                syncCBlockHeight(containingCBlock, this.workspaceSVG);
            }
            return;
        }

        if (targetConnector === ConnectorType.BOTTOM) {
            if (!canConnectFromBottom(draggedBlock, targetBlock, this.workspaceSVG)) {
                draggedBlock.dataset.topLevel = 'true';
                return;
            }

            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;

            const finalX = targetTransform.x;
            const finalY = targetConnectorPos.y - workspaceRect.top - offsetY;

            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);

            const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
            if (draggedChain.length > 1) {
                let currentY = finalY;
                for (let i = 0; i < draggedChain.length; i++) {
                    const block = draggedChain[i];
                    if (i === 0) continue;

                    const prevBlock = draggedChain[i - 1];
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    currentY += prevPathHeight;

                    block.setAttribute('transform', `translate(${finalX}, ${currentY})`);
                }
            }

            draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
            targetBlock.dataset.next = draggedBlock.dataset.instanceId;

            draggedBlock.dataset.topConnected = 'true';
            targetBlock.dataset.bottomConnected = 'true';
            draggedBlock.dataset.topLevel = 'false';

            if (containingCBlock) {
                syncCBlockHeight(containingCBlock, this.workspaceSVG);
            }
            return;
        }

        if (targetConnector === ConnectorType.MIDDLE) {
            const lowerBlockId = targetBlock.dataset.next;
            const lowerBlock = this.workspaceSVG.querySelector(`[data-instance-id="${lowerBlockId}"]`);

            const targetPathHeight = getBlockPathHeight(targetBlock);
            const finalX = targetTransform.x;
            const finalY = targetTransform.y + targetPathHeight;

            draggedBlock.setAttribute('transform', `translate(${finalX}, ${finalY})`);

            const isSpecialBlock = handleSpecialBlockInsertion(draggedBlock, targetBlock, lowerBlock, this.workspaceSVG);
            const specialChainHandled = handleMiddleInsertionWithSpecialBlocks(draggedBlock, targetBlock, lowerBlock, this.workspaceSVG);

            if (!isSpecialBlock && !specialChainHandled && lowerBlock) {
                const insertChain = getChainBlocks(draggedBlock, this.workspaceSVG);
                const insertChainBottom = insertChain[insertChain.length - 1];

                let totalInsertHeight = 0;
                insertChain.forEach(block => {
                    totalInsertHeight += getBlockPathHeight(block);
                });

                let currentY = finalY;
                for (let i = 0; i < insertChain.length; i++) {
                    const block = insertChain[i];
                    if (i === 0) continue;

                    const prevBlock = insertChain[i - 1];
                    const prevPathHeight = getBlockPathHeight(prevBlock);
                    currentY += prevPathHeight;

                    block.setAttribute('transform', `translate(${finalX}, ${currentY})`);
                }

                const lowerTransform = getTranslateValues(lowerBlock.getAttribute('transform'));
                const lowerFinalY = finalY + totalInsertHeight;

                const lowerChain = getChainBlocks(lowerBlock, this.workspaceSVG);
                const deltaY = lowerFinalY - lowerTransform.y;

                lowerChain.forEach(block => {
                    const blockTransform = getTranslateValues(block.getAttribute('transform'));
                    block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
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
                draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
                draggedBlock.dataset.topConnected = 'true';
                draggedBlock.dataset.topLevel = 'false';

                targetBlock.dataset.next = draggedBlock.dataset.instanceId;
                targetBlock.dataset.bottomConnected = 'true';
            }

            if (containingCBlock) {
                syncCBlockHeight(containingCBlock, this.workspaceSVG);
            }
        }
    }
}

