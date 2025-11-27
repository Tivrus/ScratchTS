import { BLOCK_FORMS, DEFAULT_BLOCK_COLOR, SVG_NS } from '../utils/Constants.js';
import PathUtils from '../utils/PathUtils.js';

function createSVGElement(tag) {
    return document.createElementNS(SVG_NS, tag);
}

// Генерация instanceId в формате base64-подобной строки (20 символов)
function generateInstanceId() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/%+';
    const bytes = new Uint8Array(15);
    
    if (crypto && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        // Fallback для старых браузеров
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        result += alphabet[bytes[i] % alphabet.length];}
    while (result.length < 20) {
        const randomIndex = Math.floor(Math.random() * alphabet.length);
        result += alphabet[randomIndex];}
    return result.substring(0, 20);
}

// Функция для затемнения цвета
function darkenColor(color, factor = 0.7) {
    if (!color || typeof color !== 'string') {
        return 'rgba(0,0,0,0.7)';}

    const hex = color.replace('#', '');
    if (hex.length !== 6) {
        return 'rgba(0,0,0,0.7)';}

    const r = Math.floor(parseInt(hex.substring(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substring(2, 4), 16) * factor);
    const b = Math.floor(parseInt(hex.substring(4, 6), 16) * factor);
    return `rgb(${r},${g},${b})`;
}

// Функция для создания текстовых элементов (label)
function createLabels(labels = []) {
    return labels.map((label) => {
        const textElement = createSVGElement('text');
        textElement.textContent = label.text ?? '';
        textElement.setAttribute('x', label.pos?.[0] ?? 0);
        textElement.setAttribute('y', label.pos?.[1] ?? 0);
        textElement.setAttribute('fill', '#ffffff');
        textElement.setAttribute('font-size', 14);
        textElement.setAttribute('font-weight', 600);
        textElement.setAttribute('font-family', 'Arial, sans-serif');
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('text-anchor', 'start');
        textElement.classList.add('block-label');
        return textElement;
    });
}

function createBlockSVGContent(blockConfig, { color } = {}) {
    const { type, labels, size } = blockConfig;
    const form = BLOCK_FORMS[type];
    if (!form) {
        console.warn(`BlockFactory: form for type "${type}" is not defined.`);
        return null}

    const adjustedForm = { ...form };
    let pathData = form.path;

    if (Array.isArray(size) && size.length >= 2) {
        const [sign, amountRaw] = size;
        const amount = Number(amountRaw);
        if (amount !== 0 && (sign === '+' || sign === '-')) {
            const delta = sign === '-' ? -amount : amount;
            const resizeConfig = PathUtils.getBlockResizeConfig(type);
            const hIndices = resizeConfig.hIndices;

            pathData = PathUtils.resizeBlockPath(pathData, {
                horizontal: delta,
                hIndices});
            
            adjustedForm.width += delta;
            const viewBoxParts = adjustedForm.viewBox.split(/\s+/).map(Number);
            viewBoxParts[2] += delta;
            adjustedForm.viewBox = viewBoxParts.join(' ');
        }
    }

    const fillColor = color ?? DEFAULT_BLOCK_COLOR;
    const strokeColor = darkenColor(fillColor);

    const pathElement = createSVGElement('path');
    pathElement.setAttribute('d', pathData);
    pathElement.setAttribute('fill', fillColor);
    pathElement.setAttribute('stroke', strokeColor);
    pathElement.setAttribute('stroke-width', '2');
    pathElement.setAttribute('stroke-linejoin', 'round');

    const labelElements = createLabels(labels);

    return {
        pathElement,
        labelElements,
        width: adjustedForm.width,
        height: adjustedForm.height,
        viewBox: adjustedForm.viewBox
    };
}

export function createBlockTemplate(blockConfig, { color } = {}) {
    const { id, type } = blockConfig;
    const svgContent = createBlockSVGContent(blockConfig, { color });

    const {pathElement, labelElements, width, height, viewBox } = svgContent;

    const template = document.createElement('div');
    template.classList.add('block-template');
    template.dataset.id = id;
    template.dataset.type = type;
    template.dataset.color = color ?? DEFAULT_BLOCK_COLOR;
    template._blockConfig = blockConfig;

    template.style.width = `${width}px`;
    template.style.height = `${height}px`;

    const svg = createSVGElement('svg');
    svg.classList.add('block-svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    svg.appendChild(pathElement);
    labelElements.forEach((label) => svg.appendChild(label));

    template.appendChild(svg);
    return template;
}

export function createWorkspaceBlock(blockConfig, { color, x = 0, y = 0 } = {}) {
    const { id, type } = blockConfig;
    const svgContent = createBlockSVGContent(blockConfig, { color });

    const {pathElement, labelElements, width, height } = svgContent;

    const group = createSVGElement('g');
    group.classList.add('workspace-block');
    group.dataset.id = id;
    group.dataset.type = type;
    group.dataset.color = color ?? DEFAULT_BLOCK_COLOR;
    group.dataset.width = String(width);
    group.dataset.height = String(height);
    group.dataset.instanceId = generateInstanceId();
    group.setAttribute('transform', `translate(${x}, ${y})`);
    group._blockConfig = blockConfig;

    group.appendChild(pathElement);
    labelElements.forEach((label) => group.appendChild(label));

    return group;
}

