const vscode = require('vscode');
const { BaseItem } = require('./base-item');
const { TYPE_FILE } = require('../constants');

class FileFavorite extends BaseItem {
  constructor(label = '', resourcePath = '', dynamic = false) {
    super(label);
    this.type = TYPE_FILE;
    this.resourcePath = resourcePath;
    this.dynamic = dynamic;
  }

  get resourceUri() {
    return vscode.Uri.file(this.resourcePath);
  }

  async exists() {
    try {
      const stat = await vscode.workspace.fs.stat(this.resourceUri);
      return Boolean(stat.type & vscode.FileType.File);
    } catch (err) {
      return false;
    }
  }

  toJSON() {
    return {
      type: TYPE_FILE,
      label: this.label,
      resourcePath: this.resourcePath,
    };
  }

  async activate() {
    if (!await this.exists()) {
      return vscode.window.showWarningMessage(`File not found: ${this.resourcePath}`);
    }

    return vscode.commands.executeCommand('vscode.open', this.resourceUri);
  }

  location() {
    return [this.resourceUri];
  }

  async toTreeItem() {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.None);
    item.label = this.label;
    item.resourceUri = this.resourceUri;
    item.iconPath = vscode.ThemeIcon.File;
    item.tooltip = this.resourcePath;

    const exists = await this.exists();
    if (!exists) {
      item.description = '· Missing';
      item.contextValue = this.dynamic ? 'browse-file-missing' : 'favorite-missing';
      item.tooltip = `${this.resourcePath}\n\nThis file could not be found.`;
    } else {
      item.contextValue = this.dynamic ? 'browse-file' : 'favorite';
    }

    item.command = {
      command: 'favFolderTree.context.openResource',
      arguments: [this],
      title: 'Open Favorite',
    };
    return item;
  }
}

module.exports = {
  FileFavorite,
};
