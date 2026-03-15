const { BaseItem } = require('./base-item');
const { GroupItem, isGroup } = require('./group-item');
const { FileFavorite } = require('./file-favorite');
const { FolderFavorite } = require('./folder-favorite');
const { compareKinds, compareLabels, sortSettings } = require('../utils/sort');

function isContainerItem(item) {
  return isGroup(item) || item instanceof FolderFavorite;
}

function itemSort(a, b) {
  const settings = sortSettings();
  const kindResult = compareKinds(isContainerItem(a), isContainerItem(b), settings.mode);
  if (kindResult !== 0) {
    return kindResult;
  }
  return compareLabels(a.label, b.label, settings.direction);
}

module.exports = {
  BaseItem,
  GroupItem,
  FileFavorite,
  FolderFavorite,
  isGroup,
  isContainerItem,
  itemSort,
};
