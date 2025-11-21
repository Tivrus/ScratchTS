import { BLOCK_FORMS, DEFAULT_BLOCK_HEIGHT } from '../utils/Constants.js';
import { ConnectorType, getConnectorPosition } from '../blocks/BlockConnectors.js';
import PathUtils from '../utils/PathUtils.js';
import { getAllChainBlocks } from '../blocks/BlockChain.js';
import { hasInnerBlocks, C_BLOCK_EMPTY_INNER_SPACE, isCBlock, syncCBlockHeight, isBlockInsideCBlock } from '../blocks/CBlock.js';
import { getTranslateValues } from '../utils/DOMUtils.js';

export class GhostBlock {
    constructor(containerSVG) {
        this.containerSVG = containerSVG;
        this.ghostElement = null;
        this.currentGhostCBlock = null;
        this._debug = () => typeof window !== 'undefined' && !!window.__CB_DEBUG;
        this._log = (...args) => { if (this._debug()) console.log('[GhostBlock]', ...args); };
    }

    show(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, connectorType = null) {
        this.removeGhostElement();

        if (!draggedBlock || !targetBlock || !targetConnectorPos || !draggedConnectorPos) {
            this._log('show(): invalid inputs -> releaseCBlockGhostResize()');
            this.releaseCBlockGhostResize();
            return;
        }

        let cBlockToResize = null;
        const insertHeight = this.getBlockPathHeight(draggedBlock);
        this._log('show(): connectorType=', connectorType, 'target=', targetBlock?.dataset?.instanceId, 'dragged=', draggedBlock?.dataset?.instanceId, 'insertHeight=', insertHeight);
        
        // Случай 1: Вставка в пустой c-block (INNER_TOP коннектор)
        if (connectorType === ConnectorType.INNER_TOP && targetBlock.dataset.type === 'c-block') {
            cBlockToResize = targetBlock;
        } 
        // Случай 2-4: Вставка к внутренним блокам c-block (MIDDLE, TOP, BOTTOM коннекторы)
        else if ([ConnectorType.MIDDLE, ConnectorType.TOP, ConnectorType.BOTTOM].includes(connectorType)) {
            // Находим содержащий c-block для targetBlock (может быть прямым родителем или выше по иерархии)
            const containingCBlock = this.findContainingCBlock(targetBlock);
            
            // Применяем ghost resize только если:
            // 1. targetBlock находится внутри c-block (не является самим c-block)
            // 2. Или это не BOTTOM коннектор (для BOTTOM коннектора c-block не должен растягиваться)
            if (containingCBlock) {
                // Проверяем, что targetBlock действительно находится внутри c-block
                // Если targetBlock - это сам c-block, то это внешний коннектор, и не нужно растягивать
                if (targetBlock !== containingCBlock && isBlockInsideCBlock(containingCBlock, targetBlock, this.containerSVG)) {
                    cBlockToResize = containingCBlock;
                } else if (connectorType !== ConnectorType.BOTTOM && targetBlock !== containingCBlock) {
                    // Для TOP и MIDDLE коннекторов, если targetBlock не сам c-block, то это внутренний блок
                    cBlockToResize = containingCBlock;
                }
                this._log('show(): containingCBlock=', containingCBlock?.dataset?.instanceId, 'cBlockToResize=', cBlockToResize?.dataset?.instanceId);
            }
        }
        
        // Используем локальную переменную для позиции коннектора, чтобы можно было обновить её после ghost resize
        let actualConnectorPos = targetConnectorPos;
        const prevGhostElement = this.currentGhostCBlock?.element;
        
        // Растягиваем c-block если нужно
        if (cBlockToResize) {
            const hasBlocksInside = hasInnerBlocks(cBlockToResize);
            const effectiveInsertHeight = hasBlocksInside
                ? insertHeight
                : Math.max(0, insertHeight - C_BLOCK_EMPTY_INNER_SPACE);
            this._log('show(): applyCBlockGhostResize height=', effectiveInsertHeight, 'hasBlocksInside=', hasBlocksInside);
            this.applyCBlockGhostResize(cBlockToResize, effectiveInsertHeight);
            
            // Если это нижний внешний коннектор c-block, пересчитываем позицию коннектора
            // после применения ghost resize, так как размер c-block изменился
            if (connectorType === ConnectorType.BOTTOM && targetBlock === cBlockToResize) {
                const updatedConnectorPos = getConnectorPosition(cBlockToResize, ConnectorType.BOTTOM);
                if (updatedConnectorPos) actualConnectorPos = updatedConnectorPos;
            }
        } else {
            this._log('show(): no cBlockToResize -> releaseCBlockGhostResize()');
            this.releaseCBlockGhostResize();
            // ВАЖНО: если только что убрали ghost-растяжение c-block и нацеливаемся на его нижний внешний коннектор,
            // нужно пересчитать позицию коннектора уже по "сжатому" состоянию
            if (connectorType === ConnectorType.BOTTOM && targetBlock === prevGhostElement && targetBlock.dataset.type === 'c-block') {
                const updatedAfterRelease = getConnectorPosition(targetBlock, ConnectorType.BOTTOM);
                if (updatedAfterRelease) actualConnectorPos = updatedAfterRelease;
            }
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

        // Уменьшаем высоту viewBox на 10
        const svgElements = blockClone.querySelectorAll('svg');
        if (svgElements.length > 0) {
            svgElements.forEach(svg => {
                const viewBox = svg.getAttribute('viewBox');
                if (viewBox) {
                    const viewBoxParts = viewBox.split(/\s+/).map(Number);
                    if (viewBoxParts.length === 4) {
                        // viewBox: 'x y width height' -> уменьшаем height (4-й элемент)
                        viewBoxParts[3] = Math.max(1, viewBoxParts[3] - 10);
                        svg.setAttribute('viewBox', viewBoxParts.join(' '));
                    }
                }
            });
        } else if (blockClone.tagName === 'svg') {
            // Если сам клон - это SVG элемент
            const viewBox = blockClone.getAttribute('viewBox');
            if (viewBox) {
                const viewBoxParts = viewBox.split(/\s+/).map(Number);
                if (viewBoxParts.length === 4) {
                    viewBoxParts[3] = Math.max(1, viewBoxParts[3] - 10);
                    blockClone.setAttribute('viewBox', viewBoxParts.join(' '));
                }
            }
        }

        // Получаем X координату целевого блока из его transform
        const targetTransform = this.getTranslateValues(targetBlock.getAttribute('transform'));
        
        const workspaceRect = this.containerSVG.getBoundingClientRect();
        const draggedBlockRect = draggedBlock.getBoundingClientRect();
        const offsetX = draggedConnectorPos.x - draggedBlockRect.left;
        const offsetY = draggedConnectorPos.y - draggedBlockRect.top;

        let finalX = actualConnectorPos.x - workspaceRect.left - offsetX;
        let finalY = actualConnectorPos.y - workspaceRect.top - offsetY;

        if (connectorType === ConnectorType.MIDDLE) {
            const targetType = targetBlock.dataset.type;
            const targetForm = BLOCK_FORMS[targetType];
            // ВАЖНО: сначала используем актуальную высоту из dataset.height (c-block может быть растянут),
            // затем падаем обратно на высоту формы
            const targetPathHeight = parseFloat(targetBlock.dataset.height) || targetForm?.pathHeight || DEFAULT_BLOCK_HEIGHT;
            const targetBottomOffset = targetForm?.bottomOffset || 0;
            const draggedType = draggedBlock.dataset.type;
            const draggedForm = BLOCK_FORMS[draggedType];
            const draggedTopOffset = draggedForm?.topOffset || 0;
            finalX = targetTransform.x;
            // Правильная формула для MIDDLE: позиция целевого блока + его высота - его bottomOffset + topOffset перетаскиваемого
            finalY = targetTransform.y + targetPathHeight - targetBottomOffset + draggedTopOffset;
        } else {
            finalX += 1;
            finalY += 1;
            this._log('show(): non-MIDDLE final pos', { finalX, finalY });
        }

        blockClone.setAttribute('transform', `translate(${finalX}, ${finalY})`);
        blockClone.style.pointerEvents = 'none';

        this.containerSVG.appendChild(blockClone);
        this.ghostElement = blockClone;
    }
    
    removeGhostElement() {
        if (this.ghostElement) {
            this._log('removeGhostElement()');
            this.ghostElement.remove();
            this.ghostElement = null;
        }
    }

    getTranslateValues(transformAttr) {
        // Используем общую утилиту
        return getTranslateValues(transformAttr);
    }

    hide() {
        this._log('hide() -> removeGhostElement + releaseCBlockGhostResize');
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
            this._log('applyCBlockGhostResize(): invalid args -> release');
            this.releaseCBlockGhostResize();
            return;
        }

        const current = this.currentGhostCBlock;
        if (current && current.element === cBlock && current.insertHeight === insertHeight) {
            this._log('applyCBlockGhostResize(): same params, skip');
            return;
        }

        this.releaseCBlockGhostResize();

        // Синхронизируем высоту c-block перед применением ghost resize
        // Это важно, если блоки были удалены из c-block, но размер еще не обновлен
        syncCBlockHeight(cBlock, this.containerSVG);

        const pathElement = cBlock.querySelector('path');
        if (!pathElement) {
            this._log('applyCBlockGhostResize(): path not found');
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
                this._log('applyCBlockGhostResize(): saving positions of blocksAfter', blocksAfter.map(b => b.dataset.instanceId));
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

        if (originalState.originalInnerHeight) {
            const baseInnerHeight = parseFloat(originalState.originalInnerHeight);
            if (!Number.isNaN(baseInnerHeight)) {
                const ghostInnerHeight = String(baseInnerHeight + insertHeight);
                cBlock.dataset.innerHeight = ghostInnerHeight;
            }
        }

        // Смещаем блоки после c-block вниз на высоту вставляемого блока
        if (cBlock.dataset.next) {
            const nextBlockId = cBlock.dataset.next;
            const nextBlock = this.containerSVG.querySelector(`[data-instance-id="${nextBlockId}"]`);
            if (nextBlock) {
                const blocksAfter = getAllChainBlocks(nextBlock, this.containerSVG);
                this._log('applyCBlockGhostResize(): shifting blocksAfter by', insertHeight, blocksAfter.map(b => b.dataset.instanceId));
                blocksAfter.forEach(block => {
                    const transform = this.getTranslateValues(block.getAttribute('transform'));
                    const newY = transform.y + insertHeight;
                    
                    block.setAttribute('transform', `translate(${transform.x}, ${newY})`);
                });
            }
        }

        this.currentGhostCBlock = {
            ...originalState,
            ghostPath: resizedPath,
            ghostHeight,
            ghostInnerHeight
        };
        this._log('applyCBlockGhostResize(): applied', { cBlock: cBlock.dataset.instanceId, ghostHeight, ghostInnerHeight, insertHeight });
    }

    releaseCBlockGhostResize() {
        if (!this.currentGhostCBlock) {
            return;
        }

        const { element, originalPath, originalHeight, originalInnerHeight, ghostPath, ghostHeight, ghostInnerHeight, blocksAfterPositions } = this.currentGhostCBlock;
        const pathElement = element.querySelector('path');
        const currentPath = pathElement?.getAttribute('d');
        this._log('releaseCBlockGhostResize(): restoring for', element?.dataset?.instanceId);
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

        // Возвращаем блоки после c-block на исходные позиции
        if (blocksAfterPositions?.size) {
            this._log('releaseCBlockGhostResize(): restoring positions for blocksAfter', Array.from(blocksAfterPositions.keys()));
            blocksAfterPositions.forEach((position, blockId) => {
                const block = this.containerSVG.querySelector(`[data-instance-id="${blockId}"]`);
                if (block) {
                    block.setAttribute('transform', `translate(${position.x}, ${position.y})`);
                }
            });
        }

        this.currentGhostCBlock = null;
        this._log('releaseCBlockGhostResize(): cleared state');
    }
}

export default GhostBlock;

