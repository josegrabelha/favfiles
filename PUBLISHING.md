# Publishing Guide

This document is intended for maintainers of **FavFiles**.

The README is focused on users and Marketplace presentation. This file covers the release workflow: preparing the extension, validating it locally, packaging it, and publishing it to the VS Code Marketplace.

## Project overview

- Extension name: `favfiles`
- Display name: `FavFiles`
- Entrypoint: `src/extension.js`
- Publisher: set in `package.json`
- Repository: set in `package.json`

## Prerequisites

Before packaging or publishing, make sure you have:

- Node.js installed
- npm installed
- a Visual Studio Marketplace publisher account
- a Personal Access Token (PAT) with Marketplace publishing permissions
- `@vscode/vsce` installed globally or available in your environment

Install `vsce` if needed:

```bash
npm install -g @vscode/vsce
```

## Repository metadata

Confirm that these fields in `package.json` are correct before publishing:

- `name`
- `displayName`
- `publisher`
- `version`
- `description`
- `icon`
- `repository`
- `homepage`
- `bugs`
- `license`
- `engines.vscode`

Also review these files before each release:

- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `NOTICE` (if present)

## Recommended release checklist

Use this checklist before publishing a new version:

1. Review the final user-facing README
2. Update `CHANGELOG.md`
3. Bump the version in `package.json`
4. Confirm the extension loads correctly in the Extension Development Host
5. Verify key commands and tree interactions
6. Generate a local `.vsix`
7. Install the `.vsix` locally and test again
8. Publish to the Marketplace
9. Create a Git tag for the released version

## Local development validation

From the project root:

```bash
npm install
```

Open the project in VS Code and press:

- `F5` to launch an **Extension Development Host** window

Recommended validation before packaging:

- open the FavFiles view
- add a file
- add a folder
- create a group
- add items inside a group
- confirm actions behave correctly from both the view title buttons and the context menu
- reload the Extension Development Host and confirm persisted data still loads correctly

## Package locally

Generate a VSIX file:

```bash
vsce package
```
Or:

```bash
vsce package -o favfiles.vsix
```

Or, if the project defines package scripts, you may use the npm script instead:

```bash
npm run package
```

After packaging, install the generated file locally:

```bash
code --install-extension <generated-file>.vsix
```

Then validate the installed extension in a normal VS Code window.

## Publish to the Marketplace

Log in with your publisher name:

```bash
vsce login <publisher>
```

Publish the current version:

```bash
vsce publish
```

You can also increment the version during publication:

```bash
vsce publish patch
vsce publish minor
vsce publish major
```

If you prefer to set the version manually, update `package.json` first and then run:

```bash
vsce publish
```

## GitHub release flow

A typical release flow looks like this:

```bash
git add .
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

Then publish the extension:

```bash
vsce publish
```

## Notes about assets and Marketplace rendering

- Keep Marketplace-facing content polished in `README.md`
- Prefer PNG for screenshots used in the README
- Make sure image references resolve correctly from the public repository
- Keep the icon and visual assets consistent with the extension branding

## Fork attribution and license

FavFiles is based on the original `fredjeck/fav` project.

Keep attribution clear in the following places:

- `README.md`
- `LICENSE`
- `NOTICE` (if used)

Do not remove the original license attribution from inherited code.

## Troubleshooting

### `vsce login` or `vsce publish` fails

Check:

- publisher name is correct
- PAT is valid
- PAT has Marketplace publishing permissions

### README images do not render as expected

Check:

- repository URL in `package.json`
- image paths in `README.md`
- images are committed to the public repository

### The packaged extension behaves differently from development mode

Check:

- files excluded by `.vscodeignore`
- runtime asset paths
- command registrations and view IDs in `package.json`

## Suggested file responsibilities

- `README.md`: user-facing overview, features, screenshots, usage
- `PUBLISHING.md`: maintainer-facing release and publication workflow
- `CHANGELOG.md`: release history
- `LICENSE`: licensing terms
- `NOTICE`: attribution and fork notice
