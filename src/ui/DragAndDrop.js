import DragAndDropController from './drag/DragAndDropController.js';

export function initializeDragAndDrop({
    workspaceSelector = '#workspace',
    blockTemplatesSelector = '#block-templates',
    workspaceSVGSelector = '#block-container',
    dragOverlaySVGSelector = '#drag-overlay-svg',
    sidebarSelector = '#sidebar',
    trashCanSelector = '#trash-can'
} = {}) {
    const controller = new DragAndDropController({
        workspaceSelector,
        blockTemplatesSelector,
        workspaceSVGSelector,
        dragOverlaySVGSelector,
        sidebarSelector,
        trashCanSelector
    });

    controller.initialize();
    return controller;
}

export default initializeDragAndDrop;

