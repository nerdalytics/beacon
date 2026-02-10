# Beacon Developer Guide

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

## Architecture

Single-file core (`src/index.ts`) with four primitives: `state`, `derive`, `effect`, `batch`. Zero external dependencies. See [TECHNICAL_DETAILS.md][1] for internals.

## Development Workflow

Biome handles formatting and linting. Format before committing:

```bash
npm run format
```

### Submitting Changes

1. Create a branch
2. Write changes with tests
3. Run `npm test` and `npm run format`
4. Submit a PR describing what changed, why, and any performance implications

Reference related issues in the PR description.

## Documentation

- [README.md][2]: API reference
- [TECHNICAL_DETAILS.md][1]: Implementation details
- [test/README.md][3]: Test documentation
- [scripts/README.md][4]: Utility scripts

## Release Process

### Versioning

Beacon follows [Epoch Semantic Versioning][5]:

- **PATCH** (1.0.x): Bug fixes
- **MINOR** (1.x.0): New features
- **MAJOR** (1000.0.0): Incompatible API changes
- **EPOCH** (2000.0.0, 3000.0.0, etc.): Architectural shifts

Format: `{EPOCH * 1000 + MAJOR}.MINOR.PATCH` — compatible with SemVer tooling.

### Release Steps

1. Merge all changes to trunk
2. Release via GitHub web interface or manually trigger the release workflow with a version number
3. CI runs tests, builds the package, and publishes to npm

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License][6].

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./TECHNICAL_DETAILS.md
[2]: ./README.md
[3]: ./test/README.md
[4]: ./scripts/README.md
[5]: https://antfu.me/posts/epoch-semver
[6]: ./LICENSE
