const vscode = require('vscode');
const path = require('path');
const { VIEW_ID } = require('../constants');
const { currentSortDescription, sortOptionItems } = require('../utils/sort');
const { fileName } = require('../utils/path');
const { GroupItem, FileFavorite, FolderFavorite, isGroup } = require('../models');
const { FavoritesStore } = require('../store/favorites-store');
const { FavoritesProvider } = require('../provider/favorites-provider');
const { FavoritesDragAndDropController } = require('../provider/favorites-dnd-controller');

const ROOT_GROUP = new GroupItem('-- root');

class ExtensionController {
  constructor(context) {
    this._provider = undefined;
    this._store = FavoritesStore.fromContext(context, () => this.refreshView(undefined));
    this._provider = new FavoritesProvider(this._store);
    this._treeView = vscode.window.createTreeView(VIEW_ID, {
      treeDataProvider: this._provider,
      dragAndDropController: new FavoritesDragAndDropController(this),
      canSelectMany: false,
    });

    this.registerCommands(context);

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.uri.fsPath === this._store.storeUri.fsPath) {
          this.reloadFavorites();
        }
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (
          event.affectsConfiguration('favFolderTree.sortMode') ||
          event.affectsConfiguration('favFolderTree.sortDirection')
        ) {
          this.refreshView(undefined);
        }
      })
    );
  }


  refreshView(item) {
    if (this._provider) {
      this._provider.refresh(item);
    }
  }

  getTreeDragDenialReason(item) {
    if (!item) {
      return 'Nothing to drag.';
    }

    if (item instanceof FolderFavorite && (item.dynamic || item.parent instanceof FolderFavorite)) {
      return 'Items inside favorite folders cannot be moved with drag and drop.';
    }

    if (item instanceof FileFavorite && (item.dynamic || item.parent instanceof FolderFavorite)) {
      return 'Items inside favorite folders cannot be moved with drag and drop.';
    }

    if (!isGroup(item) && !(item instanceof FileFavorite) && !(item instanceof FolderFavorite)) {
      return 'This item cannot be moved with drag and drop.';
    }

    return undefined;
  }

  isTreeDragEnabled(item) {
    return !this.getTreeDragDenialReason(item);
  }

  resolveTreeDropContainer(target) {
    if (!target) {
      return { kind: 'root' };
    }

    if (target instanceof FileFavorite || target instanceof FolderFavorite) {
      if (target.dynamic || target.parent instanceof FolderFavorite) {
        return undefined;
      }

      if (isGroup(target.parent)) {
        return { kind: 'group', group: target.parent };
      }

      if (!target.parent) {
        return { kind: 'root' };
      }

      return undefined;
    }

    if (isGroup(target)) {
      return { kind: 'group', group: target };
    }

    return undefined;
  }


  validateTreeDrop(item, target) {
    const dragDenial = this.getTreeDragDenialReason(item);
    if (dragDenial) {
      return { allowed: false, message: dragDenial };
    }

    if (target instanceof FolderFavorite || (target && target.parent instanceof FolderFavorite)) {
      return {
        allowed: false,
        message: 'Drop onto a group or onto the empty area of the view. Favorite folders cannot be used as drag-and-drop targets.',
      };
    }

    const dropContainer = this.resolveTreeDropContainer(target);
    if (!dropContainer) {
      return {
        allowed: false,
        message: 'Drop onto a group or onto the empty area of the view to move the item to the root.',
      };
    }

    if (dropContainer.kind === 'group') {
      const targetGroup = dropContainer.group;
      if (item === targetGroup || this.isSameOrDescendantGroup(item, targetGroup)) {
        return {
          allowed: false,
          message: 'A group cannot be moved into itself or into one of its child groups.',
        };
      }

      if (item.parent === targetGroup) {
        return {
          allowed: false,
          message: `"${item.label}" is already in "${targetGroup.label}".`,
        };
      }
    } else if (!item.parent) {
      return {
        allowed: false,
        message: `"${item.label}" is already in the root.`,
      };
    }

    return { allowed: true, dropContainer };
  }

  isSameOrDescendantGroup(group, targetGroup) {
    if (!isGroup(group) || !isGroup(targetGroup)) {
      return false;
    }

    let current = targetGroup;
    while (current) {
      if (current === group) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  removeTreeItemFromCurrentContainer(item) {
    if (isGroup(item.parent)) {
      item.parent.removeChild(item);
      return;
    }

    const idx = this._store._favorites.indexOf(item);
    if (idx >= 0) {
      this._store._favorites.splice(idx, 1);
    }

    item.parent = undefined;
  }

  async handleTreeDrop(item, target) {
    const validation = this.validateTreeDrop(item, target);
    if (!validation.allowed) {
      return validation;
    }

    const { dropContainer } = validation;

    if (dropContainer.kind === 'group') {
      const targetGroup = dropContainer.group;
      this.removeTreeItemFromCurrentContainer(item);
      targetGroup.addChild(item);
    } else {
      this.removeTreeItemFromCurrentContainer(item);
      this._store._favorites.push(item);
      item.parent = undefined;
    }

    await this._store.update();
    this.refreshView(undefined);
    await this._treeView.reveal(item, { select: true, focus: true });
    return { allowed: true };
  }

  async addToFavorites(uri, kind, toGroup = false) {
    let item;
    switch (kind) {
      case 'folder':
        item = await this.createFolder(uri);
        break;
      default:
        item = await this.createFavorite(uri);
        break;
    }

    if (!item) {
      return;
    }

    if (toGroup) {
      const group = this.normalizeGroupTarget(await this.promptGroupSelection(false));
      if (!group) {
        return;
      }
      group.addChild(item);
      await this._store.update();
      this.refreshView(group);
      this._treeView.reveal(item);
      return;
    }

    await this._store.add(item);
    this.refreshView(undefined);
    this._treeView.reveal(item, { select: true, focus: true });
  }

  async addToTargetGroup(target, kind) {
    const group = this.normalizeGroupTarget(target);
    if (!group) {
      return;
    }

    let item;
    switch (kind) {
      case 'folder':
        item = await this.createFolder(undefined);
        break;
      default:
        item = await this.createFavorite(undefined);
        break;
    }

    if (!item) {
      return;
    }

    group.addChild(item);
    await this._store.update();
    this.refreshView(group);
    this._treeView.reveal(item, { select: true, focus: true });
  }

  async createFavorite(uri) {
    const fsPath = this.selectedElementPath(uri);
    if (!fsPath) {
      return undefined;
    }

    const label = await vscode.window.showInputBox({
      prompt: 'Name of your new favorite (as shown in the FavFiles view)',
      value: fileName(fsPath),
    });

    if (!label) {
      return undefined;
    }

    return new FileFavorite(label, fsPath, false);
  }

  async pickFavoriteFile() {
    const picks = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: 'Please select the file to add to your favorites',
    });

    if (picks && picks[0]) {
      await this.addToFavorites(picks[0], 'file', false);
    }
  }

  async promptFolderFilter(initialValue = '*') {
    return vscode.window.showInputBox({
      prompt: 'File filter for this favorite folder (wildcards supported, e.g. *.pdf; default is *)',
      value: initialValue,
      validateInput: value => {
        if (!value || !value.trim()) {
          return 'Enter a filter pattern such as * or *.pdf';
        }
        return undefined;
      },
    });
  }

  async createFolder(uri) {
    let fsPath = this.selectedElementPath(uri);

    if (!fsPath || !uri) {
      const picks = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        title: 'Please select the folder to add to your favorites',
      });

      if (!picks) {
        return undefined;
      }

      fsPath = picks[0].fsPath;
    }

    const filter = await this.promptFolderFilter('*');

    if (filter === undefined) {
      return undefined;
    }

    const label = await vscode.window.showInputBox({
      prompt: 'Name of your new favorite (as shown in the FavFiles view)',
      value: fileName(fsPath),
    });

    if (!label) {
      return undefined;
    }

    return new FolderFavorite(label, fsPath, false, filter);
  }

  async changeFolderFilter(target) {
    const folder = this.normalizeFolderTarget(target);
    if (!(folder instanceof FolderFavorite) || folder.dynamic) {
      return;
    }

    const filter = await this.promptFolderFilter(folder.filter || '*');
    if (filter === undefined) {
      return;
    }

    folder.filter = filter;
    await this._store.update();
    this.refreshView(folder);
    this._treeView.reveal(folder, { select: true, focus: true, expand: false });
  }

  editFavorites() {
    vscode.window.showTextDocument(this._store.storeUri, { preview: false, preserveFocus: false });
    vscode.window.showWarningMessage(
      'Please be careful when manually editing your favorites, this might prevent the extension from working properly',
      'Understood'
    );
  }

  async reloadFavorites() {
    try {
      await this._store.refresh();
      this.refreshView(undefined);
    } catch (err) {
      vscode.window.showErrorMessage(err.message, 'Ok');
    }
  }

  async openFavorite() {
    const items = this._store.favorites();
    const selected = await vscode.window.showQuickPick(items.map(item => item.quickPick()));
    if (!selected) {
      return;
    }

    const item = selected.item;
    if (item instanceof FileFavorite) {
      item.activate();
    } else if (item instanceof FolderFavorite) {
      await this._treeView.reveal(item, { select: true, focus: true, expand: false });
      vscode.window.showInformationMessage('Favorite folders are browsed from the tree.');
    }
  }

  async openGroup(group) {
    group = this.normalizeGroupTarget(group) ?? group;

    if (!group) {
      group = await this.promptGroupSelection(false);
    }

    if (!isGroup(group)) {
      return;
    }

    await group.activate();
  }

  normalizeGroupTarget(target) {
    if (isGroup(target)) {
      return target;
    }

    if (target && isGroup(target.parent)) {
      return target.parent;
    }

    return undefined;
  }

  normalizeFolderTarget(target) {
    if (target instanceof FolderFavorite) {
      return target;
    }

    if (target && target.parent instanceof FolderFavorite) {
      return target.parent;
    }

    return undefined;
  }

  async openFolder(folder) {
    folder = this.normalizeFolderTarget(folder) ?? folder;

    if (!folder) {
      folder = await this.promptFolderSelection();
    }

    if (!(folder instanceof FolderFavorite)) {
      return;
    }

    await folder.activate();
  }

  async refreshFolder(target) {
    if (!target) {
      this.refreshView(undefined);
      return;
    }

    if (target.parent instanceof FolderFavorite) {
      this.refreshView(target.parent);
      return;
    }

    const folder = this.normalizeFolderTarget(target);
    if (folder instanceof FolderFavorite) {
      this.refreshView(folder);
      return;
    }

    this.refreshView(target);
  }

  async refreshAllFolders() {
    this.refreshView(undefined);
  }

  async createGroup(targetGroup) {
    const label = await vscode.window.showInputBox({
      prompt: 'Name of your new group (as shown in the FavFiles view):',
      value: 'New group',
    });

    if (!label) {
      return;
    }

    const resolvedTargetGroup = this.normalizeGroupTarget(targetGroup);
    const group = new GroupItem(label);

    if (resolvedTargetGroup) {
      resolvedTargetGroup.addChild(group);
      await this._store.update();
    } else {
      await this._store.add(group);
    }

    this.refreshView(undefined);
    this._treeView.reveal(group);
  }

  async removeFavorite(item) {
    if (!item) {
      return;
    }

    const answer = await vscode.window.showWarningMessage(`Remove '${item.label}' from your favorites?`, 'Yes', 'No');
    if (answer === 'Yes') {
      await this._store.delete(item);
      this.refreshView(undefined);
    }
  }

  async openInNewWindow(item) {
    if (!item) {
      return;
    }

    let uri;
    if (item instanceof FolderFavorite) {
      uri = item.resourceUri;
    } else if (item instanceof FileFavorite) {
      uri = vscode.Uri.file(path.dirname(item.resourcePath));
    }

    if (uri) {
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    }
  }

  async moveFavorite(item) {
    if (!item) {
      return;
    }

    const group = this.normalizeGroupTarget(await this.promptGroupSelection(true, item.parent ?? ROOT_GROUP)) ?? ROOT_GROUP;

    if (item.parent) {
      item.parent.removeChild(item);
    } else {
      await this._store.delete(item);
    }

    if (group === ROOT_GROUP) {
      this._store._favorites.push(item);
    } else {
      group.addChild(item);
    }

    await this._store.update();
    this.refreshView(undefined);
    this._treeView.reveal(item);
  }

  async renameFavorite(item) {
    if (!item) {
      return;
    }

    const label = await vscode.window.showInputBox({
      prompt: 'Rename to',
      value: item.label,
    });

    if (!label) {
      return;
    }

    item.label = label;
    await this._store.update();
    this.refreshView(item);
    this._treeView.reveal(item);
  }

  async openResource(item) {
    await item.activate();
  }

  async selectSortMode() {
    const items = sortOptionItems().map(option => ({
      label: option.label,
      description: option.description,
      detail: undefined,
      option,
    }));

    const config = vscode.workspace.getConfiguration('favFolderTree');
    const currentMode = config.get('sortMode', 'foldersAbove');
    const currentDirection = config.get('sortDirection', 'asc');

    items.forEach(item => {
      if (item.option.mode === currentMode && item.option.direction === currentDirection) {
        item.detail = 'Current';
      }
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Sort favorites (${currentSortDescription()})`,
      title: 'Sort favorites',
      matchOnDescription: true,
      ignoreFocusOut: false,
    });

    if (!selected) {
      return;
    }

    await config.update('sortMode', selected.option.mode, vscode.ConfigurationTarget.Global);
    await config.update('sortDirection', selected.option.direction, vscode.ConfigurationTarget.Global);
  }

  registerCommands(context) {
    const reg = (id, fn) => {
      context.subscriptions.push(vscode.commands.registerCommand(id, fn, this));
    };

    reg('favFolderTree.menu.favoriteActiveFile', uri => this.addToFavorites(uri, 'file', false));
    reg('favFolderTree.menu.favoriteActiveFolder', uri => this.addToFavorites(uri, 'folder', false));
    reg('favFolderTree.menu.favoriteActiveFileToGroup', uri => this.addToFavorites(uri, 'file', true));
    reg('favFolderTree.menu.favoriteActiveFolderToGroup', uri => this.addToFavorites(uri, 'folder', true));

    reg('favFolderTree.palette.favoriteFile', this.pickFavoriteFile);
    reg('favFolderTree.palette.favoriteActiveFile', uri => this.addToFavorites(uri, 'file', false));
    reg('favFolderTree.palette.favoriteActiveFileToGroup', uri => this.addToFavorites(uri, 'file', true));
    reg('favFolderTree.palette.favoriteFolder', () => this.addToFavorites(undefined, 'folder', false));

    reg('favFolderTree.view.search', async () => {
      await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
      await vscode.commands.executeCommand('list.find');
      const mode = vscode.workspace.getConfiguration('workbench.list').get('defaultFindMode');
      if (mode !== 'filter') {
        vscode.commands.executeCommand('list.toggleFindMode');
      }
    });

    reg('favFolderTree.palette.edit', this.editFavorites);
    reg('favFolderTree.palette.reload', this.reloadFavorites);
    reg('favFolderTree.palette.openFavorite', this.openFavorite);
    reg('favFolderTree.palette.createGroup', () => this.createGroup(undefined));
    reg('favFolderTree.palette.openGroup', this.openGroup);
    reg('favFolderTree.palette.openFolder', this.openFolder);

    reg('favFolderTree.view.createGroup', () => this.createGroup(undefined));
    reg('favFolderTree.view.refreshAllFolders', this.refreshAllFolders);
    reg('favFolderTree.view.sortMenu', this.selectSortMode);
    reg('favFolderTree.view.editFavorites', this.editFavorites);

    reg('favFolderTree.context.removeFavorite', this.removeFavorite);
    reg('favFolderTree.context.renameFavorite', this.renameFavorite);
    reg('favFolderTree.context.changeFolderFilter', this.changeFolderFilter);
    reg('favFolderTree.context.moveFavorite', this.moveFavorite);
    reg('favFolderTree.context.openGroup', this.openGroup);
    reg('favFolderTree.context.openFolder', this.openFolder);
    reg('favFolderTree.context.refreshFolder', this.refreshFolder);
    reg('favFolderTree.context.favoriteFolder', target => this.addToTargetGroup(target, 'folder'));
    reg('favFolderTree.context.createGroup', this.createGroup);
    reg('favFolderTree.context.openResource', this.openResource);
    reg('favFolderTree.context.openInNewWindow', this.openInNewWindow);
  }

  selectedElementPath(uri) {
    if (uri && uri.fsPath) {
      return uri.fsPath;
    }
    return vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri.fsPath : undefined;
  }

  async promptFolderSelection() {
    const folders = this._store.favorites().filter(item => item instanceof FolderFavorite);
    if (!folders || folders.length === 0) {
      vscode.window.showWarningMessage('No favorite folders found, please add a folder first');
      return undefined;
    }

    const picks = folders.map(folder => ({
      label: folder.label,
      description: folder.resourcePath,
      item: folder,
    }));

    const selected = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Please select a favorite folder',
      matchOnDescription: true,
    });

    return selected ? selected.item : undefined;
  }

  async promptGroupSelection(includeRoot, ...ignore) {
    const groups = (includeRoot ? [ROOT_GROUP] : []).concat(this._store.groups());
    if (!groups || groups.length === 0) {
      vscode.window.showWarningMessage('No favorite groups found, please define a group first');
      return undefined;
    }

    return vscode.window.showQuickPick(
      groups.filter(group => !ignore.find(ignored => ignored === group)),
      { placeHolder: 'Please select a favorites group' }
    );
  }
}

module.exports = {
  ExtensionController,
};
