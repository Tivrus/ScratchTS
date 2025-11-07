import { initializeCategories } from './categories/CategoryList.js';
import { initializeBlockLibrary } from './blocks/BlockLibrary.js';
import { initializeDragAndDrop } from './ui/DragAndDrop.js';

document.addEventListener('DOMContentLoaded', () => {
    const blockLibrary = initializeBlockLibrary();

    initializeCategories({
        onCategoryChange: (categoryId) => {
            blockLibrary.loadBlocksForCategory(categoryId);
        }
    });

    initializeDragAndDrop();
});