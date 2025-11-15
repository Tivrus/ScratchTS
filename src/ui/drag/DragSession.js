import { findNearestConnector, getConnectorPosition, ConnectorType } from '../../blocks/BlockConnectors.js';
import { getAllChainBlocks } from '../../blocks/BlockChain.js';
import { saveWorkspaceState } from '../../utils/WorkspaceState.js';
import { updateDebugOverlay } from '../../blocks/BlockConnectors.js';
import {
    getTranslateValues,
    isPointerInsideWorkspace,
    isPointerInsideSidebar,
    isBlockInsideSidebar,
    isPointerInsideTrash
} from './DragHelpers.js';

export default class DragSession {
    constructor({
        workspace,
        workspaceSVG,
        dragOverlaySVG,
        sidebar,
        trashCan,
        ghostBlock,
        chainSplitManager,
        connectionManager,
        animator
    }) {
        this.workspace = workspace;
        this.workspaceSVG = workspaceSVG;
        this.dragOverlaySVG = dragOverlaySVG;
        this.sidebar = sidebar;
        this.trashCan = trashCan;
        this.ghostBlock = ghostBlock;
        this.chainSplitManager = chainSplitManager;
        this.connectionManager = connectionManager;
        this.animator = animator;

        this.activeDrag = null;

        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
    }

    beginDrag(element, event, {
        isNew,
        offsetX,
        offsetY,
        startX,
        startY,
        skipInitialMove = false,
        sourceContainer = null,
        isDraggingChain = false
    }) {
        const currentTransform = getTranslateValues(element.getAttribute('transform'));

        const resolvedStartX = startX ?? currentTransform.x;
        const resolvedStartY = startY ?? currentTransform.y;

        const originContainer = (!isNew && element.parentNode) ? element.parentNode : sourceContainer;

        if (isDraggingChain) {
            const allBlocks = getAllChainBlocks(element, originContainer || this.workspaceSVG);
            allBlocks.forEach(block => {
                this.dragOverlaySVG.appendChild(block);
                block.classList.add('dragging');
            });
        } else {
            this.dragOverlaySVG.appendChild(element);
            element.classList.add('dragging');
        }

        this.activeDrag = {
            element,
            offsetX,
            offsetY,
            isNew,
            startX: resolvedStartX,
            startY: resolvedStartY,
            sourceContainer: originContainer,
            isDraggingChain
        };

        if (!skipInitialMove) {
            this.handlePointerMove(event);
        }

        window.addEventListener('pointermove', this.handlePointerMove, { passive: false });
        window.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    }

    handlePointerMove(event) {
        if (!this.activeDrag) {
            return;
        }

        event.preventDefault();

        const { element, offsetX, offsetY, isDraggingChain } = this.activeDrag;
        const overlayRect = this.dragOverlaySVG.getBoundingClientRect();

        const newX = event.clientX - overlayRect.left - offsetX;
        const newY = event.clientY - overlayRect.top - offsetY;

        if (isDraggingChain) {
            const currentTransform = getTranslateValues(element.getAttribute('transform'));
            const deltaX = newX - currentTransform.x;
            const deltaY = newY - currentTransform.y;

            const allBlocks = getAllChainBlocks(element, this.dragOverlaySVG);
            allBlocks.forEach(block => {
                const blockTransform = getTranslateValues(block.getAttribute('transform'));
                block.setAttribute('transform', `translate(${blockTransform.x + deltaX}, ${blockTransform.y + deltaY})`);
            });
        } else {
            element.setAttribute('transform', `translate(${newX}, ${newY})`);
        }

        const allWorkspaceBlocks = Array.from(this.workspaceSVG.querySelectorAll('.workspace-block'));
        const nearestConnection = findNearestConnector(element, allWorkspaceBlocks);

        if (nearestConnection) {
            const targetConnectorPos = getConnectorPosition(nearestConnection.targetBlock, nearestConnection.targetConnector);
            const draggedConnectorPos = getConnectorPosition(element, nearestConnection.draggedConnector);

            if (nearestConnection.targetConnector === ConnectorType.MIDDLE) {
                this.chainSplitManager.ensureSplit(nearestConnection.targetBlock, element);
            } else if (
                nearestConnection.targetConnector === ConnectorType.INNER_TOP &&
                nearestConnection.targetBlock?.dataset?.type === 'c-block'
            ) {
                this.chainSplitManager.ensureCBlockInnerSplit(nearestConnection.targetBlock, element);
            } else {
                this.chainSplitManager.closeSplit();
            }

            this.ghostBlock.show(
                element,
                nearestConnection.targetBlock,
                targetConnectorPos,
                draggedConnectorPos,
                nearestConnection.targetConnector
            );
        } else {
            this.ghostBlock.hide();
            this.chainSplitManager.closeSplit();
        }

        updateDebugOverlay(this.workspaceSVG);
    }

