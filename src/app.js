import { initializeCategories } from './categories/CategoryList.js';
import { initializeBlockLibrary } from './blocks/BlockLibrary.js';

document.addEventListener('DOMContentLoaded', () => {
    const blockLibrary = initializeBlockLibrary();

    initializeCategories({
        onCategoryChange: (categoryId) => {
            blockLibrary.loadBlocksForCategory(categoryId);
        }
    });
});