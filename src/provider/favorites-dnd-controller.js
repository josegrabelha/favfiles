const vscode = require('vscode');

const FAVORITES_TREE_MIME = 'application/vnd.code.tree.fav-folder-tree-favorites';

class FavoritesDragAndDropController {
  constructor(controller) {
    this._controller = controller;
    this.dragMimeTypes = [FAVORITES_TREE_MIME];
    this.dropMimeTypes = [FAVORITES_TREE_MIME];
  }

  async handleDrag(source, dataTransfer) {
    const deniedItem = source.find(item => !this._controller.isTreeDragEnabled(item));
    if (deniedItem) {
      const message = this._controller.getTreeDragDenialReason(deniedItem);
      if (message) {
        vscode.window.showWarningMessage(message);
      }
      return;
    }

    const items = source.filter(item => this._controller.isTreeDragEnabled(item));
    if (!items.length) {
      return;
    }

    dataTransfer.set(FAVORITES_TREE_MIME, new vscode.DataTransferItem(items));
  }

  async handleDrop(target, dataTransfer) {
    const transferItem = dataTransfer.get(FAVORITES_TREE_MIME);
    const items = transferItem && transferItem.value;
    if (!Array.isArray(items) || !items.length) {
      return;
    }

    let firstMessage;
    let moved = 0;

    for (const item of items) {
      const result = await this._controller.handleTreeDrop(item, target);
      if (result && result.allowed) {
        moved += 1;
      } else if (!firstMessage && result && result.message) {
        firstMessage = result.message;
      }
    }

    if (!moved && firstMessage) {
      vscode.window.showWarningMessage(firstMessage);
    }
  }
}

module.exports = {
  FavoritesDragAndDropController,
};
