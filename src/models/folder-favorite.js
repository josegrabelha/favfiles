const vscode = require('vscode');
const path = require('path');
const { BaseItem } = require('./base-item');
const { FileFavorite } = require('./file-favorite');
const { TYPE_FOLDER } = require('../constants');
const { sortSettings, compareKinds, compareLabels } = require('../utils/sort');
const { normalizeFilter, fileMatchesFilter } = require('../utils/filter');

class FolderFavorite extends BaseItem {
  constructor(label = '', resourcePath = '', dynamic = false, filter = '*') {
    super(label);
    this.type = TYPE_FOLDER;
    this.resourcePath = resourcePath;
    this.dynamic = dynamic;
    this.filter = normalizeFilter(filter);
    this.rootPath = undefined;
  }

  get resourceUri() {
    return vscode.Uri.file(this.resourcePath);
  }

  async exists() {
    try {
      const stat = await vscode.workspace.fs.stat(this.resourceUri);
      return Boolean(stat.type & vscode.FileType.Directory);
    } catch (err) {
      return false;
    }
  }

  toJSON() {
    return {
      type: TYPE_FOLDER,
      label: this.label,
      resourcePath: this.resourcePath,
      filter: this.filter,
    };
  }

  async fileFavoritesFirstLevel() {
    try {
      const entries = await vscode.workspace.fs.readDirectory(this.resourceUri);
      const mapped = entries
        .map(([name, type]) => ({ name, type, fullPath: path.join(this.resourcePath, name) }))
        .filter(entry => Boolean(entry.type & vscode.FileType.File))
        .filter(entry => fileMatchesFilter(entry.name, this.filter))
        .sort((a, b) => {
          const settings = sortSettings();
          return compareLabels(a.name, b.name, settings.direction);
        });

      return mapped.map(entry => new FileFavorite(entry.name, entry.fullPath, true));
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  async fileFavoritesDeep() {
    const walk = async folderPath => {
      const uri = vscode.Uri.file(folderPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const mapped = entries
        .map(([name, type]) => ({ name, type, fullPath: path.join(folderPath, name) }))
        .filter(entry => Boolean(entry.type & vscode.FileType.Directory) || Boolean(entry.type & vscode.FileType.File))
        .filter(entry => Boolean(entry.type & vscode.FileType.Directory) || fileMatchesFilter(entry.name, this.filter))
        .sort((a, b) => {
          const settings = sortSettings();
          const aDir = Boolean(a.type & vscode.FileType.Directory);
          const bDir = Boolean(b.type & vscode.FileType.Directory);
          const kindResult = compareKinds(aDir, bDir, settings.mode);
          if (kindResult !== 0) {
            return kindResult;
          }
          return compareLabels(a.name, b.name, settings.direction);
        });

      const files = [];
      for (const entry of mapped) {
        if (entry.type & vscode.FileType.Directory) {
          files.push(...await walk(entry.fullPath));
        } else if (entry.type & vscode.FileType.File) {
          files.push(new FileFavorite(entry.name, entry.fullPath, true));
        }
      }
      return files;
    };

    try {
      return await walk(this.resourcePath);
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  async activate() {
    if (!await this.exists()) {
      return vscode.window.showWarningMessage(`Folder not found: ${this.resourcePath}`);
    }

    const files = await this.fileFavoritesFirstLevel();

    if (!files.length) {
      return vscode.window.showInformationMessage('No files found in this favorite folder.');
    }

    for (const file of files) {
      await file.activate();
    }
  }

  location() {
    return [this.resourceUri];
  }

  async getChildren() {
    try {
      const entries = await vscode.workspace.fs.readDirectory(this.resourceUri);
      const mapped = entries
        .map(([name, type]) => ({ name, type, fullPath: path.join(this.resourcePath, name) }))
        .filter(entry => Boolean(entry.type & vscode.FileType.Directory) || Boolean(entry.type & vscode.FileType.File))
        .filter(entry => Boolean(entry.type & vscode.FileType.Directory) || fileMatchesFilter(entry.name, this.filter))
        .sort((a, b) => {
          const settings = sortSettings();
          const aDir = Boolean(a.type & vscode.FileType.Directory);
          const bDir = Boolean(b.type & vscode.FileType.Directory);
          const kindResult = compareKinds(aDir, bDir, settings.mode);
          if (kindResult !== 0) {
            return kindResult;
          }
          return compareLabels(a.name, b.name, settings.direction);
        });

      return mapped.map(entry => {
        if (entry.type & vscode.FileType.Directory) {
          const folder = new FolderFavorite(entry.name, entry.fullPath, true, this.filter);
          folder.rootPath = this.rootPath || this.resourcePath;
          folder.parent = this;
          return folder;
        }

        const file = new FileFavorite(entry.name, entry.fullPath, true);
        file.parent = this;
        return file;
      });
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  async toTreeItem() {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.Collapsed);
    item.label = this.label;
    item.resourceUri = this.resourceUri;
    item.iconPath = vscode.ThemeIcon.Folder;

    const descriptionParts = [];
    if (!this.dynamic) {
      descriptionParts.push(`[${this.filter}]`);
    }

    item.contextValue = this.dynamic ? 'browse-folder' : 'folder';
    item.tooltip = `${this.resourcePath}\nFilter: ${this.filter}`;

    if (!await this.exists()) {
      descriptionParts.push('[Missing]');
      item.contextValue = this.dynamic ? 'browse-folder-missing' : 'folder-missing';
      item.tooltip = `${this.resourcePath}\nFilter: ${this.filter}\n\nThis folder could not be found.`;
    }

    if (descriptionParts.length) {
      item.description = descriptionParts.join(' ');
    }

    return item;
  }
}

module.exports = {
  FolderFavorite,
};
