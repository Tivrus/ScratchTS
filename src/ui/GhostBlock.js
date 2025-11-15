/**
 * GhostBlock - визуализация места подключения блока
 */

import { BLOCK_FORMS } from '../utils/Constants.js';
import { ConnectorType } from '../blocks/BlockConnectors.js';
import PathUtils from '../utils/PathUtils.js';
import { getAllChainBlocks } from '../blocks/BlockChain.js';
import { hasInnerBlocks, C_BLOCK_EMPTY_INNER_SPACE } from '../blocks/CBlock.js';

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

        let cBlockToResize = null;
        const insertHeight = this.getBlockPathHeight(draggedBlock);
        
        // Случай 1: Вставка в пустой c-block (INNER_TOP коннектор)
        if (connectorType === ConnectorType.INNER_TOP && targetBlock.dataset.type === 'c-block') {
            cBlockToResize = targetBlock;
        } 
        // Случай 2-4: Вставка к внутренним блокам c-block (MIDDLE, TOP, BOTTOM коннекторы)
        else if ([ConnectorType.MIDDLE, ConnectorType.TOP, ConnectorType.BOTTOM].includes(connectorType)) {
            // Проверяем, является ли родитель targetBlock c-block
            if (targetBlock.dataset.parent) {
                const parentId = targetBlock.dataset.parent;
                const parentBlock = this.containerSVG.querySelector(`[data-instance-id="${parentId}"]`);
                if (parentBlock && parentBlock.dataset.type === 'c-block') {
                    cBlockToResize = parentBlock;
                }
            }
        }
        
        // Растягиваем c-block если нужно
        if (cBlockToResize) {
            const hasBlocksInside = hasInnerBlocks(cBlockToResize);
            const effectiveInsertHeight = hasBlocksInside
                ? insertHeight
                : Math.max(0, insertHeight - C_BLOCK_EMPTY_INNER_SPACE);
            this.applyCBlockGhostResize(cBlockToResize, effectiveInsertHeight);
        } else {
            this.releaseCBlockGhostResize();
        }

        const blockClone = draggedBlock.cloneNode(true);
        blockClone.classList.add('ghost-block');
        blockClone.removeAttribute('data-instance-id');

        // Удаляем весь текст из ghostblock
        const textElements = blockClone.querySelectorAll('text');
        textElements.forEach(text => text.remove());

        // Делаем все path элементы серыми
        const pathElements = blockClone.querySelectorAll('path');
        pathElements.forEach(path => {
            path.setAttribute('fill', '#808080');
            path.setAttribute('stroke', '#606060');
        });

        // Получаем X координату целевого блока из его transform
        const targetTransform = this.getTranslateValues(targetBlock.getAttribute('transform'));
        
        const workspaceRect = this.containerSVG.getBoundingClientRect();
        const draggedBlockRect = draggedBlock.getBoundingClientRect();
        const offsetX = draggedConnectorPos.x - draggedBlockRect.left;
        const offsetY = draggedConnectorPos.y - draggedBlockRect.top;

        let finalX = targetConnectorPos.x - workspaceRect.left - offsetX;
        let finalY = targetConnectorPos.y - workspaceRect.top - offsetY;

        if (connectorType === ConnectorType.MIDDLE) {
            const targetType = targetBlock.dataset.type;
            const targetForm = BLOCK_FORMS[targetType];
            const targetPathHeight = targetForm?.pathHeight || parseFloat(targetBlock.dataset.height) || 58;

            const draggedType = draggedBlock.dataset.type;
            const draggedForm = BLOCK_FORMS[draggedType];
            const draggedTopOffset = draggedForm?.topOffset || 0;

            finalX = targetTransform.x;
            finalY = targetTransform.y + targetPathHeight - draggedTopOffset;
        } else {
            finalX += 1;
            finalY += 1;
        }

        blockClone.setAttribute('transform', `translate(${finalX}, ${finalY})`);
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

    hide() {
        this.removeGhostElement();
        this.releaseCBlockGhostResize();
    }

    isVisible() {
        return this.ghostElement !== null;
    }

    getBlockPathHeight(block) {
        if (!block) return 0;
        const blockType = block.dataset.type;
        const blockForm = BLOCK_FORMS[blockType];
        if (blockForm?.pathHeight) {
            return blockForm.pathHeight;
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
            // ignore getBBox exceptions
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

        const pathElement = cBlock.querySelector('path');
        if (!pathElement) {
            return;
        }

        const originalState = {
            element: cBlock,
            originalPath: pathElement.getAttribute('d'),
            originalHeight: cBlock.dataset.height,
            originalInnerHeight: cBlock.dataset.innerHeight,
            insertHeight,
            blocksAfterPositions: new Map() // Сохраняем позиции блоков после c-block
        };

        // Сохраняем позиции блоков после c-block
        if (cBlock.dataset.next) {
            const nextBlockId = cBlock.dataset.next;
            const nextBlock = this.containerSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
            if (nextBlock) {
                const blocksAfter = getAllChainBlocks(nextBlock, this.containerSVG);
                blocksAfter.forEach(block => {
                    const transform = this.getTranslateValues(block.getAttribute('transform'));
                    originalState.blocksAfterPositions.set(block.dataset.instanceId, { x: transform.x, y: transform.y });
                });
            }
        }

        const config = PathUtils.getBlockResizeConfig('c-block') ?? {};
        const resizedPath = PathUtils.resizeBlockPath(originalState.originalPath, {
            horizontal: 0,
            vertical: insertHeight,
            hIndices: config.hIndices ?? [],
            vIndices: config.vIndices ?? []
        });

        pathElement.setAttribute('d', resizedPath);

        const baseHeight = parseFloat(originalState.originalHeight) || BLOCK_FORMS['c-block'].height;
        const ghostHeight = String(baseHeight + insertHeight);
        cBlock.dataset.height = ghostHeight;

        let ghostInnerHeight;
        if (originalState.originalInnerHeight !== undefined) {
            const baseInnerHeight = parseFloat(originalState.originalInnerHeight);
            if (!Number.isNaN(baseInnerHeight)) {
                ghostInnerHeight = String(baseInnerHeight + insertHeight);
                cBlock.dataset.innerHeight = ghostInnerHeight;
            }
        }

        // Смещаем блоки после c-block вниз на высоту вставляемого блока
        if (cBlock.dataset.next) {
            const nextBlockId = cBlock.dataset.next;
            const nextBlock = this.containerSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
            if (nextBlock) {
                const blocksAfter = getAllChainBlocks(nextBlock, this.containerSVG);
                blocksAfter.forEach(block => {
                    const transform = this.getTranslateValues(block.getAttribute('transform'));
                    block.setAttribute('transform', `translate(${transform.x}, ${transform.y + insertHeight})`);
                });
            }
        }

        this.currentGhostCBlock = {
            ...originalState,
            ghostPath: resizedPath,
            ghostHeight,
            ghostInnerHeight
        };
    }

    releaseCBlockGhostResize() {
        if (!this.currentGhostCBlock) {
            return;
        }

        const { element, originalPath, originalHeight, originalInnerHeight, ghostPath, ghostHeight, ghostInnerHeight, blocksAfterPositions } = this.currentGhostCBlock;
        const pathElement = element.querySelector('path');
        const currentPath = pathElement?.getAttribute('d');
        if (pathElement && typeof originalPath === 'string' && typeof ghostPath === 'string' && currentPath === ghostPath) {
            pathElement.setAttribute('d', originalPath);
        }

        if (ghostHeight !== undefined && ghostHeight === element.dataset.height) {
            if (originalHeight !== undefined) {
                element.dataset.height = originalHeight;
            } else {
                delete element.dataset.height;
            }
        }

        if (ghostInnerHeight !== undefined && ghostInnerHeight === element.dataset.innerHeight) {
            if (originalInnerHeight !== undefined && originalInnerHeight !== null && originalInnerHeight !== '') {
                element.dataset.innerHeight = originalInnerHeight;
            } else {
                delete element.dataset.innerHeight;
            }
        }

        // Возвращаем блоки после c-block на исходные позиции
        if (blocksAfterPositions && blocksAfterPositions.size > 0) {
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

export default GhostBlock;

