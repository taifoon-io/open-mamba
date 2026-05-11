# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.x     | Yes       |

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Email **taifooon@proton.me** with:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a minimal proof-of-concept
- Your preferred contact for follow-up

We will acknowledge receipt within 48 hours and aim to ship a fix within 14 days for confirmed vulnerabilities. You will be credited in the release notes unless you prefer otherwise.

## Scope

This policy covers `open-mamba` — the MIT-licensed task bus and agent dispatcher. For vulnerabilities in the Pro tier (`taifoon-mamba`) or on-chain contracts, use the same contact.

## Notes

- open-mamba is designed for **self-hosted, local-network deployment**. It binds to `localhost:1337` by default and should not be exposed to the public internet without additional auth.
- The `openfang` sidecar (not open-source) handles agent execution. Report issues in that component to the same address.
