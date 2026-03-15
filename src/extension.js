const { ExtensionController } = require('./controller/extension-controller');

function activate(context) {
  new ExtensionController(context);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
