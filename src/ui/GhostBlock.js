/**
 * GhostBlock - визуализация места подключения блока
 */

import { BLOCK_FORMS } from '../utils/Constants.js';
import { ConnectorType } from '../blocks/BlockConnectors.js';
import PathUtils from '../utils/PathUtils.js';

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

        const isInnerConnector = connectorType === ConnectorType.INNER_TOP || connectorType === ConnectorType.INNER_BOTTOM;
        if (isInnerConnector && targetBlock.dataset.type === 'c-block') {
            const insertHeight = this.getBlockPathHeight(draggedBlock);
            this.applyCBlockGhostResize(targetBlock, insertHeight);
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
            insertHeight
        };

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

        const { element, originalPath, originalHeight, originalInnerHeight, ghostPath, ghostHeight, ghostInnerHeight } = this.currentGhostCBlock;
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

        this.currentGhostCBlock = null;
    }
}

export default GhostBlock;

