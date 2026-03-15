const vscode = require('vscode');
const { GroupItem, isGroup, FolderFavorite, itemSort } = require('../models');

class FavoritesProvider {
  constructor(store) {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._store = store;
  }

  refresh(item) {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(item) {
    return item.toTreeItem();
  }

  getParent(item) {
    return item.parent;
  }

  getChildren(item) {
    if (!item) {
      return this._store.root();
    }

    if (isGroup(item)) {
      return item.children.sort(itemSort);
    }

    if (item instanceof FolderFavorite) {
      return item.getChildren();
    }

    return undefined;
  }
}

module.exports = {
  FavoritesProvider,
};