    handlePointerUp(event) {
        this.endDrag(event);
    }

    endDrag(event) {
        if (!this.activeDrag) {
            this.cleanup();
            return;
        }

        const { element, isNew, startX, startY, sourceContainer, isDraggingChain } = this.activeDrag;

        if (isDraggingChain) {
            const allBlocks = getAllChainBlocks(element, this.dragOverlaySVG);
            allBlocks.forEach(block => block.classList.remove('dragging'));
        } else {
            element.classList.remove('dragging');
        }

        const blockInSidebar = isBlockInsideSidebar(element, this.sidebar);
        const pointerInSidebar = isPointerInsideSidebar(this.sidebar, event);
        const pointerInTrash = isPointerInsideTrash(this.trashCan, event);
        const insideWorkspace = isPointerInsideWorkspace(this.workspace, event);

        if (pointerInTrash) {
            const blocksToRemove = isDraggingChain
                ? getAllChainBlocks(element, this.dragOverlaySVG)
                : [element];

            this.animator.shrinkBlocks(blocksToRemove, () => {
                this.notifyWorkspaceChange();
            });
        } else if (blockInSidebar && pointerInSidebar) {
            const blocksToRemove = isDraggingChain
                ? getAllChainBlocks(element, this.dragOverlaySVG)
                : [element];

            this.animator.shrinkBlocks(blocksToRemove, () => {
                this.notifyWorkspaceChange();
            });
        } else if (blockInSidebar && !pointerInSidebar) {
            const currentTransform = getTranslateValues(element.getAttribute('transform'));
            const workspaceRect = this.workspaceSVG.getBoundingClientRect();
            const overlayRect = this.dragOverlaySVG.getBoundingClientRect();
            const sidebarRect = this.sidebar.getBoundingClientRect();

            const adjustedX = sidebarRect.right - overlayRect.left + 10;
            const adjustedY = currentTransform.y;

            const finalX = adjustedX - (workspaceRect.left - overlayRect.left);
            const finalY = adjustedY - (workspaceRect.top - overlayRect.top);

            element.setAttribute('transform', `translate(${finalX}, ${finalY})`);
            element.dataset.topLevel = 'true';
            this.workspaceSVG.appendChild(element);
            this.notifyWorkspaceChange();
        } else if (insideWorkspace) {
            const workspaceRect = this.workspaceSVG.getBoundingClientRect();
            const overlayRect = this.dragOverlaySVG.getBoundingClientRect();

            if (isDraggingChain) {
                const allBlocks = getAllChainBlocks(element, this.dragOverlaySVG);
                allBlocks.forEach(block => {
                    const currentTransform = getTranslateValues(block.getAttribute('transform'));
                    const adjustedX = currentTransform.x - (workspaceRect.left - overlayRect.left);
                    const adjustedY = currentTransform.y - (workspaceRect.top - overlayRect.top);
                    block.setAttribute('transform', `translate(${adjustedX}, ${adjustedY})`);
                    this.workspaceSVG.appendChild(block);
                });
            } else {
                const currentTransform = getTranslateValues(element.getAttribute('transform'));
                const adjustedX = currentTransform.x - (workspaceRect.left - overlayRect.left);
                const adjustedY = currentTransform.y - (workspaceRect.top - overlayRect.top);
                element.setAttribute('transform', `translate(${adjustedX}, ${adjustedY})`);
                this.workspaceSVG.appendChild(element);
            }

            const allWorkspaceBlocks = Array.from(this.workspaceSVG.querySelectorAll('.workspace-block'));
            const nearestConnection = findNearestConnector(element, allWorkspaceBlocks);

            if (nearestConnection) {
                this.ghostBlock.hide();

                if (
                    nearestConnection.targetConnector === ConnectorType.MIDDLE ||
                    (nearestConnection.targetConnector === ConnectorType.INNER_TOP &&
                        nearestConnection.targetBlock?.dataset?.type === 'c-block')
                ) {
                    this.chainSplitManager.closeSplit();
                }
                this.connectionManager.connectBlocks(element, nearestConnection, workspaceRect);
            } else {
                element.dataset.topLevel = 'true';
            }

            this.notifyWorkspaceChange();
        } else {
            if (isNew) {
                element.remove();
            } else {
                element.setAttribute('transform', `translate(${startX}, ${startY})`);
                if (sourceContainer) {
                    sourceContainer.appendChild(element);
                }
            }
        }

        this.activeDrag = null;
        this.cleanup();
    }

    cleanup() {
        window.removeEventListener('pointermove', this.handlePointerMove);
        window.removeEventListener('pointerup', this.handlePointerUp);
        this.ghostBlock.hide();
        this.chainSplitManager.closeSplit();
    }

    notifyWorkspaceChange() {
        updateDebugOverlay(this.workspaceSVG);
        saveWorkspaceState(this.workspaceSVG);
    }
}

