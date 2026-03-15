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

  toJSON() {
    return {
      type: TYPE_FILE,
      label: this.label,
      resourcePath: this.resourcePath,
    };
  }

  activate() {
    return vscode.commands.executeCommand('vscode.open', this.resourceUri);
  }

  location() {
    return [this.resourceUri];
  }

  toTreeItem() {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.None);
    item.label = this.label;
    item.resourceUri = this.resourceUri;
    item.iconPath = vscode.ThemeIcon.File;
    item.tooltip = this.resourcePath;
    item.contextValue = this.dynamic ? 'browse-file' : 'favorite';
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
