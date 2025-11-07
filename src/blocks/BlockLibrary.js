import { categories } from '../data/CategoriesData.js';
import { blocks } from '../data/BlocksData.js';
import { createBlockTemplate } from './BlockFactory.js';

function findCategory(categoryId) {
    return categories.find((category) => category.id === categoryId) ?? null;
}

export class BlockLibrary {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        if (!this.container) {
            console.warn(`BlockLibrary: container with id "${containerId}" not found.`);
        }
    }

    clear() {
        if (!this.container) {
            return;
        }

        this.container.innerHTML = '';
    }

    loadBlocksForCategory(categoryId) {
        if (!this.container) {
            return;
        }

        this.clear();

        if (!categoryId) {
            return;
        }

        const category = findCategory(categoryId);
        const categoryColor = category?.color;

        blocks
            .filter((block) => block.category === categoryId)
            .forEach((blockConfig) => {
                const template = createBlockTemplate(blockConfig, { color: categoryColor });
                if (template) {
                    this.container.appendChild(template);
                }
            });
    }
}

export function initializeBlockLibrary(containerId = 'block-templates') {
    return new BlockLibrary(containerId);
}

