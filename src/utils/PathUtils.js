/**
 * PathUtils - утилиты для работы с SVG path
 */
class PathUtils {
    /**
     * Парсит SVG path и возвращает массив команд
     */
    static parsePath(pathString) {
      const commands = [];
      const regex = /([a-zA-Z])([^a-zA-Z]*)/g;
      let match;
  
      while ((match = regex.exec(pathString)) !== null) {
        const command = match[1];
        const args = match[2].trim().split(/[\s,]+/).filter(s => s.length > 0).map(parseFloat);
        commands.push({ command, args });
      }
  
      return commands;
    }
  
    /**
     * Преобразует массив команд обратно в строку path
     */
    static commandsToPath(commands) {
      return commands.map(cmd => {
        if (cmd.args.length === 0) {
          return cmd.command;
        }
        return `${cmd.command}${cmd.args.join(',')}`;
      }).join(' ');
    }
  
    /**
     * Находит все команды определенного типа (например, 'h' или 'v')
     */
    static findCommandsByType(commands, type) {
      const results = [];
      commands.forEach((cmd, index) => {
        if (cmd.command.toLowerCase() === type.toLowerCase()) {
          results.push({ index, command: cmd });
        }
      });
      return results;
    }
  
    /**
     * Изменяет размеры блока в path
     * @param {string} pathString - исходный path
     * @param {Object} config - конфигурация изменений
     * @param {number} config.horizontal - смещение по горизонтали (по умолчанию 0)
     * @param {number} config.vertical - смещение по вертикали (по умолчанию 0)
     * @param {Array<number>} config.hIndices - индексы команд 'h' для изменения
     * @param {Array<number>} config.vIndices - индексы команд 'v' для изменения
     * @returns {string} измененный path
     */
    static resizeBlockPath(pathString, config = {}) {
    const {
      horizontal = 0,
      vertical = 0,
      hIndices = [],
      vIndices = []
    } = config;
  
      // Если нет изменений, возвращаем исходный path
      if (horizontal === 0 && vertical === 0) {
        return pathString;
      }
  
      const commands = this.parsePath(pathString);
  
      // Находим все команды 'h' и 'v'
      const hCommands = this.findCommandsByType(commands, 'h');
      const vCommands = this.findCommandsByType(commands, 'v');
  
      // Изменяем указанные команды 'h'
    const adjustValue = (value, delta) => {
      if (delta === 0) {
        return value;
      }
      const sign = Math.sign(value) === 0 ? Math.sign(delta) || 1 : Math.sign(value);
      const magnitude = Math.max(0, Math.abs(value) + delta);
      return sign * magnitude;
    };

    if (horizontal !== 0 && hIndices.length > 0) {
        hIndices.forEach(hIndex => {
          if (hIndex < hCommands.length) {
            const cmdInfo = hCommands[hIndex];
            const cmd = commands[cmdInfo.index];
            if (cmd.args.length > 0) {
            cmd.args[0] = adjustValue(cmd.args[0], horizontal);
            }
          }
        });
      }
  
      // Изменяем указанные команды 'v'
      if (vertical !== 0 && vIndices.length > 0) {
        vIndices.forEach(vIndex => {
          if (vIndex < vCommands.length) {
            const cmdInfo = vCommands[vIndex];
            const cmd = commands[cmdInfo.index];
            if (cmd.args.length > 0) {
            cmd.args[0] = adjustValue(cmd.args[0], vertical);
            }
          }
        });
      }
  
      return this.commandsToPath(commands);
    }
  
    /**
     * Получает конфигурацию индексов для различных типов блоков
     */
    static getBlockResizeConfig(blockType) {
      const configs = {
        'start-block': {
          hIndices: [0, 1]
        },
        'c-block': {
          hIndices: [2, 3, 8, 10],
          vIndices: [1, 3] // Только c-block имеет вертикальные изменения
        },
        'default-block': {
          hIndices: [2, 3]
        },
        'stop-block': {
          hIndices: [2, 3]
        },
        'round-block': {
          hIndices: [0, 1]
        },
        'sharp-block': {
          hIndices: [0, 1]
        }
      };
  
      return configs[blockType] || configs['default'];
    }
  
    /**
     * Применяет изменение размера к блоку
     * @param {SVGElement} block - SVG элемент блока
     * @param {number} horizontal - изменение по горизонтали (добавляется к текущему размеру)
     * @param {number} vertical - изменение по вертикали (добавляется к текущему размеру)
     */
    static applyResizeToBlock(block, horizontal = 0, vertical = 0) {
      const path = block.querySelector('path');
      if (!path) {
        console.warn('[PathUtils] Path element not found in block');
        return;
      }
  
      const blockType = block.getAttribute('data-block-type') || 'default';
      const config = this.getBlockResizeConfig(blockType);
  
      const currentPath = path.getAttribute('d');
      const newPath = this.resizeBlockPath(currentPath, {
        horizontal,
        vertical,
        hIndices: config.hIndices,
        vIndices: config.vIndices
      });
  
      path.setAttribute('d', newPath);
  
      // Обновляем атрибуты width и height блока
      if (horizontal !== 0) {
        const currentWidth = parseFloat(block.getAttribute('width')) || 0;
        block.setAttribute('width', currentWidth + horizontal);
      }
  
      if (vertical !== 0) {
        const currentHeight = parseFloat(block.getAttribute('height')) || 0;
        block.setAttribute('height', currentHeight + vertical);
      }
    }
  
    /**
     * Устанавливает точные размеры блока
     * @param {SVGElement} block - SVG элемент блока
     * @param {number} targetWidth - целевая ширина блока
     * @param {number} targetHeight - целевая высота блока
     */
    static setBlockSize(block, targetWidth, targetHeight) {
      const path = block.querySelector('path');
      if (!path) {
        console.warn('[PathUtils] Path element not found in block');
        return;
      }
  
      const currentWidth = parseFloat(block.getAttribute('width')) || 0;
      const currentHeight = parseFloat(block.getAttribute('height')) || 0;
  
      const horizontalChange = targetWidth - currentWidth;
      const verticalChange = targetHeight - currentHeight;
  
      const blockType = block.getAttribute('data-block-type') || 'default';
      const config = this.getBlockResizeConfig(blockType);
  
      const currentPath = path.getAttribute('d');
      const newPath = this.resizeBlockPath(currentPath, {
        horizontal: horizontalChange,
        vertical: verticalChange,
        hIndices: config.hIndices,
        vIndices: config.vIndices
      });
  
      path.setAttribute('d', newPath);
      block.setAttribute('width', targetWidth);
      block.setAttribute('height', targetHeight);
    }
  }
  
  export default PathUtils;