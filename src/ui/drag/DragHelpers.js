import { 
    BLOCK_FORMS, 
    DEFAULT_BLOCK_HEIGHT 
} from '../../utils/Constants.js';

import { 
    getTranslateValues, 
    getBoundingClientRectRounded 
} from '../../utils/DOMUtils.js';


export { getTranslateValues };

export function getColorFromTemplate(template) {
    if (template?.dataset?.color) {
        return template.dataset.color;
    }

    const path = template?.querySelector('path');
    return path?.getAttribute('fill') ?? null;
}

export function isPointerInsideWorkspace(workspace, event) {
    const rect = getBoundingClientRectRounded(workspace);
    return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
}

export function isPointerInsideSidebar(sidebar, event) {
    const rect = getBoundingClientRectRounded(sidebar);
    return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
}

export function isBlockInsideSidebar(element, sidebar) {
    const blockRect = getBoundingClientRectRounded(element);
    const sidebarRect = getBoundingClientRectRounded(sidebar);

    const blockCenterX = blockRect.left + blockRect.width / 2;
    const blockCenterY = blockRect.top + blockRect.height / 2;

    return blockCenterX >= sidebarRect.left && blockCenterX <= sidebarRect.right &&
        blockCenterY >= sidebarRect.top && blockCenterY <= sidebarRect.bottom;
}

export function isPointerInsideTrash(trashCan, event) {
    const rect = getBoundingClientRectRounded(trashCan);
    return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
}

export function getBlockPathHeight(block) {
    const blockType = block.dataset.type;
    const blockForm = BLOCK_FORMS[blockType];

    if (blockType === 'c-block') {
        return parseFloat(block.dataset.height) || blockForm?.height || DEFAULT_BLOCK_HEIGHT;
    }

    return blockForm?.height || parseFloat(block.dataset.height) || DEFAULT_BLOCK_HEIGHT;
}

