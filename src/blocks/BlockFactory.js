import { BLOCK_FORMS, DEFAULT_BLOCK_COLOR } from '../utils/Constants.js';
import PathUtils from '../utils/PathUtils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSVGElement(tag) {
    return document.createElementNS(SVG_NS, tag);
}

function applySize(svg, { width, height, viewBox }) {
    if (viewBox) {
        svg.setAttribute('viewBox', viewBox);
    }

    if (typeof width === 'number') {
        svg.setAttribute('width', String(width));
    }

    if (typeof height === 'number') {
        svg.setAttribute('height', String(height));
    }
}

function darkenColor(color, factor = 0.7) {
    if (!color || typeof color !== 'string') {
        return 'rgba(0,0,0,0.7)';
    }

    const hex = color.replace('#', '');
    if (hex.length !== 6) {
        return 'rgba(0,0,0,0.7)';
    }

    const r = Math.floor(parseInt(hex.substring(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substring(2, 4), 16) * factor);
    const b = Math.floor(parseInt(hex.substring(4, 6), 16) * factor);

    return `rgb(${r},${g},${b})`;
}

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
    if (!blockConfig) {
        return null;
    }

    const { type, labels, size } = blockConfig;
    const form = BLOCK_FORMS[type];

    if (!form) {
        console.warn(`BlockFactory: form for type "${type}" is not defined.`);
        return null;
    }

    const adjustedForm = { ...form };
    let pathData = form.path;

    if (Array.isArray(size) && size.length >= 2) {
        const [sign, amountRaw] = size;
        const amount = Number(amountRaw);
        if (!Number.isNaN(amount) && amount !== 0 && (sign === '+' || sign === '-')) {
            const delta = sign === '-' ? -amount : amount;
            const resizeConfig = PathUtils.getBlockResizeConfig(type) ?? {};
            const hIndices = resizeConfig.hIndices ?? [];
            const vIndices = resizeConfig.vIndices ?? [];

            if (hIndices.length || vIndices.length) {
                pathData = PathUtils.resizeBlockPath(pathData, {
                    horizontal: hIndices.length ? delta : 0,
                    vertical: vIndices.length ? delta : 0,
                    hIndices,
                    vIndices
                });
            }

            if (typeof adjustedForm.width === 'number') {
                adjustedForm.width += delta;
            }

            if (typeof adjustedForm.viewBox === 'string') {
                const viewBoxParts = adjustedForm.viewBox.split(/\s+/).map(Number);
                if (viewBoxParts.length === 4 && viewBoxParts.every((value) => !Number.isNaN(value))) {
                    viewBoxParts[2] += delta;
                    adjustedForm.viewBox = viewBoxParts.join(' ');
                }
            }
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
    if (!blockConfig) {
        return null;
    }

    const { id, type } = blockConfig;
    const svgContent = createBlockSVGContent(blockConfig, { color });

    if (!svgContent) {
        return null;
    }

    const { pathElement, labelElements, width, height, viewBox } = svgContent;

    const template = document.createElement('div');
    template.classList.add('block-template');
    template.dataset.id = id;
    template.dataset.type = type;
    template.dataset.color = color ?? DEFAULT_BLOCK_COLOR;
    template._blockConfig = blockConfig;

    if (typeof width === 'number') {
        template.style.width = `${width}px`;
    }
    if (typeof height === 'number') {
        template.style.height = `${height}px`;
    }

    const svg = createSVGElement('svg');
    svg.classList.add('block-svg');
    if (viewBox) {
        svg.setAttribute('viewBox', viewBox);
    }
    if (typeof width === 'number') {
        svg.setAttribute('width', String(width));
    }
    if (typeof height === 'number') {
        svg.setAttribute('height', String(height));
    }

    svg.appendChild(pathElement);
    labelElements.forEach((label) => svg.appendChild(label));

    template.appendChild(svg);

    return template;
}

export function createWorkspaceBlock(blockConfig, { color, x = 0, y = 0 } = {}) {
    if (!blockConfig) {
        return null;
    }

    const { id, type } = blockConfig;
    const svgContent = createBlockSVGContent(blockConfig, { color });

    if (!svgContent) {
        return null;
    }

    const { pathElement, labelElements, width, height } = svgContent;

    const group = createSVGElement('g');
    group.classList.add('workspace-block');
    group.dataset.id = id;
    group.dataset.type = type;
    group.dataset.color = color ?? DEFAULT_BLOCK_COLOR;
    group.dataset.width = String(width);
    group.dataset.height = String(height);
    group.dataset.instanceId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    group.setAttribute('transform', `translate(${x}, ${y})`);
    group._blockConfig = blockConfig;

    group.appendChild(pathElement);
    labelElements.forEach((label) => group.appendChild(label));

    return group;
}

