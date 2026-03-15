class BaseItem {
  constructor(label = '') {
    this.label = label;
    this.parent = undefined;
    this.description = undefined;
  }

  quickPick() {
    return {
      label: this.label,
      description: this.description,
      item: this,
    };
  }
}

module.exports = {
  BaseItem,
};
