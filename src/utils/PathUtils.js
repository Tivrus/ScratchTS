class PathUtils {
  static parsePath(pathString) {
      const commands = [];
      const regex = /([a-zA-Z])([^a-zA-Z]*)/g;
      let match;

      while ((match = regex.exec(pathString)) !== null) {
          const command = match[1];
          const args = match[2]
              .trim()
              .split(/[\s,]+/)
              .filter(s => s.length > 0)
              .map(parseFloat);
          commands.push({ command, args });
      }

      return commands;
  }

  static commandsToPath(commands) {
      return commands
          .map(cmd => cmd.args.length === 0 ? cmd.command : `${cmd.command}${cmd.args.join(',')}`)
          .join(' ');
  }

  static findCommandsByType(commands, type) {
      const results = [];
      commands.forEach((cmd, index) => {
          if (cmd.command.toLowerCase() === type.toLowerCase()) {
              results.push({ index, command: cmd });
          }
      });
      return results;
  }

  static resizeBlockPath(pathString, config = {}) {
      const { horizontal = 0, vertical = 0, hIndices = [], vIndices = [] } = config;

      if (horizontal === 0 && vertical === 0) {
          return pathString;
      }

      const commands = this.parsePath(pathString);
      const hCommands = this.findCommandsByType(commands, 'h');
      const vCommands = this.findCommandsByType(commands, 'v');

      const adjustValue = (value, delta) => {
          if (delta === 0) return value;
          const sign = Math.sign(value) === 0 ? Math.sign(delta) || 1 : Math.sign(value);
          const magnitude = Math.max(0, Math.abs(value) + delta);
          return sign * magnitude;
      };

      if (horizontal !== 0 && hIndices.length > 0) {
          hIndices.forEach(hIndex => {
              if (hIndex < hCommands.length) {
                  const cmd = commands[hCommands[hIndex].index];
                  if (cmd.args.length > 0) {
                      cmd.args[0] = adjustValue(cmd.args[0], horizontal);
                  }
              }
          });
      }

      if (vertical !== 0 && vIndices.length > 0) {
          vIndices.forEach(vIndex => {
              if (vIndex < vCommands.length) {
                  const cmd = commands[vCommands[vIndex].index];
                  if (cmd.args.length > 0) {
                      cmd.args[0] = adjustValue(cmd.args[0], vertical);
                  }
              }
          });
      }

      return this.commandsToPath(commands);
  }

  static getBlockResizeConfig(blockType) {
      const configs = {
          'start-block': { hIndices: [0, 1] },
          'c-block': { hIndices: [2, 3, 8, 10], vIndices: [1, 3] },
          'default-block': { hIndices: [2, 3] },
          'stop-block': { hIndices: [2, 3] },
          'round-block': { hIndices: [0, 1] },
          'sharp-block': { hIndices: [0, 1] }
      };

      return configs[blockType] || configs['default'];
  }

  static applyResizeToBlock(block, horizontal = 0, vertical = 0) {
      const path = block.querySelector('path');
      const blockType = block.getAttribute('data-block-type') || 'default';
      const config = this.getBlockResizeConfig(blockType);

      const currentPath = path.getAttribute('d');
      const newPath = this.resizeBlockPath(currentPath, { horizontal, vertical, ...config });

      path.setAttribute('d', newPath);

      if (horizontal !== 0) {
          const currentWidth = parseFloat(block.getAttribute('width')) || 0;
          block.setAttribute('width', currentWidth + horizontal);
      }

      if (vertical !== 0) {
          const currentHeight = parseFloat(block.getAttribute('height')) || 0;
          block.setAttribute('height', currentHeight + vertical);
      }
  }

  static setBlockSize(block, targetWidth, targetHeight) {
      const path = block.querySelector('path');
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
          ...config
      });

      path.setAttribute('d', newPath);
      block.setAttribute('width', targetWidth);
      block.setAttribute('height', targetHeight);
  }
}

export default PathUtils;