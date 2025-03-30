# Beacon Developer Guide

This guide provides detailed information for developers who want to contribute to the Beacon library. It covers setting up your development environment, architecture overview, testing guidelines, and contribution process.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Performance Testing](#performance-testing)
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

## Project Structure

```
beacon/
├── .github/        # GitHub-related configuration
│   └── workflows/  # GitHub Actions workflow files
├── src/            # Source code
│   └── index.ts    # Main entry point
├── test/           # Test files
│   ├── state.test.ts
│   ├── derived.test.ts
│   ├── effect.test.ts
│   ├── batch.test.ts
│   ├── cleanup.test.ts
│   ├── cyclic-dependency.test.ts
│   ├── deep-chain.test.ts
│   └── performance.test.ts
├── scripts/        # Utility scripts
│   └── update-performance-docs.ts  # Performance history script
├── dist/           # Compiled output (generated)
├── README.md       # Main documentation
├── PERFORMANCE.md  # Performance benchmarks
├── TECHNICAL_DETAILS.md  # Implementation details
└── DEVELOPER_GUIDE.md    # Development guidelines
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

### Typical Workflow

1. Create a new branch for your feature or fix
2. Make your changes to the codebase
3. Write or update tests
4. Run the test suite to ensure everything passes
5. Submit a pull request

### Code Style

Beacon follows specific coding conventions:

- Use TypeScript for all code
- Include explicit return types for functions
- Export named exports (not default exports)
- Use camelCase for variable and function names
- Use JSDoc comments for public API functions
- Avoid using `forEach` loops - prefer `for...of` or `map/filter/reduce`

We use Biome for formatting and linting. Format your code before committing:

```bash
npm run format
```

## Testing Guidelines

### Test Structure

- Each feature should have corresponding test files
- Tests should be organized by functionality (state, derived, effect, etc.)
- Use descriptive test names that explain what's being tested

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:unit:state
npm run test:unit:derived
npm run test:unit:effect
npm run test:unit:batch
npm run test:unit:cleanup
npm run test:unit:cyclic
```

### Test Coverage Requirements

- 80% line coverage
- 100% branch coverage
- 80% function coverage

### Writing Good Tests

1. Test both normal and edge cases
2. Ensure tests are deterministic
3. Keep tests independent of each other
4. Use meaningful assertions
5. Follow the pattern of existing tests

## Performance Testing

Performance is critical for Beacon. We use automated performance benchmarks to ensure optimum speed.

### Running Performance Tests

```bash
# Run performance tests
npm run test:perf

# Run and update performance documentation
npm run test:perf:update-docs
```

### Performance Guidelines

- Make performance comparisons using the median of multiple runs
- Test on consistent hardware when comparing results
- Focus on relative improvements rather than absolute numbers
- Document performance impacts of changes in your PR

See [PERFORMANCE.md][2] for current benchmarks.

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

Your commits should follow our [structured commit message format][3] aligned with Epoch Semantic Versioning.

### Code Review

All contributions go through code review. Reviewers will check for:

- Functionality and correctness
- Test coverage
- Performance impacts
- Code style
- Documentation

### Development Principles

- **Simplicity over complexity**: Favor simple solutions over complex ones
- **Performance matters**: Be mindful of performance implications
- **Test-driven**: Write tests before or alongside new features
- **Backward compatibility**: Avoid breaking changes to public APIs

## Release Process

### Versioning

Beacon follows [Epoch Semantic Versioning][4]:

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

### Release Checklist

- All tests passing
- Performance benchmarks run and documented
- Documentation updated
- CHANGELOG.md updated
- Version bumped appropriately

---

Thank you for contributing to Beacon! If you have questions or need clarification on any aspect of development, please open an issue on GitHub.

<!-- Links collection -->

[1]: ./TECHNICAL_DETAILS.md
[2]: ./PERFORMANCE.md
[3]: ./CONTRIBUTING.md#git-commit-messages
[4]: https://antfu.me/posts/epoch-semver
