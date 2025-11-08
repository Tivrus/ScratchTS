/**
 * GhostBlock - визуализация места подключения блока
 */

import { BLOCK_FORMS } from '../utils/Constants.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class GhostBlock {
    constructor(containerSVG) {
        this.containerSVG = containerSVG;
        this.ghostElement = null;
    }

    show(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos, connectorType = null) {
        this.hide();

        if (!draggedBlock || !targetBlock || !targetConnectorPos || !draggedConnectorPos) return;

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
        const finalX = targetTransform.x;
        let finalY;
        
        // Для MIDDLE коннектора используем прямой расчет на основе реальной высоты path
        if (connectorType === 'MIDDLE') {
            const targetType = targetBlock.dataset.type;
            const targetForm = BLOCK_FORMS[targetType];
            const targetPathHeight = targetForm?.pathHeight || parseFloat(targetBlock.dataset.height) || 58;
            
            // Получаем topOffset ghostblock для компенсации пустого пространства в viewBox
            const draggedType = draggedBlock.dataset.type;
            const draggedForm = BLOCK_FORMS[draggedType];
            const draggedTopOffset = draggedForm?.topOffset || 0;
            
            // Позиция = позиция targetBlock + высота path targetBlock - topOffset ghostblock
            finalY = targetTransform.y + targetPathHeight - draggedTopOffset;
        } else {
            // Для других коннекторов используем стандартный расчет
            const draggedBlockRect = draggedBlock.getBoundingClientRect();
            const offsetY = draggedConnectorPos.y - draggedBlockRect.top;
            finalY = targetConnectorPos.y - workspaceRect.top - offsetY;
        }

        blockClone.setAttribute('transform', `translate(${finalX}, ${finalY})`);
        blockClone.style.pointerEvents = 'none';

        this.containerSVG.appendChild(blockClone);
        this.ghostElement = blockClone;
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
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
    }

    isVisible() {
        return this.ghostElement !== null;
    }
}

export default GhostBlock;

