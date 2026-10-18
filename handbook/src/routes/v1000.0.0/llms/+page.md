---
title: LLM Documentation
description: Plain-text endpoints for referencing Beacon docs in LLM conversations
---

<script>
import Version from '#lib/components/Version.svelte'
</script>

## Overview

The Beacon handbook is available as plain text at every version. These endpoints follow the [llms.txt](https://llmstxt.org/) convention and return content LLMs can read directly.

## Endpoints

| URL | Content |
|---|---|
| `/llms.txt` | Index of all available versions |
| `/{version}/llms.txt` | Page listing for a specific version |
| `/{version}/llms-full.txt` | All pages concatenated into one document |
| `/{version}/{page}.md` | Single page as raw Markdown |

Replace `{version}` with a version number, such as `<Version />`, or with `latest`.

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

These URLs work with any tool that can fetch a resource. Paste a URL into your prompt in Claude Code or ChatGPT. Add it as a doc reference in Cursor or Windsurf. Custom agents can fetch `/{version}/llms-full.txt` as system context.
