const vscode = require('vscode');

const FAVORITES_TREE_MIME = 'application/vnd.code.tree.fav-folder-tree-favorites';
const EXPLORER_TREE_MIME = 'application/vnd.code.tree.explorer';
const URI_LIST_MIME = 'text/uri-list';

class FavoritesDragAndDropController {
  constructor(controller) {
    this._controller = controller;
    this.dragMimeTypes = [FAVORITES_TREE_MIME];
    this.dropMimeTypes = [FAVORITES_TREE_MIME, EXPLORER_TREE_MIME, URI_LIST_MIME];
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
    // 1) internal tree drag (reorder / move within FavFiles)
    const internal = dataTransfer.get(FAVORITES_TREE_MIME);
    if (internal && Array.isArray(internal.value) && internal.value.length) {
      let firstMessage;
      let moved = 0;

      for (const item of internal.value) {
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
      return;
    }

    // 2) external drop: file from Explorer, or tab dragged from the editor
    const fsPaths = await this.extractExternalPaths(dataTransfer);
    if (fsPaths.length) {
      await this._controller.dropExternalFiles(target, fsPaths);
    }
  }

  async extractExternalPaths(dataTransfer) {
    const paths = [];

    const explorerItem = dataTransfer.get(EXPLORER_TREE_MIME);
    if (explorerItem) {
      try {
        const parsed = JSON.parse(await explorerItem.asString());
        const resources = parsed && parsed.resources;
        if (Array.isArray(resources)) {
          for (const resource of resources) {
            const fsPath = this.toFsPath(resource);
            if (fsPath) {
              paths.push(fsPath);
            }
          }
        }
      } catch (err) {
        // ignore malformed payloads
      }
    }

    if (!paths.length) {
      const uriListItem = dataTransfer.get(URI_LIST_MIME);
      if (uriListItem) {
        try {
          const raw = await uriListItem.asString();
          for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
              continue;
            }
            const fsPath = this.toFsPath(trimmed);
            if (fsPath) {
              paths.push(fsPath);
            }
          }
        } catch (err) {
          // ignore malformed payloads
        }
      }
    }

    return paths;
  }

  toFsPath(value) {
    if (!value) {
      return undefined;
    }
    if (typeof value === 'string') {
      if (value.includes('://')) {
        try {
          const uri = vscode.Uri.parse(value);
          return uri.scheme === 'file' ? uri.fsPath : undefined;
        } catch (err) {
          return undefined;
        }
      }
      return value;
    }
    if (value.fsPath) {
      return value.fsPath;
    }
    return undefined;
  }
}

module.exports = {
  FavoritesDragAndDropController,
};
