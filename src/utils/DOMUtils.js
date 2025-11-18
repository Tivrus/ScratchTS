/**
 * DOMUtils - общие утилиты для работы с DOM
 */

/**
 * Получить значения translate из transform атрибута
 * @param {string} transformAttr - Значение атрибута transform
 * @returns {Object} Объект с x и y координатами
 */
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

/**
 * Установить transform translate для элемента
 * @param {SVGElement} element - SVG элемент
 * @param {number} x - X координата
 * @param {number} y - Y координата
 */
export function setTranslate(element, x, y) {
    if (element) {
        element.setAttribute('transform', `translate(${x}, ${y})`);
    }
}

/**
 * Throttle функция для оптимизации производительности
 * @param {Function} func - Функция для throttling
 * @param {number} delay - Задержка в миллисекундах
 * @returns {Function} Throttled функция
 */
export function throttle(func, delay) {
    let lastCall = 0;
    let timeoutId = null;
    
    return function(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;
        
        if (timeSinceLastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
        } else {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                func.apply(this, args);
            }, delay - timeSinceLastCall);
        }
    };
}

/**
 * Debounce функция для оптимизации производительности
 * @param {Function} func - Функция для debouncing
 * @param {number} delay - Задержка в миллисекундах
 * @returns {Function} Debounced функция
 */
export function debounce(func, delay) {
    let timeoutId = null;
    
    return function(...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * RequestAnimationFrame wrapper для плавной анимации
 * @param {Function} callback - Функция для выполнения
 * @returns {number} ID анимации
 */
export function requestAnimFrame(callback) {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        return window.requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16); // ~60fps fallback
}

/**
 * CancelAnimationFrame wrapper
 * @param {number} id - ID анимации
 */
export function cancelAnimFrame(id) {
    if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(id);
    } else {
        clearTimeout(id);
    }
}

