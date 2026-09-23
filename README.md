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

All fenced code blocks are rendered as styled blocks with language label (for example `json`, `javascript`, `yaml`, `sql`).

## Troubleshooting request errors

If request execution fails, the extension now shows method + URL + network cause (for example `ECONNREFUSED (127.0.0.1:8080)`).

Common causes:

1. Target server is not running or wrong host/port.
2. URL is blocked by proxy/VPN/firewall.
3. TLS certificate on target endpoint is invalid/expired.

Debug logs are also written to VS Code output channel **MdRestClient** (View → Output → select `MdRestClient`).

## Variables support

Supports Rest Client style variables:

1. Workspace/user settings: `rest-client.environmentVariables`
2. Local request vars inside block: `@name = value`
3. Template usage: `{{name}}`

Set active environment using setting: `markdownRestPreview.environment` (default: empty / `MdRest: No Env`).

You can also click `MdRest: ...` in status bar to switch environment from a quick-pick list.

## Third-party attributions

This extension includes/adapts patterns from:

1. Rest Client (MIT): https://github.com/Huachao/vscode-restclient
2. highlight.js conventions (BSD-3-Clause): https://github.com/highlightjs/highlight.js
3. markdown-it (MIT): https://github.com/markdown-it/markdown-it

See `THIRD_PARTY_NOTICES.md` for details.

## CI and security checks

Repository workflows for CI/security live in `.github/workflows/`.

Rollout details and enforcement phases: `docs/ci-security.md`.
