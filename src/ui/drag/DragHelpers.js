import { BLOCK_FORMS } from '../../utils/Constants.js';

export function getColorFromTemplate(template) {
    if (template?.dataset?.color) {
        return template.dataset.color;
    }

    const path = template?.querySelector('path');
    return path?.getAttribute('fill') ?? null;
}

export function isPointerInsideWorkspace(workspace, event) {
    const rect = workspace.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
}

export function isPointerInsideSidebar(sidebar, event) {
    const rect = sidebar.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
}

export function isBlockInsideSidebar(element, sidebar) {
    const blockRect = element.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();

    const blockCenterX = blockRect.left + blockRect.width / 2;
    const blockCenterY = blockRect.top + blockRect.height / 2;

    return blockCenterX >= sidebarRect.left && blockCenterX <= sidebarRect.right &&
        blockCenterY >= sidebarRect.top && blockCenterY <= sidebarRect.bottom;
}

export function isPointerInsideTrash(trashCan, event) {
    const rect = trashCan.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
}

export function getTranslateValues(transformAttr) {
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

export function getBlockPathHeight(block) {
    const blockType = block.dataset.type;
    const blockForm = BLOCK_FORMS[blockType];

    if (blockType === 'c-block') {
        return parseFloat(block.dataset.height) || blockForm?.pathHeight || 58;
    }

    return blockForm?.pathHeight || parseFloat(block.dataset.height) || 58;
}

