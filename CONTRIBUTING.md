# Contributing to @nerdalytics/beacon

## Code of Conduct

Follow the [Code of Conduct][1].

## Development Setup

### Prerequisites

- Node.js v20.0.0 or later (v22+ recommended)

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/nerdalytics/beacon.git
cd beacon
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build:lts
```

4. Run tests to verify setup:
```bash
npm test
```

To run a single test file in isolation:
```bash
node --test tests/batch.test.ts
```

## Architecture

Single-file core (`src/index.ts`) with four primitives: `state`, `derive`, `effect`, `batch`. Zero external dependencies. See the [handbook architecture page][3] for internals.

## Reporting Issues

Open an issue on GitHub. Include:

- Environment details (OS, Node.js version)
- Steps to reproduce
- Expected vs. actual behavior
- Relevant error messages or screenshots

## Suggesting Enhancements

1. Open an issue with a clear title and description
2. Explain why the change is needed
3. Optionally, propose an approach

## Submitting Pull Requests

1. Fork the repository and create a branch
2. Match existing code style; include tests
3. Update docs if needed
4. Submit a PR describing changes and referencing related issues

Maintainers will review your PR. Respond to feedback promptly.

## Commit Messages

Format aligned with [Epoch Semantic Versioning][2]:

```
<type>(<scope>): <summary>

<body>

<footer>
```

### Types

- **epoch**: Architectural or paradigm shifts (bumps EPOCH)
- **breaking**: Incompatible API changes (bumps MAJOR)
- **feat**: New features (bumps MINOR)
- **fix**: Bug fixes (bumps PATCH)
- **perf**: Performance improvements (bumps PATCH)
- **refactor**: No bug fix or feature (no version bump)
- **style**: No behavior change (no version bump)
- **test**: Adding or correcting tests (no version bump)
- **docs**: Documentation updates (no version bump)
- **chore**: Maintenance tasks (no version bump)

### Scope

Optional. Indicates the area affected: `state`, `derive`, `effect`, `batch`.

### Summary

- Imperative, present tense: "add" not "added" or "adds"
- Lowercase first letter
- No period
- Under 72 characters

### Body

- Explain motivation for the change
- Imperative, present tense
- Break lines at 72 characters

### Footer

- Reference issues: `Fixes #123, Closes #456`
- Note breaking changes: `BREAKING CHANGE: description`

### Examples

```
feat(derive): add support for explicit dependency tracking

Add an optional second parameter to derive() that accepts an array
of dependencies to track explicitly, rather than using automatic
dependency detection.

This improves performance in cases where automatic tracking is too
aggressive and provides more control to developers.
```

```
breaking(api): rename effect() to watch()

Function behaves identically but the name better reflects its purpose
and aligns with industry terminology.

BREAKING CHANGE: effect() should be replaced with watch()
```

```
epoch(core): rewrite core reactivity system

Complete overhaul of the internal reactivity system to use proxies
instead of getters/setters for better performance and cleaner API.

BREAKING CHANGE: While the public API remains compatible,
internal APIs are completely different. Extensions using internals
will need to be updated.
```

## Code Formatting

Run `npm run format` before committing. Biome handles formatting and linting.

## Release Process

### Versioning

Beacon follows [Epoch Semantic Versioning][2]:

- **PATCH** (1.0.x): Bug fixes
- **MINOR** (1.x.0): New features
- **MAJOR** (1000.0.0): Incompatible API changes
- **EPOCH** (2000.0.0, 3000.0.0, etc.): Architectural shifts

Format: `{EPOCH * 1000 + MAJOR}.MINOR.PATCH` — compatible with SemVer tooling.

### Release Steps

1. Merge all changes to trunk
2. Release via GitHub web interface or manually trigger the release workflow with a version number
3. CI runs tests, builds the package, and publishes to npm

## License

By contributing, you agree that your contributions will be licensed under the [MIT License][4].

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./CODE_OF_CONDUCT.md
[2]: https://antfu.me/posts/epoch-semver
[3]: https://nerdalytics.github.io/beacon/v2000/architecture
[4]: ./LICENSE
