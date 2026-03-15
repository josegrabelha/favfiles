const vscode = require('vscode');
const {
  SORT_MODE_FOLDERS_ABOVE,
  SORT_MODE_FOLDERS_BELOW,
  SORT_MODE_MIXED,
  SORT_DIRECTION_ASC,
  SORT_DIRECTION_DESC,
} = require('../constants');

function sortSettings() {
  const config = vscode.workspace.getConfiguration('favFolderTree');
  return {
    mode: config.get('sortMode', SORT_MODE_FOLDERS_ABOVE),
    direction: config.get('sortDirection', SORT_DIRECTION_ASC),
  };
}

function compareLabels(aLabel, bLabel, direction) {
  const result = aLabel.localeCompare(bLabel, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  return direction === SORT_DIRECTION_DESC ? -result : result;
}

function compareKinds(aIsContainer, bIsContainer, mode) {
  if (mode === SORT_MODE_MIXED || aIsContainer === bIsContainer) {
    return 0;
  }

  if (mode === SORT_MODE_FOLDERS_ABOVE) {
    return aIsContainer ? -1 : 1;
  }

  if (mode === SORT_MODE_FOLDERS_BELOW) {
    return aIsContainer ? 1 : -1;
  }

  return 0;
}

function sortModeLabel(mode) {
  switch (mode) {
    case SORT_MODE_FOLDERS_BELOW:
      return 'Folders Below';
    case SORT_MODE_MIXED:
      return 'Folders and Files Mixed';
    case SORT_MODE_FOLDERS_ABOVE:
    default:
      return 'Folders Above';
  }
}

function sortDirectionLabel(direction) {
  return direction === SORT_DIRECTION_DESC ? 'Z–A' : 'A–Z';
}

function currentSortDescription() {
  const settings = sortSettings();
  return `${sortModeLabel(settings.mode)} • ${sortDirectionLabel(settings.direction)}`;
}

function sortOptionItems() {
  return [
    { label: 'Folders Above', description: 'A–Z', mode: SORT_MODE_FOLDERS_ABOVE, direction: SORT_DIRECTION_ASC },
    { label: 'Folders Above', description: 'Z–A', mode: SORT_MODE_FOLDERS_ABOVE, direction: SORT_DIRECTION_DESC },
    { label: 'Folders Below', description: 'A–Z', mode: SORT_MODE_FOLDERS_BELOW, direction: SORT_DIRECTION_ASC },
    { label: 'Folders Below', description: 'Z–A', mode: SORT_MODE_FOLDERS_BELOW, direction: SORT_DIRECTION_DESC },
    { label: 'Folders and Files Mixed', description: 'A–Z', mode: SORT_MODE_MIXED, direction: SORT_DIRECTION_ASC },
    { label: 'Folders and Files Mixed', description: 'Z–A', mode: SORT_MODE_MIXED, direction: SORT_DIRECTION_DESC },
  ];
}

module.exports = {
  sortSettings,
  compareLabels,
  compareKinds,
  sortModeLabel,
  sortDirectionLabel,
  currentSortDescription,
  sortOptionItems,
};
