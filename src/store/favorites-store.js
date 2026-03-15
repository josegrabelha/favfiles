const vscode = require('vscode');
const { TYPE_GROUP, TYPE_FOLDER } = require('../constants');
const { GroupItem, FolderFavorite, FileFavorite, isGroup, itemSort } = require('../models');
const { fileName } = require('../utils/path');

class FavoritesStore {
  constructor(context, onLoaded) {
    this._onStoreLoaded = new vscode.EventEmitter();
    this.onStoreLoaded = this._onStoreLoaded.event;
    this._favorites = [];

    const dir = context.globalStorageUri;
    vscode.workspace.fs.createDirectory(dir);
    this._storeUri = vscode.Uri.joinPath(dir, 'favorites.json');

    this.onStoreLoaded(onLoaded);
    this.refresh();
  }

  static get instance() {
    if (!FavoritesStore._instance) {
      throw new Error('Favorites store has not been initialized');
    }
    return FavoritesStore._instance;
  }

  static fromContext(context, onLoaded) {
    if (!FavoritesStore._instance) {
      FavoritesStore._instance = new FavoritesStore(context, onLoaded);
    }
    return FavoritesStore._instance;
  }

  get storeUri() {
    return this._storeUri;
  }

  async refresh() {
    let raw = [];
    let didMigrate = false;

    try {
      const buf = await vscode.workspace.fs.readFile(this._storeUri);
      raw = JSON.parse(buf.toString()) || [];
    } catch (err) {
      if (err && (err.code === 'FileNotFound' || err.name === 'EntryNotFound')) {
        await this.persist();
        this._onStoreLoaded.fire(undefined);
        return;
      }
      throw err;
    }

    this._favorites = (raw || []).map(entry => this.restore(entry, undefined, () => {
      didMigrate = true;
    }));

    if (didMigrate) {
      await this.persist();
    }

    this._onStoreLoaded.fire(undefined);
  }

  restore(entry, parent, markMigrated) {
    let item;
    const hasType = typeof entry.type === 'string';

    if (!hasType) {
      markMigrated();
    }

    if (entry.type === TYPE_GROUP || (!hasType && Array.isArray(entry.children))) {
      item = new GroupItem(entry.label || 'New group');
      item.children = (entry.children || []).map(child => this.restore(child, item, markMigrated));
    } else if (entry.type === TYPE_FOLDER || (!hasType && Object.prototype.hasOwnProperty.call(entry, 'filter'))) {
      if (!Object.prototype.hasOwnProperty.call(entry, 'filter')) {
        markMigrated();
      }
      item = new FolderFavorite(entry.label || fileName(entry.resourcePath), entry.resourcePath || '', false, entry.filter || '*');
    } else {
      item = new FileFavorite(entry.label || fileName(entry.resourcePath), entry.resourcePath || '', false);
    }

    if (parent) {
      item.parent = parent;
    }

    return item;
  }

  async add(...items) {
    this._favorites.push(...items);
    await this.persist();
  }

  async update() {
    await this.persist();
  }

  async delete(...items) {
    items.forEach(item => {
      if (item.parent && isGroup(item.parent)) {
        item.parent.removeChild(item);
      } else {
        const idx = this._favorites.indexOf(item);
        if (idx >= 0) {
          this._favorites.splice(idx, 1);
        }
      }
    });

    await this.persist();
  }

  root() {
    return this._favorites.sort(itemSort);
  }

  groups() {
    return this._favorites
      .filter(isGroup)
      .flatMap(group => {
        const nested = group.groupsDeep([]);
        nested.push(group);
        return nested;
      })
      .sort(itemSort);
  }

  favorites() {
    const direct = this._favorites.filter(item => !isGroup(item));
    const grouped = this._favorites.filter(isGroup).flatMap(group => group.favoritesDeep([]));
    return direct.concat(grouped);
  }

  async persist() {
    const data = JSON.stringify(this._favorites, null, 4);
    await vscode.workspace.fs.writeFile(this.storeUri, Buffer.from(data));
  }
}

module.exports = {
  FavoritesStore,
};
