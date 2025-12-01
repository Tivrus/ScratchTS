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

export function setTranslate(element, x, y) {
    if (element) {
        element.setAttribute('transform', `translate(${x}, ${y})`);
    }
}

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

export function requestAnimFrame(callback) {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        return window.requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16); // ~60fps fallback
}

export function cancelAnimFrame(id) {
    if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(id);
    } else {
        clearTimeout(id);
    }
}

/**
 * Получает размеры и позицию элемента с округленными height и width
 * Использует Math.floor для округления height и width, чтобы избежать дробных значений
 * @param {HTMLElement} element - Элемент для получения размеров
 * @returns {DOMRect} Объект с размерами и позицией, аналогичный getBoundingClientRect(), но с округленными height и width
 */
export function getBoundingClientRectRounded(element) {
    const rect = element.getBoundingClientRect();
    const roundedWidth = Math.floor(rect.width || 0);
    const roundedHeight = Math.floor(rect.height || 0);
    
    const result = {
        x: rect.x ?? rect.left ?? 0,
        y: rect.y ?? rect.top ?? 0,
        left: rect.left ?? 0,
        top: rect.top ?? 0,
        right: (rect.left ?? 0) + roundedWidth,
        bottom: (rect.top ?? 0) + roundedHeight,
        width: roundedWidth,
        height: roundedHeight
    };    
    return result;
}

