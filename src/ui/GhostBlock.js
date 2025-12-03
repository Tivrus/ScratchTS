import { 
    BLOCK_FORMS, 
    DEFAULT_BLOCK_HEIGHT, 
    GHOST_BLOCK, 
    CONNECTOR_THRESHOLD, 
    C_BLOCK_EMPTY_INNER_SPACE,
    CONNECTOR_SOCKET_HEIGHT
} from '../utils/Constants.js';

import { 
    hasInnerBlocks,
    isCBlock, 
    syncCBlockHeight, 
    isBlockInsideCBlock 
} from '../blocks/CBlock.js';

import { 
    ConnectorType, 
    getConnectorPosition 
} from '../blocks/BlockConnectors.js';

import { 
    getTranslateValues, 
    getBoundingClientRectRounded 
} from '../utils/DOMUtils.js';

import {PathUtils} from '../utils/PathUtils.js';
import {getAllChainBlocks} from '../blocks/BlockChain.js';


export class GhostBlock {
    constructor(containerSVG) {
        this.containerSVG = containerSVG;
        this.ghostElement = null;
        this.currentGhostCBlock = null;
    }

    show(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, connectorType = null) {
        this.removeGhostElement();

        if (!draggedBlock || !targetBlock || !targetConnectorPos || !draggedConnectorPos) {
            this.releaseCBlockGhostResize();
            return;
        }

        const insertHeight = this.getBlockPathHeight(draggedBlock);
        
        const cBlockToResize = this.determineCBlockToResize(targetBlock, connectorType);
        let actualConnectorPos = this.updateConnectorPositionAfterResize(
            targetBlock, 
            targetConnectorPos, 
            cBlockToResize, 
            connectorType, 
            insertHeight
        );

        const blockClone = this.createGhostBlockClone(draggedBlock);
        const position = this.calculateGhostPosition(
            draggedBlock,
            targetBlock,
            actualConnectorPos,
            draggedConnectorPos,
            connectorType
        );
        
        this.positionAndAppendGhostBlock(blockClone, position, connectorType);
    }
    
    determineCBlockToResize(targetBlock, connectorType) {
        if (connectorType === ConnectorType.INNER_TOP && targetBlock.dataset.type === 'c-block') {
            return targetBlock;
        }
        
        if ([ConnectorType.MIDDLE, ConnectorType.TOP, ConnectorType.BOTTOM].includes(connectorType)) {
            const containingCBlock = this.findContainingCBlock(targetBlock);
            
            if (!containingCBlock) {
                return null;
            }

            const isInsideCBlock = targetBlock !== containingCBlock && 
                isBlockInsideCBlock(containingCBlock, targetBlock, this.containerSVG);
            const isNonBottomInternal = connectorType !== ConnectorType.BOTTOM && 
                targetBlock !== containingCBlock;

            if (isInsideCBlock || isNonBottomInternal) {
                return containingCBlock;
            }
        }

        return null;
    }

    updateConnectorPositionAfterResize(targetBlock, targetConnectorPos, cBlockToResize, connectorType, insertHeight) {
        let actualConnectorPos = targetConnectorPos;
        const prevGhostElement = this.currentGhostCBlock?.element;

        if (cBlockToResize) {
            const hasBlocksInside = hasInnerBlocks(cBlockToResize);
            const effectiveInsertHeight = hasBlocksInside
                ? insertHeight
                : Math.max(0, insertHeight - C_BLOCK_EMPTY_INNER_SPACE);
            this.applyCBlockGhostResize(cBlockToResize, effectiveInsertHeight);
            
            if (connectorType === ConnectorType.BOTTOM && targetBlock === cBlockToResize) {
                const updatedConnectorPos = getConnectorPosition(cBlockToResize, ConnectorType.BOTTOM);
                if (updatedConnectorPos) {
                    actualConnectorPos = updatedConnectorPos;
                }
            }
        } else {
            this.releaseCBlockGhostResize();
            
            if (connectorType === ConnectorType.BOTTOM && 
                targetBlock === prevGhostElement && 
                targetBlock.dataset.type === 'c-block') {
                const updatedAfterRelease = getConnectorPosition(targetBlock, ConnectorType.BOTTOM);
                if (updatedAfterRelease) {
                    actualConnectorPos = updatedAfterRelease;
                }
            }
        }

        return actualConnectorPos;
    }

