# Security

## Reporting a vulnerability

Please report security problems privately, through GitHub: open this repository's
**Security** tab and choose **Report a vulnerability**. Don't open a public issue, pull
request or discussion about it until it's fixed.

Say what's affected, how to reproduce it, and what someone could do with it. You'll hear
back within a few days, and you'll be told when a fix ships. Credit in the release notes is
yours if you'd like it.

## Scope

- **In scope:** the code in this repository: the web app, the desktop app (`desktop/`) and
  the Google Workspace add-on (`google-addon/`), and the copy at
  [joinfaceon.app](https://joinfaceon.app) that runs it.
- **Out of scope:**
  - other people's copies of FaceOn: report those to whoever runs them
  - the services FaceOn builds on (Stream, Vercel, Neon, Resend, Cloudflare, Google, GitHub): report those to them
  - denial of service by sheer volume, spam, and social engineering

Please test only with accounts and meetings of your own, and never read, change or keep
other people's data.

## Supported versions

Fixes go into `main`, and from there to joinfaceon.app and the next desktop release. Only
the latest desktop release is supported: it updates itself.
