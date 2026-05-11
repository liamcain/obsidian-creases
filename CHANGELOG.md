# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.7.3](https://github.com/liamcain/obsidian-creases/compare/0.7.2...0.7.3) (2026-05-11)


### Bug Fixes

* **build:** Add basic sortBy shim to fully remove lodash usage ([97a8781](https://github.com/liamcain/obsidian-creases/commit/97a8781e5ffd10c34aeed514753c98c62ce02630))
* **build:** Bring back monkey-around dependency ([bd8d2bd](https://github.com/liamcain/obsidian-creases/commit/bd8d2bdb7bf3ee85e4cdeb36cba57f74ca457c8b))

### [0.7.2](https://github.com/liamcain/obsidian-creases/compare/0.7.1...0.7.2) (2026-05-11)


### Bug Fixes

* **build:** Fix switch to pnpm causing publish script to fail ([f518ace](https://github.com/liamcain/obsidian-creases/commit/f518ace944dd11fa9ffeb2c495905eaa09773142))

### [0.7.1](https://github.com/liamcain/obsidian-creases/compare/0.7.0...0.7.1) (2026-05-11)


### Features

* **settings:** Add support for new declarative getSettingDefinitions API ([282b330](https://github.com/liamcain/obsidian-creases/commit/282b330a299168083d51ff050f99785be5bb6f9f))


### Bug Fixes

* Gate .cm-creases-icon hover behind (hover: hover) ([c7efb6c](https://github.com/liamcain/obsidian-creases/commit/c7efb6ca80335d2072c0f31ce6502b8c110160b6))
* guard heading-level commands against files with no matching headings ([28c823f](https://github.com/liamcain/obsidian-creases/commit/28c823fe28575390fc6acb8b395c6a71581b1d30))
* Render crease widgets when switching from source mode to live preview ([ca92a50](https://github.com/liamcain/obsidian-creases/commit/ca92a50adaa5e1d84ef6d665c1cc5ec7d62892e7))

## [0.7.0](https://github.com/liamcain/obsidian-creases/compare/0.6.6...0.7.0) (2023-07-17)


### ⚠ BREAKING CHANGES

* removed the options to sync folds between the editor
and the Outline view. Because of the internal Obsidian changes, this
logic has been broken for a while and has been removed.

### Bug Fixes

* no longer causes a split view to appear when opening a file. ([8d556cb](https://github.com/liamcain/obsidian-creases/commit/8d556cbae47445426a54f3d9955c62b2d3d0adfa))

### [0.6.6](https://github.com/liamcain/obsidian-creases/compare/0.6.5...0.6.6) (2022-12-29)


### Bug Fixes

* take blockId into consideration when bug fix for 'crease current folds' command [#21](https://github.com/liamcain/obsidian-creases/issues/21) ([#36](https://github.com/liamcain/obsidian-creases/issues/36)) ([ce3c85b](https://github.com/liamcain/obsidian-creases/commit/ce3c85b0ed539170e458224cc29dce4b0d2ad0e3))
* take blockId into consideration when calling 'toggleCrease' ([f854847](https://github.com/liamcain/obsidian-creases/commit/f85484791c146dd667f8130682e41582bf52b932))

### [0.6.5](https://github.com/liamcain/obsidian-creases/compare/0.6.4...0.6.5) (2022-07-02)


### Bug Fixes

* remove ghost panes introduced in Obsidian 0.15.X ([5e26f92](https://github.com/liamcain/obsidian-creases/commit/5e26f92709dd7387fd3935fe7d33eef3f280f402))

### [0.6.4](https://github.com/liamcain/obsidian-creases/compare/0.6.3...0.6.4) (2022-04-16)


### Bug Fixes

* "Toggle Crease" command now respects block-ids ([3f5fde3](https://github.com/liamcain/obsidian-creases/commit/3f5fde3e9c70d911a57196a296f48cfaff97ce44)), closes [#21](https://github.com/liamcain/obsidian-creases/issues/21)

### [0.6.3](https://github.com/liamcain/obsidian-creases/compare/0.6.2...0.6.3) (2022-04-16)


### Features

* **outline:** add bidirectional sync to outline view ([bf2f24e](https://github.com/liamcain/obsidian-creases/commit/bf2f24eb774aa5561148dee59e82dcc9986300c9)), closes [#24](https://github.com/liamcain/obsidian-creases/issues/24) [#19](https://github.com/liamcain/obsidian-creases/issues/19)

### [0.6.2](https://github.com/liamcain/obsidian-creases/compare/0.6.1...0.6.2) (2022-04-16)


### Bug Fixes

* iron out creases should not remove newlines ([08fff95](https://github.com/liamcain/obsidian-creases/commit/08fff953b1c62510dfee2642fd0e9943ad50f1d3))
