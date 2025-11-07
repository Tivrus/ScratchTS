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

function createLabels(labels = []) {
    return labels.map((label) => {
        const textElement = createSVGElement('text');
        textElement.textContent = label.text ?? '';
        textElement.setAttribute('x', label.pos?.[0] ?? 0);
        textElement.setAttribute('y', label.pos?.[1] ?? 0);
        textElement.setAttribute('fill', '#ffffff');
        textElement.setAttribute('font-size', 14);
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('text-anchor', 'start');
        textElement.classList.add('block-label');
        return textElement;
    });
}

export function createBlockTemplate(blockConfig, { color } = {}) {
    if (!blockConfig) {
        return null;
    }

    const { id, type, labels, size } = blockConfig;
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

    const template = document.createElement('div');
    template.classList.add('block-template');
    template.dataset.id = id;
    template.dataset.type = type;
    if (typeof adjustedForm.width === 'number') {
        template.style.width = `${adjustedForm.width}px`;
    }
    if (typeof adjustedForm.height === 'number') {
        template.style.height = `${adjustedForm.height}px`;
    }

    const svg = createSVGElement('svg');
    svg.classList.add('block-svg');
    applySize(svg, adjustedForm);

    const pathElement = createSVGElement('path');
    pathElement.setAttribute('d', pathData);
    pathElement.setAttribute('fill', color ?? DEFAULT_BLOCK_COLOR);


    svg.appendChild(pathElement);

    createLabels(labels).forEach((labelElement) => {
        svg.appendChild(labelElement);
    });

    template.appendChild(svg);

    return template;
}

