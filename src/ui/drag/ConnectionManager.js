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
    getNestedLevel
} from '../../blocks/CBlock.js';

import { 
    CBLOCK_NESTED_X_OFFSET, 
    CONNECTOR_SOCKET_HEIGHT
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

import { BlockPositionCalculator } from './BlockPositionCalculator.js';



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

    saveChainTransforms(chain) {
        const transforms = new Map();
        chain.forEach(block => {
            transforms.set(block.dataset.instanceId, getTranslateValues(block.getAttribute('transform')));
        });
        return transforms;
    }

    positionChainBlocks(chain, firstBlock, startX, startY) {
        if (chain.length === 0) return;

        chain[0].setAttribute('transform', `translate(${startX}, ${startY})`);

        if (chain.length > 1) {
            let currentY = startY;
            for (let i = 1; i < chain.length; i++) {
                const block = chain[i];
                const prevBlock = chain[i - 1];
                const prevPathHeight = getBlockPathHeight(prevBlock);
                const joinDelta = prevPathHeight - CONNECTOR_SOCKET_HEIGHT;
                currentY += joinDelta;

                block.setAttribute('transform', `translate(${startX}, ${currentY})`);
            }
        }
    }

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

    connectBlocksTop(draggedBlock, lastDraggedBlock, targetBlock) {
        targetBlock.dataset.parent = lastDraggedBlock.dataset.instanceId;
        targetBlock.dataset.topConnected = 'true';
        targetBlock.dataset.topLevel = 'false';
        lastDraggedBlock.dataset.next = targetBlock.dataset.instanceId;
        lastDraggedBlock.dataset.bottomConnected = 'true';
        draggedBlock.dataset.topLevel = 'true';
    }

    connectBlocksBottom(draggedBlock, targetBlock) {
        draggedBlock.dataset.parent = targetBlock.dataset.instanceId;
        targetBlock.dataset.next = draggedBlock.dataset.instanceId;
        draggedBlock.dataset.topConnected = 'true';
        targetBlock.dataset.bottomConnected = 'true';
        draggedBlock.dataset.topLevel = 'false';
    }

    finalizeConnection(containingCBlock, topLevelBlock) {
        if (containingCBlock) {
            syncCBlockHeight(containingCBlock, this.workspaceSVG);
        }

        if (topLevelBlock) {
            getChainHeight(topLevelBlock, this.workspaceSVG);
        }
    }

    handleInnerTopConnection(draggedBlock, targetBlock) {
        if (!isCBlock(targetBlock)) {
            console.warn('[DragAndDrop] INNER connector used on non c-block');
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const insertPos = getInsertPosition(targetBlock, this.workspaceSVG);
        insertBlockInside(targetBlock, draggedBlock, this.workspaceSVG, insertPos.x, insertPos.y, false);
    }

    handleTopConnection(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, workspaceRect, targetTransform) {
        if (!canConnectFromTop(draggedBlock, targetBlock, this.workspaceSVG)) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
        const oldTransforms = this.saveChainTransforms(draggedChain);
        const lastDraggedBlock = draggedChain[draggedChain.length - 1];

        const position = BlockPositionCalculator.calculateBlockPosition(targetBlock, draggedBlock, ConnectorType.TOP, this.workspaceSVG);
        if (!position) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        this.positionChainBlocks(draggedChain, draggedBlock, position.x, position.y);
        this.shiftInnerBlocksInChain(draggedChain, oldTransforms);

        this.connectBlocksTop(draggedBlock, lastDraggedBlock, targetBlock);
    }

    handleBottomConnection(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, workspaceRect) {
        if (!canConnectFromBottom(draggedBlock, targetBlock, this.workspaceSVG)) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const position = BlockPositionCalculator.calculateBlockPosition(targetBlock, draggedBlock, ConnectorType.BOTTOM, this.workspaceSVG);
        if (!position) {
            draggedBlock.dataset.topLevel = 'true';
            return;
        }

        const draggedChain = getChainBlocks(draggedBlock, this.workspaceSVG);
        const oldTransforms = this.saveChainTransforms(draggedChain);

        this.positionChainBlocks(draggedChain, targetBlock, position.x, position.y);
        this.shiftInnerBlocksInChain(draggedChain, oldTransforms);

        this.connectBlocksBottom(draggedBlock, targetBlock);
    }

    handleMiddleConnection(draggedBlock, targetBlock, targetTransform, lowerBlock) {
        let targetPathHeight = getBlockPathHeight(targetBlock);
        if (isCBlock(targetBlock)) {
            targetPathHeight = targetPathHeight - 10;
        }

        const finalX = targetTransform.x;
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

    handleMiddleInsertionWithLowerBlock(insertChain, targetBlock, lowerBlock, finalX, finalY) {
        const insertChainBottom = insertChain[insertChain.length - 1];

        insertChain[0].setAttribute('transform', `translate(${finalX}, ${finalY})`);

        let currentY = finalY;
        for (let i = 1; i < insertChain.length; i++) {
            const block = insertChain[i];
            const prevBlock = insertChain[i - 1];
            const prevPathHeight = getBlockPathHeight(prevBlock);
            const joinDelta = prevPathHeight - CONNECTOR_SOCKET_HEIGHT;
            currentY += joinDelta;

            block.setAttribute('transform', `translate(${finalX}, ${currentY})`);
        }

        const lowerTransform = getTranslateValues(lowerBlock.getAttribute('transform'));
        const lastInsertedPathHeight = getBlockPathHeight(insertChainBottom);
        const lowerFinalY = (insertChain.length === 1 ? finalY : currentY) + lastInsertedPathHeight - CONNECTOR_SOCKET_HEIGHT;

        const lowerChain = getChainBlocks(lowerBlock, this.workspaceSVG);
        const deltaY = lowerFinalY - lowerTransform.y;

        lowerChain.forEach(block => {
            const blockTransform = getTranslateValues(block.getAttribute('transform'));
            block.setAttribute('transform', `translate(${finalX}, ${blockTransform.y + deltaY})`);
        });

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

