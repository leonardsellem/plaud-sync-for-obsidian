# Contributing to Plaud Sync for Obsidian

Thanks for your interest in contributing! This plugin uses a reverse-engineered API, so community help with keeping it working is especially valuable.

## Getting started

1. Fork and clone the repo
2. Install dependencies: `npm ci`
3. Start dev mode: `npm run dev`
4. Symlink or copy the plugin into a test vault's `.obsidian/plugins/plaud-sync/` folder
5. Enable the plugin in Obsidian and reload after changes

## Development workflow

```bash
npm run dev       # watch mode — rebuilds on save
npm run build     # typecheck + production build
npm run test      # run test suite
npm run lint      # eslint
```

All four commands must pass before submitting a PR.

## Submitting changes

1. Create a branch from `main`
2. Make your changes with clear, focused commits
3. Add or update tests for any new or changed behavior
4. Run `npm run test && npm run lint && npm run build` to verify
5. Open a pull request against `main`

## Reporting bugs

Open an issue with:

- Obsidian version and OS
- Steps to reproduce
- Expected vs. actual behavior
- Any relevant error messages from the developer console (`Ctrl/Cmd+Shift+I`)

## Reporting API changes

Since this plugin depends on a reverse-engineered API, Plaud may change their endpoints at any time. If sync stops working after a Plaud update:

1. Open the Plaud web app and check the Network tab in DevTools
2. Note any changed endpoints, response formats, or headers
3. Open an issue with your findings

## Code style

- TypeScript with `strict: true`
- Follow existing patterns in the codebase
- Keep modules focused — one responsibility per file
- Prefer `async/await` over promise chains

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
