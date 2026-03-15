const vscode = require('vscode');
const path = require('path');
const { BaseItem } = require('./base-item');
const { TYPE_GROUP } = require('../constants');
const { FileFavorite } = require('./file-favorite');

class GroupItem extends BaseItem {
  constructor(label = '') {
    super(label);
    this.type = TYPE_GROUP;
    this.children = [];
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children[idx].parent = undefined;
      this.children.splice(idx, 1);
    }
  }

  toJSON() {
    return {
      type: TYPE_GROUP,
      label: this.label,
      children: this.children,
    };
  }

  groupsDeep(parents = []) {
    parents.push(this);
    const prefix = parents.map(item => item.label).join(path.sep);
    const groups = this.children.filter(isGroup).flatMap(group => {
      group.description = ` $(folder) ${prefix}`;
      const nested = group.groupsDeep(parents);
      nested.push(group);
      return nested;
    });
    parents.pop();
    return groups;
  }

  favoritesDeep(parents = []) {
    parents.push(this);
    const prefix = parents.map(item => item.label).join(path.sep);
    const direct = this.children.filter(item => !isGroup(item)).map(item => {
      item.description = ` $(folder) ${prefix}`;
      return item;
    });
    const nested = this.children.filter(isGroup).flatMap(group => group.favoritesDeep(parents));
    parents.pop();
    return direct.concat(nested);
  }

  fileFavoritesDeep(parents = []) {
    return this.favoritesDeep(parents).filter(item => item instanceof FileFavorite);
  }

  async activate() {
    const directChildren = this.children.filter(item => !(item instanceof GroupItem));

    for (const item of directChildren) {
      await item.activate();
    }
  }

  location() {
    return this.fileFavoritesDeep().flatMap(file => file.location());
  }

  toTreeItem() {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = this.children.length > 0 ? 'group' : 'group-empty';
    item.tooltip = this.label;
    item.iconPath = {
      light: path.join(__dirname, '../../resources/light/folderG.svg'),
      dark: path.join(__dirname, '../../resources/dark/folderG.svg'),
    };
    return item;
  }
}

function isGroup(item) {
  return item instanceof GroupItem;
}

module.exports = {
  GroupItem,
  isGroup,
};
