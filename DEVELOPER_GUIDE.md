# Beacon Developer Guide

This guide provides information for developers contributing to the Beacon library.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Documentation](#documentation)
- [Contribution Guidelines](#contribution-guidelines)
- [Release Process](#release-process)

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

4. Run tests to verify your setup:
```bash
npm test
```

## Architecture Overview

Beacon is a reactive state management library built on a few core concepts:

### Core Components

1. **State Signals**: Mutable reactive values that can be read and modified
2. **Derived Signals**: Computed values that automatically update when dependencies change
3. **Effects**: Side effects that run when dependencies change
4. **Batching**: Mechanism for grouping multiple updates to optimize performance

### Key Design Principles

- **Simplicity**: Keep the API surface minimal and intuitive
- **Performance**: Optimize for speed and efficiency
- **Type Safety**: Leverage TypeScript for better developer experience
- **Zero Dependencies**: Maintain zero external runtime dependencies

For detailed implementation explanations, see [TECHNICAL_DETAILS.md][1].

## Development Workflow

### Code Style

Beacon uses Biome for formatting and linting. Format your code before committing:

```bash
npm run format
```

### Basic Workflow

1. Create a branch for your feature or fix
2. Make your changes with appropriate tests
3. Ensure all tests pass
4. Format code and submit a PR

## Documentation

Beacon has several documentation resources:

- [README.md][2]: Main documentation and API reference
- [TECHNICAL_DETAILS.md][1]: Internal implementation details
- [test/README.md][3]: Comprehensive test documentation
- [scripts/README.md][4]: Utility scripts documentation

## Contribution Guidelines

### Pull Request Process

1. Create a new branch for your changes
2. Implement your changes with appropriate tests
3. Ensure all tests pass
4. Run the formatter
5. Submit a PR with a clear description of the changes

### PR Descriptions

Good PR descriptions should include:

- What the change accomplishes
- Why the change is necessary
- Any performance implications
- Reference to related issues

### Development Principles

- **Simplicity over complexity**: Favor simple solutions over complex ones
- **Performance matters**: Be mindful of performance implications
- **Test-driven**: Write tests before or alongside new features
- **Backward compatibility**: Avoid breaking changes to public APIs

## Release Process

### Versioning

Beacon follows [Epoch Semantic Versioning][5]:

- **PATCH** (1.0.x): Backwards-compatible bug fixes
- **MINOR** (1.x.0): Backwards-compatible new features
- **MAJOR** (1000.0.0): Minor incompatible API changes
- **EPOCH** (2000.0.0, 3000.0.0, etc.): Major architectural or paradigm shifts

The version format is `{EPOCH * 1000 + MAJOR}.MINOR.PATCH`, which allows us to signal significant changes while remaining compatible with SemVer tooling.

### Release Steps

1. Ensure all changes are merged to the main branch
2. Choose a release method:
   - **Option 1**: Create a GitHub release through the web interface
   - **Option 2**: Manually trigger the release workflow with a version number
3. The CI/CD pipeline will:
   - Run tests to verify everything works
   - Build the package
   - Publish to npm
   - Create a GitHub release (if using option 2)

---

Thank you for contributing to Beacon! If you have questions or need clarification on any aspect of development, please open an issue on GitHub.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License][6]. This means that your contributions become part of **@nerdalytics/beacon** and are distributed under the same terms as the rest of the project.

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
