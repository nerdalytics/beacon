---
title: LLM Documentation
description: Plain-text endpoints for referencing Beacon docs in LLM conversations
---

## Overview

The Beacon handbook is available as plain text at every version. These endpoints follow the [llms.txt](https://llmstxt.org/) convention and return content that LLMs can read directly.

## Endpoints

| URL | Content |
|---|---|
| `/llms.txt` | Index of all available versions |
| `/{version}/llms.txt` | Page listing for a specific version |
| `/{version}/llms-full.txt` | All pages concatenated into one document |
| `/{version}/{page}.md` | Single page as raw Markdown |

Replace `{version}` with a version number (e.g. `v1000.2.2`) or `latest`.

## Examples

Full documentation context:

```
Read https://nerdalytics.github.io/beacon/latest/llms-full.txt and explain how state() works.
```

Single page reference:

```
Read https://nerdalytics.github.io/beacon/latest/state.md and show me how to use nested reactivity.
```

## Tool integration

These URLs work anywhere an LLM can fetch a resource:

- **Claude Code** / **ChatGPT** — paste the URL into your prompt
- **Cursor** / **Windsurf** — add as a doc reference
- **Custom agents** — fetch `/{version}/llms-full.txt` as system context