    createGhostBlockClone(draggedBlock) {
        const blockClone = draggedBlock.cloneNode(true);
        blockClone.classList.add('ghost-block');
        blockClone.removeAttribute('data-instance-id');

        const textElements = blockClone.querySelectorAll('text');
        textElements.forEach(text => text.remove());

        const pathElements = blockClone.querySelectorAll('path');
        pathElements.forEach(path => {
            path.setAttribute('fill', GHOST_BLOCK.FILL_COLOR);
            path.setAttribute('stroke', GHOST_BLOCK.STROKE_COLOR);
        });

        return blockClone;
    }


    calculateGhostPosition(draggedBlock, targetBlock, actualConnectorPos, draggedConnectorPos, connectorType) {
        const targetTransform = this.getTranslateValues(targetBlock.getAttribute('transform'));

        if (connectorType === ConnectorType.MIDDLE) {
            return this.calculateMiddleConnectorPosition(draggedBlock, targetBlock, targetTransform);
        }

        const workspaceRect = getBoundingClientRectRounded(this.containerSVG);
        const draggedBlockRect = getBoundingClientRectRounded(draggedBlock);
        const offsetX = draggedConnectorPos.x - draggedBlockRect.left;

        const finalX = actualConnectorPos.x - workspaceRect.left - offsetX;
        const finalY = this.calculateGhostYPosition(connectorType, actualConnectorPos.y, draggedBlockRect.height);

        return {
            x: finalX,
            y: finalY
        };
    }

    calculateGhostYPosition(connectorType, connectorCenterY, draggedBlockHeight) {
        // Для TOP коннектора (отрицательное смещение) - коннектим сверху
        if (connectorType === ConnectorType.TOP) {
            return connectorCenterY + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
        } else if (connectorType === ConnectorType.BOTTOM) {
            return connectorCenterY - CONNECTOR_THRESHOLD / 2;
        }
    }

    calculateMiddleConnectorPosition(draggedBlock, targetBlock, targetTransform) {
        const targetType = targetBlock.dataset.type;
        const targetForm = BLOCK_FORMS[targetType];
        
        const targetPathHeight = parseFloat(targetBlock.dataset.height) || 
            targetForm?.height || 
            DEFAULT_BLOCK_HEIGHT;
        return {
            x: targetTransform.x,
            y: targetTransform.y + targetPathHeight - CONNECTOR_SOCKET_HEIGHT
        };
    }

    positionAndAppendGhostBlock(blockClone, position, connectorType) {
        blockClone.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        blockClone.style.pointerEvents = 'none';
        this.containerSVG.appendChild(blockClone);
        this.ghostElement = blockClone;
    }
    
    removeGhostElement() {
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
    }

    getTranslateValues(transformAttr) {
        return getTranslateValues(transformAttr);
    }

    hide() {
        this.removeGhostElement();
        this.releaseCBlockGhostResize();
    }

    isVisible() {
        return this.ghostElement !== null;
    }

    findContainingCBlock(block) {
        if (!block) return null;

        let currentBlock = block;
        while (currentBlock && currentBlock.dataset.parent) {
            const parentId = currentBlock.dataset.parent;
            const parentBlock = this.containerSVG.querySelector(`[data-instance-id="${parentId}"]`);
            if (!parentBlock) break;
            
            if (isCBlock(parentBlock)) {
                return parentBlock;
            }
            currentBlock = parentBlock;
        }
        return null;
    }

    getBlockPathHeight(block) {
        if (!block) return 0;

        const blockType = block.dataset.type;
        const blockForm = BLOCK_FORMS[blockType];
        if (blockForm?.height) {
            return blockForm.height;
        }

        const datasetHeight = parseFloat(block.dataset.height);
        if (!Number.isNaN(datasetHeight)) {
            return datasetHeight;
        }

        try {
            const bbox = block.getBBox?.();
            if (bbox && !Number.isNaN(bbox.height)) {
                return bbox.height;
            }
        } catch (error) {
        }

        return 0;
    }

    applyCBlockGhostResize(cBlock, insertHeight) {
        if (!cBlock || insertHeight <= 0) {
            this.releaseCBlockGhostResize();
            return;
        }

        const current = this.currentGhostCBlock;
        if (current && current.element === cBlock && current.insertHeight === insertHeight) {
            return;
        }

        this.releaseCBlockGhostResize();

        syncCBlockHeight(cBlock, this.containerSVG);

        const pathElement = cBlock.querySelector('path');
        if (!pathElement) {
            return;
        }

        const originalState = this.saveCBlockOriginalState(cBlock, insertHeight);
        const resizedPath = this.resizeCBlockPath(pathElement.getAttribute('d'), insertHeight);

        pathElement.setAttribute('d', resizedPath);
        const { ghostHeight, ghostInnerHeight } = this.updateCBlockDimensions(cBlock, originalState, insertHeight);
        this.shiftBlocksAfterCBlock(cBlock, insertHeight);

        this.currentGhostCBlock = {
            ...originalState,
            ghostPath: resizedPath,
            ghostHeight,
            ghostInnerHeight
        };
    }

