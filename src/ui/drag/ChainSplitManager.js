import { getChainBlocks } from '../../blocks/BlockChain.js';
import { getBlockPathHeight, getTranslateValues } from './DragHelpers.js';

export default class ChainSplitManager {
    constructor(workspaceSVG, dragOverlaySVG) {
        this.workspaceSVG = workspaceSVG;
        this.dragOverlaySVG = dragOverlaySVG;
        this.currentSplitState = null;
    }

    ensureSplit(targetBlock, draggedBlock) {
        if (
            !this.currentSplitState ||
            this.currentSplitState.type !== 'chain' ||
            this.currentSplitState.targetBlock !== targetBlock
        ) {
            this.closeSplit();
            this.currentSplitState = this.splitChainForInsertion(targetBlock, draggedBlock);
        }
        return this.currentSplitState;
    }

    ensureCBlockInnerSplit(cBlock, draggedBlock) {
        if (
            !this.currentSplitState ||
            this.currentSplitState.type !== 'cblock-inner' ||
            this.currentSplitState.cBlock !== cBlock
        ) {
            this.closeSplit();
            this.currentSplitState = this.splitCBlockInner(cBlock, draggedBlock);
        }
        return this.currentSplitState;
    }

    splitChainForInsertion(targetBlock, draggedBlock) {
        if (!targetBlock.dataset.next) return null;

        const lowerBlockId = targetBlock.dataset.next;
        const lowerBlock = this.workspaceSVG.querySelector(`[data-instance-id="${lowerBlockId}"]`);

        if (!lowerBlock) return null;

        const firstBlockPathHeight = getBlockPathHeight(draggedBlock);

        const draggedChain = getChainBlocks(draggedBlock, this.dragOverlaySVG);
        let totalHeight = 0;
        draggedChain.forEach(block => {
            totalHeight += getBlockPathHeight(block);
        });

        const lowerChain = getChainBlocks(lowerBlock, this.workspaceSVG);
        const originalPositions = new Map();

        lowerChain.forEach(block => {
            const transform = getTranslateValues(block.getAttribute('transform'));
            originalPositions.set(block.dataset.instanceId, { x: transform.x, y: transform.y });
        });

        lowerChain.forEach(block => {
            const transform = getTranslateValues(block.getAttribute('transform'));
            block.setAttribute('transform', `translate(${transform.x}, ${transform.y + firstBlockPathHeight})`);
        });

        return {
            type: 'chain',
            targetBlock,
            lowerBlock,
            originalPositions,
            splitHeight: firstBlockPathHeight,
            totalInsertHeight: totalHeight
        };
    }

    splitCBlockInner(cBlock, draggedBlock) {
        if (!cBlock?.dataset?.substack) return null;

        const firstInnerBlock = this.workspaceSVG.querySelector(`[data-instance-id="${cBlock.dataset.substack}"]`);
        if (!firstInnerBlock) return null;

        const innerChain = getChainBlocks(firstInnerBlock, this.workspaceSVG);
        if (!innerChain.length) return null;

        const splitHeight = getBlockPathHeight(draggedBlock);
        const originalPositions = new Map();

        innerChain.forEach(block => {
            const transform = getTranslateValues(block.getAttribute('transform'));
            originalPositions.set(block.dataset.instanceId, { x: transform.x, y: transform.y });
            block.setAttribute('transform', `translate(${transform.x}, ${transform.y + splitHeight})`);
        });

        return {
            type: 'cblock-inner',
            cBlock,
            innerBlocks: innerChain.map(block => block.dataset.instanceId),
            originalPositions,
            splitHeight
        };
    }

    closeSplit() {
        if (!this.currentSplitState) return;

        if (this.currentSplitState.type === 'chain') {
            const { lowerBlock, originalPositions } = this.currentSplitState;
            const lowerChain = getChainBlocks(lowerBlock, this.workspaceSVG);
            lowerChain.forEach(block => {
                const original = originalPositions.get(block.dataset.instanceId);
                if (original) {
                    block.setAttribute('transform', `translate(${original.x}, ${original.y})`);
                }
            });
        } else if (this.currentSplitState.type === 'cblock-inner') {
            const { innerBlocks = [], originalPositions } = this.currentSplitState;
            innerBlocks.forEach(blockId => {
                const block = this.workspaceSVG.querySelector(`[data-instance-id="${blockId}"]`);
                const original = originalPositions.get(blockId);
                if (block && original) {
                    block.setAttribute('transform', `translate(${original.x}, ${original.y})`);
                }
            });
        }

        this.currentSplitState = null;
    }
}

