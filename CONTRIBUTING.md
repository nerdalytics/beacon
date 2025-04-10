# Contributing to @nerdalytics/beacon

Thank you for your interest in contributing to **@nerdalytics/beacon**! We welcome contributions from everyone—whether you're reporting a bug, suggesting enhancements, or submitting code improvements. By participating in this project, you agree to follow these guidelines to ensure smooth, efficient, and respectful collaboration.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Issues](#reporting-issues)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Style Guides](#style-guides)
  - [Git Commit Messages](#git-commit-messages)
  - [Code Formatting](#code-formatting)
- [Documentation](#documentation)
- [Additional Resources](#additional-resources)
- [License](#license)

---

## Code of Conduct

All contributors are expected to adhere to our [Code of Conduct][1]. Please read it carefully to understand our standards for respectful and constructive behavior.

---

## How to Contribute

We welcome contributions in many forms, including bug reports, feature requests, documentation improvements, and code enhancements. Please follow the guidelines below depending on your type of contribution:

### Reporting Issues

If you've encountered a bug or have a feature request, please open an issue on GitHub. When reporting, be sure to include:
- **Environment Details:** Operating system, Node.js version, etc.
- **Steps to Reproduce:** A clear list of steps to reproduce the issue.
- **Expected vs. Actual Behavior:** What you expected to happen versus what actually occurred.
- **Screenshots/Logs:** Any relevant error messages or screenshots.

### Suggesting Enhancements

For new feature ideas or improvements:
1. Open a new issue with a clear title and detailed description.
2. Explain why the change is needed and how it benefits the project.
3. Optionally, propose a solution or approach.

### Submitting Pull Requests

Before submitting a pull request (PR), please:
1. **Fork** the repository and create a new branch for your changes.
2. **Follow the Code Style:** Ensure your code matches the existing style and includes tests where applicable.
3. **Update Documentation:** Reflect your changes in the documentation, if necessary.
4. **Describe Your Changes:** In the PR description, provide a summary of your changes and reference any related issues.
5. **Review Process:** Your PR will be reviewed by the maintainers. Please respond to feedback promptly and update your PR as needed.

---

## Style Guides

### Git Commit Messages

We use a structured commit message format aligned with [Epoch Semantic Versioning][2]:

```
<type>(<scope>): <summary>

<body>

<footer>
```

#### Types

Types indicate the kind of change being made, aligned with Epoch Semantic Versioning:

- **epoch**: Major architectural or paradigm shifts (bumps EPOCH)
- **breaking**: Incompatible API changes (bumps MAJOR within current EPOCH)
- **feat**: New features (bumps MINOR)
- **fix**: Bug fixes (bumps PATCH)
- **perf**: Performance improvements (bumps PATCH)
- **refactor**: Code changes that neither fix bugs nor add features (no version bump)
- **style**: Changes that don't affect code behavior (no version bump)
- **test**: Adding or correcting tests (no version bump)
- **docs**: Documentation updates (no version bump)
- **chore**: Maintenance tasks (no version bump)

#### Scope

The scope is optional and indicates the part of the codebase affected, e.g., `state`, `derived`, `effect`, `batch`.

#### Summary

- Use imperative, present tense: "add" not "added" or "adds"
- Don't capitalize the first letter
- No period at the end
- Keep it under 72 characters

#### Body

- Explain the motivation for the change
- Use imperative, present tense
- Include relevant context
- Break lines at 72 characters

#### Footer

- Reference issues and PRs: `Fixes #123, Closes #456`
- Note breaking changes: `BREAKING CHANGE: description of what breaks and how to migrate`

#### Examples

```
feat(derived): add support for explicit dependency tracking

Add an optional second parameter to derived() that accepts an array
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

### Code Formatting

- Follow the coding standards already in place for **@nerdalytics/beacon**.
- Ensure your code is clean, readable, and includes comments where needed.
- Use our formatting tools (e.g., Biome, ESLint) to keep the codebase consistent.

---

## Documentation

- Update the documentation in tandem with code changes.
- If you introduce new features or alter existing functionality, update the README and other relevant docs accordingly.
- Consider adding examples or usage details for clarity.

---

## Additional Resources

- For more detailed developer guidance, check out our [Developer Guide][3].
- Join our community chat for real-time support and discussion.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License][4]. This means that your contributions become part of **@nerdalytics/beacon** and are distributed under the same terms as the rest of the project.

---

*Thank you for helping improve **@nerdalytics/beacon**. Your contributions make this project better for everyone!*

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./CODE_OF_CONDUCT.md
[2]: https://antfu.me/posts/epoch-semver
[3]: ./DEVELOPER_GUIDE.md
[4]: ./LICENSE
