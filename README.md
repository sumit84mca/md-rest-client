# MdRestClient

VS Code extension to write documentation in Markdown and run REST requests directly from preview.

## How to write requests

Use normal markdown, then add fenced `http` blocks:

````markdown
# User API

This request gets one user.

```http
GET https://jsonplaceholder.typicode.com/users/1
Accept: application/json
```

This request creates one user.

```http
POST https://jsonplaceholder.typicode.com/users
Content-Type: application/json

{
  "name": "Jane"
}
```
````

## Run from preview mode

1. Open a markdown file.
2. Run command: **Markdown REST: Open Preview**.
3. Click **Run request** on any `http` block.
4. Response opens in one reusable response tab on right side.

## Variables support

Supports Rest Client style variables:

1. Workspace/user settings: `rest-client.environmentVariables`
2. Local request vars inside block: `@name = value`
3. Template usage: `{{name}}`

Set active environment using setting: `markdownRestPreview.environment` (default: empty / `No Environment`).

You can also click environment text in status bar (same behavior style as Rest Client) to switch environment from a quick-pick list.

## Third-party attributions

This extension includes/adapts patterns from:

1. Rest Client (MIT): https://github.com/Huachao/vscode-restclient
2. highlight.js conventions (BSD-3-Clause): https://github.com/highlightjs/highlight.js
3. markdown-it (MIT): https://github.com/markdown-it/markdown-it

See `THIRD_PARTY_NOTICES.md` for details.

## CI/CD pipelines

This repo includes two GitHub Actions workflows:

1. **Release package** (`.github/workflows/release-package.yml`)
   - Runs on tag push `v*` and manual dispatch.
   - Builds `.vsix`.
   - Uploads `.vsix` artifact.
   - On tag pushes, creates GitHub release and attaches `.vsix`.

2. **Publish marketplace** (`.github/workflows/publish-marketplace.yml`)
   - Runs on manual dispatch or published GitHub release.
   - Publishes extension with `vsce publish`.

Required setup:

1. Set `publisher` in `package.json` to your VS Code Marketplace publisher id (not `local-dev`).
2. Add repo secret `VSCE_PAT` with Marketplace Personal Access Token.
