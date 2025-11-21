import { createWorkspaceBlock } from '../blocks/BlockFactory.js';
import { getChainBlocks } from '../blocks/BlockChain.js';
import { insertBlockInside, getInsertPosition, isCBlock } from '../blocks/CBlock.js';
import { getTranslateValues, setTranslate } from './DOMUtils.js';
import { BLOCK_FORMS, DEFAULT_BLOCK_HEIGHT } from './Constants.js';
import { blocks } from '../data/BlocksData.js';
import { categories } from '../data/CategoriesData.js';

function findBlockConfig(opcode) {
    return blocks.find(block => block.id === opcode) || null;
}

function getCategoryColor(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.color || '#4c97ff';
}

function createBlockFromData(blockData, workspaceSVG) {
    const blockConfig = findBlockConfig(blockData.opcode);
    if (!blockConfig) {
        console.warn('[WorkspaceLoader] Block config not found for opcode:', blockData.opcode);
        return null;
    }

    const categoryColor = getCategoryColor(blockConfig.category);
    const x = blockData.x || 0;
    const y = blockData.y || 0;

    const blockElement = createWorkspaceBlock(blockConfig, { color: categoryColor, x, y });

    // Восстанавливаем instanceId из данных
    if (blockData.instanceId) {
        blockElement.dataset.instanceId = blockData.instanceId;
    }

    // Восстанавливаем topLevel
    if (blockData.topLevel) {
        blockElement.dataset.topLevel = String(blockData.topLevel);
    }

    return blockElement;
}

function restoreConnections(blocksData, blockMap, workspaceSVG) {
    Object.entries(blocksData).forEach(([instanceId, blockData]) => {
        const block = blockMap.get(instanceId);
        // Восстанавливаем связь next
        if (blockData.next) {
            const nextBlock = blockMap.get(blockData.next);
            if (nextBlock) {
                block.dataset.next = blockData.next;
                block.dataset.bottomConnected = 'true';
                nextBlock.dataset.parent = instanceId;
                nextBlock.dataset.topConnected = 'true';
                nextBlock.dataset.topLevel = 'false';

                // Позиционируем следующий блок
                const blockForm = BLOCK_FORMS[block.dataset.type] || {};
                const nextForm = BLOCK_FORMS[nextBlock.dataset.type] || {};
                const blockPathHeight = parseFloat(block.dataset.height) || blockForm.pathHeight || DEFAULT_BLOCK_HEIGHT;
                const blockTransform = getTranslateValues(block.getAttribute('transform'));
                const joinDelta = blockPathHeight - (blockForm.bottomOffset || 0) + (nextForm.topOffset || 0);
                const nextY = blockTransform.y + joinDelta;
                setTranslate(nextBlock, blockTransform.x, nextY);
            }
        }

        // Восстанавливаем связь parent
        if (blockData.parent) {
            const parentBlock = blockMap.get(blockData.parent);
            if (parentBlock) {
                block.dataset.parent = blockData.parent;
                block.dataset.topConnected = 'true';
                block.dataset.topLevel = 'false';
            }
        }

        // Восстанавливаем SUBSTACK для c-block
        if (blockData.inputs?.SUBSTACK && isCBlock(block)) {
            const substackId = blockData.inputs.SUBSTACK[1];
            const substackBlock = blockMap.get(substackId);
            if (substackBlock) {
                block.dataset.substack = substackId;
                substackBlock.dataset.parent = instanceId;
                substackBlock.dataset.topConnected = 'true';
                substackBlock.dataset.topLevel = 'false';

                // Позиционируем внутренние блоки
                const insertPos = getInsertPosition(block, workspaceSVG);
                setTranslate(substackBlock, insertPos.x, insertPos.y);

                // Позиционируем остальные блоки в цепи
                const chain = getChainBlocks(substackBlock, workspaceSVG);
                let currentY = insertPos.y;
                for (let i = 1; i < chain.length; i++) {
                    const chainBlock = chain[i];
                    const prevBlock = chain[i - 1];
                    const prevForm = BLOCK_FORMS[prevBlock.dataset.type] || {};
                    const nextForm = BLOCK_FORMS[chainBlock.dataset.type] || {};
                    const prevPathHeight = parseFloat(prevBlock.dataset.height) || prevForm.pathHeight || DEFAULT_BLOCK_HEIGHT;
                    const joinDelta = prevPathHeight - (prevForm.bottomOffset || 0) + (nextForm.topOffset || 0);
                    currentY += joinDelta;
                    setTranslate(chainBlock, insertPos.x, currentY);
                }
            }
        }
    });
}

export async function loadWorkspaceFromJSON(workspaceData, workspaceSVG) {
    try {
        // Очищаем текущий workspace
        const existingBlocks = workspaceSVG.querySelectorAll('.workspace-block');
        existingBlocks.forEach(block => block.remove());

        const blocksData = workspaceData.blocks;
        const blockMap = new Map();

        // Создаем все блоки
        Object.entries(blocksData).forEach(([instanceId, blockData]) => {
            const block = createBlockFromData(blockData, workspaceSVG);
            if (block) {
                // Используем instanceId из данных
                if (instanceId) {
                    block.dataset.instanceId = instanceId;
                }
                blockMap.set(instanceId, block);
                workspaceSVG.appendChild(block);
            }
        });

        // Восстанавливаем связи
        restoreConnections(blocksData, blockMap, workspaceSVG);

        // Синхронизируем высоты c-block
        const { syncCBlockHeight } = await import('../blocks/CBlock.js');
        const cBlocks = Array.from(workspaceSVG.querySelectorAll('.workspace-block'))
            .filter(block => isCBlock(block));
        
        for (const cBlock of cBlocks) {
            syncCBlockHeight(cBlock, workspaceSVG);
        }
        return true;
    } catch (error) {
        console.error('[WorkspaceLoader] Error loading workspace:', error);
        return false;
    }
}