    saveCBlockOriginalState(cBlock, insertHeight) {
        const originalState = {
            element: cBlock,
            originalPath: cBlock.querySelector('path')?.getAttribute('d'),
            originalHeight: cBlock.dataset.height,
            originalInnerHeight: cBlock.dataset.innerHeight,
            insertHeight,
            blocksAfterPositions: new Map()
        };

        if (cBlock.dataset.next) {
            const nextBlockId = cBlock.dataset.next;
            const nextBlock = this.containerSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
            if (nextBlock) {
                const blocksAfter = getAllChainBlocks(nextBlock, this.containerSVG);
                blocksAfter.forEach(block => {
                    const transform = this.getTranslateValues(block.getAttribute('transform'));
                    originalState.blocksAfterPositions.set(block.dataset.instanceId, { 
                        x: transform.x, 
                        y: transform.y 
                    });
                });
            }
        }

        return originalState;
    }

    resizeCBlockPath(originalPath, insertHeight) {
        const config = PathUtils.getBlockResizeConfig('c-block') ?? {};
        return PathUtils.resizeBlockPath(originalPath, {
            horizontal: 0,
            vertical: insertHeight,
            hIndices: config.hIndices ?? [],
            vIndices: config.vIndices ?? []
        });
    }

    updateCBlockDimensions(cBlock, originalState, insertHeight) {
        const baseHeight = parseFloat(originalState.originalHeight) || BLOCK_FORMS['c-block'].height;
        const ghostHeight = String(baseHeight + insertHeight);
        cBlock.dataset.height = ghostHeight;

        let ghostInnerHeight = null;
        if (originalState.originalInnerHeight) {
            const baseInnerHeight = parseFloat(originalState.originalInnerHeight);
            if (!Number.isNaN(baseInnerHeight)) {
                ghostInnerHeight = String(baseInnerHeight + insertHeight);
                cBlock.dataset.innerHeight = ghostInnerHeight;
            }
        }

        return { ghostHeight, ghostInnerHeight };
    }

    shiftBlocksAfterCBlock(cBlock, insertHeight) {
        if (!cBlock.dataset.next) return;

        const nextBlockId = cBlock.dataset.next;
        const nextBlock = this.containerSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
        if (!nextBlock) return;

        const blocksAfter = getAllChainBlocks(nextBlock, this.containerSVG);
        
        blocksAfter.forEach(block => {
            const transform = this.getTranslateValues(block.getAttribute('transform'));
            const newY = transform.y + insertHeight;
            block.setAttribute('transform', `translate(${transform.x}, ${newY})`);
        });
    }

    releaseCBlockGhostResize() {
        if (!this.currentGhostCBlock) {
            return;
        }

        const { 
            element, 
            originalPath, 
            originalHeight, 
            originalInnerHeight, 
            ghostPath, 
            ghostHeight, 
            ghostInnerHeight, 
            blocksAfterPositions 
        } = this.currentGhostCBlock;
        
        const pathElement = element.querySelector('path');
        const currentPath = pathElement?.getAttribute('d');
        
        if (pathElement && originalPath && ghostPath && currentPath === ghostPath) {
            pathElement.setAttribute('d', originalPath);
        }

        if (ghostHeight === element.dataset.height) {
            if (originalHeight) {
                element.dataset.height = originalHeight;
            } else {
                delete element.dataset.height;
            }
        }

        if (ghostInnerHeight === element.dataset.innerHeight) {
            if (originalInnerHeight) {
                element.dataset.innerHeight = originalInnerHeight;
            } else {
                delete element.dataset.innerHeight;
            }
        }

        if (blocksAfterPositions?.size) {
            blocksAfterPositions.forEach((position, blockId) => {
                const block = this.containerSVG.querySelector(`[data-instance-id="${blockId}"]`);
                if (block) {
                    block.setAttribute('transform', `translate(${position.x}, ${position.y})`);
                }
            });
        }

        this.currentGhostCBlock = null;
    }
}