import { 
    CONNECTOR_THRESHOLD, 
    CONNECTOR_SOCKET_HEIGHT, 
    CONNECTOR_OFFSETS
} from '../../utils/Constants.js';

import { ConnectorType } from '../../blocks/BlockConnectors.js';
import { getBlockPathHeight } from './DragHelpers.js';
import { getTranslateValues } from '../../utils/DOMUtils.js';
import { getChainBlocks } from '../../blocks/BlockChain.js';

export class BlockPositionCalculator {
    static calculateBlockPosition(targetBlock, draggedBlock, connectorType, workspaceSVG) {
        if (!targetBlock || !draggedBlock || !workspaceSVG) {
            return null;
        }

        const targetTransform = getTranslateValues(targetBlock.getAttribute('transform'));
        const draggedBlockHeight = getBlockPathHeight(draggedBlock);
        
        const finalX = targetTransform.x;
        let finalY;

        // Получаем цепь блоков для анализа
        const draggedChain = getChainBlocks(draggedBlock, workspaceSVG);
        const chainLength = draggedChain.length;
        const blockType = draggedBlock.dataset.type;

        if (connectorType === ConnectorType.TOP) {
            // ============================================
            // РАСЧЕТ ПОЗИЦИИ ПРИ ПОДКЛЮЧЕНИИ СВЕРХУ (TOP)
            // ============================================
            
            if (chainLength === 1) {
                // Случай 1: Один блок
                // blockType содержит тип блока: 'default-block', 'c-block', 'start-block', 'stop-block', 'round-block', 'sharp-block'
                
                if (blockType === 'default-block') {
                    // TODO: Добавить формулу для одного default-block
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                } else if (blockType === 'c-block') {
                    // TODO: Добавить формулу для одного c-block
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                } else if (blockType === 'start-block') {
                    // TODO: Добавить формулу для одного start-block
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                } else if (blockType === 'stop-block') {
                    // TODO: Добавить формулу для одного stop-block
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                } else if (blockType === 'round-block') {
                    // TODO: Добавить формулу для одного round-block
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                } else if (blockType === 'sharp-block') {
                    // TODO: Добавить формулу для одного sharp-block
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                } else {
                    // Неизвестный тип блока
                    return null;
                }
            } else {
                // Случай 2: Цепь блоков
                // chainLength содержит количество блоков в цепи
                // draggedChain содержит массив всех блоков цепи
                
                const firstBlockType = draggedChain[0].dataset.type;
                const isHomogeneousChain = draggedChain.every(block => block.dataset.type === firstBlockType);
                
                if (isHomogeneousChain) {
                    // Однородная цепь (все блоки одного типа)
                    // firstBlockType содержит тип всех блоков в цепи
                    // chainLength содержит количество блоков
                    
                    if (firstBlockType === 'default-block') {
                        // TODO: Добавить формулу для однородной цепи default-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                    } else if (firstBlockType === 'c-block') {
                        // TODO: Добавить формулу для однородной цепи c-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                    } else if (firstBlockType === 'start-block') {
                        // TODO: Добавить формулу для однородной цепи start-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                    } else if (firstBlockType === 'stop-block') {
                        // TODO: Добавить формулу для однородной цепи stop-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                    } else if (firstBlockType === 'round-block') {
                        // TODO: Добавить формулу для однородной цепи round-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                    } else if (firstBlockType === 'sharp-block') {
                        // TODO: Добавить формулу для однородной цепи sharp-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                    } else {
                        // Неизвестный тип однородной цепи
                        return null;
                    }
                } else {
                    // Неоднородная цепь (блоки разных типов)
                    // draggedChain содержит массив всех блоков цепи
                    // chainLength содержит количество блоков
                    
                    // TODO: Добавить формулу для неоднородной цепи
                    finalY = targetTransform.y + CONNECTOR_OFFSETS.TOP_Y + CONNECTOR_THRESHOLD / 2 - (draggedBlockHeight - CONNECTOR_SOCKET_HEIGHT);
                }
            }
        } else if (connectorType === ConnectorType.BOTTOM) {
            const targetBlockHeight = getBlockPathHeight(targetBlock);
            
            // ============================================
            // РАСЧЕТ ПОЗИЦИИ ПРИ ПОДКЛЮЧЕНИИ СНИЗУ (BOTTOM)
            // ============================================
            
            if (chainLength === 1) {
                // Случай 1: Один блок
                // blockType содержит тип блока
                
                if (blockType === 'default-block') {
                    // TODO: Добавить формулу для одного default-block
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                } else if (blockType === 'c-block') {
                    // TODO: Добавить формулу для одного c-block
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                } else if (blockType === 'start-block') {
                    // TODO: Добавить формулу для одного start-block
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                } else if (blockType === 'stop-block') {
                    // TODO: Добавить формулу для одного stop-block
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                } else if (blockType === 'round-block') {
                    // TODO: Добавить формулу для одного round-block
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                } else if (blockType === 'sharp-block') {
                    // TODO: Добавить формулу для одного sharp-block
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                } else {
                    // Неизвестный тип блока
                    return null;
                }
            } else {
                // Случай 2: Цепь блоков
                // chainLength содержит количество блоков в цепи
                // draggedChain содержит массив всех блоков цепи
                
                const firstBlockType = draggedChain[0].dataset.type;
                const isHomogeneousChain = draggedChain.every(block => block.dataset.type === firstBlockType);
                
                if (isHomogeneousChain) {
                    // Однородная цепь (все блоки одного типа)
                    // firstBlockType содержит тип всех блоков в цепи
                    // chainLength содержит количество блоков
                    
                    if (firstBlockType === 'default-block') {
                        // TODO: Добавить формулу для однородной цепи default-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                    } else if (firstBlockType === 'c-block') {
                        // TODO: Добавить формулу для однородной цепи c-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                    } else if (firstBlockType === 'start-block') {
                        // TODO: Добавить формулу для однородной цепи start-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                    } else if (firstBlockType === 'stop-block') {
                        // TODO: Добавить формулу для однородной цепи stop-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                    } else if (firstBlockType === 'round-block') {
                        // TODO: Добавить формулу для однородной цепи round-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                    } else if (firstBlockType === 'sharp-block') {
                        // TODO: Добавить формулу для однородной цепи sharp-block
                        // chainLength содержит количество блоков
                        finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                    } else {
                        // Неизвестный тип однородной цепи
                        return null;
                    }
                } else {
                    // Неоднородная цепь (блоки разных типов)
                    // draggedChain содержит массив всех блоков цепи
                    // chainLength содержит количество блоков
                    
                    // TODO: Добавить формулу для неоднородной цепи
                    finalY = targetTransform.y + targetBlockHeight - CONNECTOR_SOCKET_HEIGHT + CONNECTOR_OFFSETS.BOTTOM_Y - CONNECTOR_THRESHOLD / 2;
                }
            }
        } else {
            return null;
        }

        return { x: finalX, y: finalY };
    }
}

