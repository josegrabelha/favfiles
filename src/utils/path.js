const path = require('path');

function fileName(fsPath) {
  return fsPath.split(path.sep).pop() || fsPath;
}

module.exports = {
  fileName,
};
