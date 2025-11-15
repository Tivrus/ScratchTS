export default class DragAnimator {
    constructor(dragOverlaySVG) {
        this.dragOverlaySVG = dragOverlaySVG;
    }

    shrinkBlock(element, callback) {
        const blockRect = element.getBoundingClientRect();
        const blockCenterX = blockRect.left + blockRect.width / 2;
        const blockCenterY = blockRect.top + blockRect.height / 2;

        const overlayRect = this.dragOverlaySVG.getBoundingClientRect();
        const relativeCenterX = blockCenterX - overlayRect.left;
        const relativeCenterY = blockCenterY - overlayRect.top;

        element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        element.style.transformOrigin = `${relativeCenterX}px ${relativeCenterY}px`;
        element.style.transform = 'scale(0.1)';
        element.style.opacity = '0';

        setTimeout(() => {
            element.remove();
            if (callback) callback();
        }, 300);
    }

    shrinkBlocks(blocks, callback) {
        const targets = (blocks || []).filter(Boolean);
        if (!targets.length) {
            if (callback) callback();
            return;
        }

        let remaining = targets.length;
        const handleComplete = () => {
            remaining -= 1;
            if (remaining === 0 && callback) {
                callback();
            }
        };

        targets.forEach(block => this.shrinkBlock(block, handleComplete));
    }
}

