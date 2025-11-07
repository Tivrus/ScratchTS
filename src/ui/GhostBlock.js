/**
 * GhostBlock - визуализация места подключения блока
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class GhostBlock {
    constructor(containerSVG) {
        this.containerSVG = containerSVG;
        this.ghostElement = null;
    }

    show(draggedBlock, targetBlock, targetConnectorPos, draggedConnectorPos) {
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
        
        // Для Y координаты вычисляем offset относительно верха блока
        const draggedBlockRect = draggedBlock.getBoundingClientRect();
        const offsetY = draggedConnectorPos.y - draggedBlockRect.top;
        
        const workspaceRect = this.containerSVG.getBoundingClientRect();
        // X координата берется от целевого блока, чтобы обеспечить идеальное выравнивание
        const finalX = targetTransform.x;
        const finalY = targetConnectorPos.y - workspaceRect.top - offsetY;

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

