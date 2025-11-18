import { categories } from '../data/CategoriesData.js';

export class CategoryList {
    constructor(containerId, { onCategoryChange } = {}) {
        this.container = document.getElementById(containerId);
        
        this.activeCategory = null;
        this.onCategoryChange = typeof onCategoryChange === 'function' ? onCategoryChange : null;
        this.renderCategories();
        this.selectDefaultCategory();
    }

    renderCategories() {
        this.container.innerHTML = '';
        categories.forEach((category) => {
            const categoryItem = document.createElement('div');
            categoryItem.classList.add('category-item');
            categoryItem.dataset.id = category.id;

            const categoryColor = document.createElement('div');
            categoryColor.classList.add('category-color');
            categoryColor.style.backgroundColor = category.color;

            const categoryLabel = document.createElement('div');
            categoryLabel.classList.add('category-label');
            categoryLabel.textContent = category.text;

            categoryItem.appendChild(categoryColor);
            categoryItem.appendChild(categoryLabel);

            categoryItem.addEventListener('click', () => this.selectCategory(category.id));
            this.container.appendChild(categoryItem);
        });
    }

    selectDefaultCategory(){this.selectCategory(categories[0].id)}

    selectCategory(categoryId) {
        if (this.activeCategory === categoryId || !this.container) {
            return;
        }

        const previouslyActive = this.container.querySelector('.category-item--active');
        if (previouslyActive) {
            previouslyActive.classList.remove('category-item--active');
        }

        const selectedCategory = this.container.querySelector(`[data-id="${categoryId}"]`);
        selectedCategory.classList.add('category-item--active');
        this.activeCategory = categoryId;

        this.onCategoryChange(categoryId);
    }

    setOnCategoryChange(handler) {
        this.onCategoryChange = handler;

        if (this.activeCategory && this.onCategoryChange) {
            this.onCategoryChange(this.activeCategory);
        }
    }
}

export function initializeCategories(options = {}) {
    return new CategoryList('category-list', options);
}