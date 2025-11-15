import { createWorkspaceBlock } from '../../blocks/BlockFactory.js';
import { getTopLevelBlock, breakChain } from '../../blocks/BlockChain.js';
import { removeBlockFromInside, isBlockInsideCBlock, isCBlock, syncAllCBlockHeights, getCBlockState } from '../../blocks/CBlock.js';
import { saveWorkspaceState, initWorkspaceState } from '../../utils/WorkspaceState.js';
import { initBlockAlignment } from '../../utils/BlockAlignment.js';
import { initDebugMode } from '../../blocks/BlockConnectors.js';
import GhostBlock from '../GhostBlock.js';
import ChainSplitManager from './ChainSplitManager.js';
import ConnectionManager from './ConnectionManager.js';
import DragSession from './DragSession.js';
import DragAnimator from './DragAnimator.js';
import {
    getColorFromTemplate,
    getTranslateValues
} from './DragHelpers.js';

export default class DragAndDropController {
    constructor({
        workspaceSelector,
        blockTemplatesSelector,
        workspaceSVGSelector,
        dragOverlaySVGSelector,
        sidebarSelector,
        trashCanSelector
    }) {
        this.workspace = document.querySelector(workspaceSelector);
        this.templatesContainer = document.querySelector(blockTemplatesSelector);
        this.workspaceSVG = document.querySelector(workspaceSVGSelector);
        this.dragOverlaySVG = document.querySelector(dragOverlaySVGSelector);
        this.sidebar = document.querySelector(sidebarSelector);
        this.trashCan = document.querySelector(trashCanSelector);

        this.ghostBlock = new GhostBlock(this.workspaceSVG);
    }

    isReady() {
        return Boolean(
            this.workspace &&
            this.templatesContainer &&
            this.workspaceSVG &&
            this.dragOverlaySVG &&
            this.sidebar &&
            this.trashCan
        );
    }

    initialize() {
        if (!this.isReady()) {
            console.warn('[DragAndDrop] Workspace, SVG, drag overlay, sidebar, trash-can or templates container not found.');
            return;
        }

        this.chainSplitManager = new ChainSplitManager(this.workspaceSVG, this.dragOverlaySVG);
        this.connectionManager = new ConnectionManager(this.workspaceSVG);
        this.animator = new DragAnimator(this.dragOverlaySVG);
        this.dragSession = new DragSession({
            workspace: this.workspace,
            workspaceSVG: this.workspaceSVG,
            dragOverlaySVG: this.dragOverlaySVG,
            sidebar: this.sidebar,
            trashCan: this.trashCan,
            ghostBlock: this.ghostBlock,
            chainSplitManager: this.chainSplitManager,
            connectionManager: this.connectionManager,
            animator: this.animator
        });

        this.registerEventListeners();
        this.initializeWorkspace();
        this.registerDebugHelpers();
    }

    registerEventListeners() {
        this.templatesContainer.addEventListener('pointerdown', this.handleTemplatePointerDown);
        this.templatesContainer.addEventListener('dragstart', (event) => event.preventDefault());

        this.workspaceSVG.addEventListener('pointerdown', (event) => {
            const block = event.target.closest('.workspace-block');
            if (block) {
                this.handleWorkspaceBlockPointerDown(block, event);
            }
        });
    }

    initializeWorkspace() {
        initDebugMode();
        initWorkspaceState(this.workspaceSVG);
        initBlockAlignment(this.workspaceSVG);
        syncAllCBlockHeights(this.workspaceSVG);
    }

    registerDebugHelpers() {
        if (typeof window === 'undefined') {
            return;
        }

        window.getCBlocksState = () => {
            const allBlocks = this.workspaceSVG.querySelectorAll('.workspace-block');
            const cBlocks = Array.from(allBlocks).filter(block => isCBlock(block));

            console.log(`[CBlock Debug] Found ${cBlocks.length} c-block(s) in workspace:`);

            cBlocks.forEach((cBlock, index) => {
                const state = getCBlockState(cBlock, this.workspaceSVG);
                console.log(`\n[CBlock ${index + 1}]:`, {
                    id: cBlock.dataset.instanceId,
                    opcode: cBlock.dataset.id,
                    ...state
                });
            });

            return cBlocks.map(cb => getCBlockState(cb, this.workspaceSVG));
        };

        window.syncCBlocks = () => {
            syncAllCBlockHeights(this.workspaceSVG);
            console.log('[CBlock] All c-blocks synchronized');
        };

        console.log('[CBlock] Debug functions registered: getCBlocksState(), syncCBlocks()');
    }

    handleTemplatePointerDown = (event) => {
        const template = event.target.closest('.block-template');
        if (!template) {
            return;
        }

        event.preventDefault();

        const blockConfig = template._blockConfig;
        if (!blockConfig) {
            console.warn('[DragAndDrop] Block config not found on template.');
            return;
        }

        const templateRect = template.getBoundingClientRect();
        const overlayRect = this.dragOverlaySVG.getBoundingClientRect();

        const color = getColorFromTemplate(template);

        const initialX = templateRect.left - overlayRect.left + 11;
        const initialY = templateRect.top - overlayRect.top + 11;

        const blockElement = createWorkspaceBlock(blockConfig, { color, x: initialX, y: initialY });
        if (!blockElement) {
            return;
        }

        blockElement.addEventListener('pointerdown', this.handleWorkspaceBlockPointerDownFromBlock);

        const offsetX = event.clientX - templateRect.left - 11;
        const offsetY = event.clientY - templateRect.top - 11;

        this.dragSession.beginDrag(blockElement, event, {
            isNew: true,
            offsetX,
            offsetY,
            startX: initialX,
            startY: initialY,
            skipInitialMove: true
        });
    };

    handleWorkspaceBlockPointerDownFromBlock = (event) => {
        this.handleWorkspaceBlockPointerDown(event.currentTarget, event);
    };

    handleWorkspaceBlockPointerDown(block, event) {
        event.preventDefault();
        event.stopPropagation();

        const blockRect = block.getBoundingClientRect();
        const offsetX = event.clientX - blockRect.left;
        const offsetY = event.clientY - blockRect.top;

        const currentTransform = getTranslateValues(block.getAttribute('transform'));

        const topBlock = getTopLevelBlock(block, this.workspaceSVG);
        const isDraggingTopBlock = topBlock === block;

        if (!isDraggingTopBlock && block.dataset.parent) {
            const parentBlockId = block.dataset.parent;
            const parentBlock = this.workspaceSVG.querySelector(`[data-instance-id="${parentBlockId}"]`);
            if (parentBlock) {
                if (isCBlock(parentBlock)) {
                    if (isBlockInsideCBlock(parentBlock, block, this.workspaceSVG)) {
                        removeBlockFromInside(parentBlock, block, this.workspaceSVG);
                    } else {
                        breakChain(parentBlock, block);
                    }
                } else {
                    breakChain(parentBlock, block);
                }
                saveWorkspaceState(this.workspaceSVG);
            }
        }

        this.dragSession.beginDrag(block, event, {
            isNew: false,
            offsetX,
            offsetY,
            startX: currentTransform.x,
            startY: currentTransform.y,
            isDraggingChain: true
        });
    }
}

