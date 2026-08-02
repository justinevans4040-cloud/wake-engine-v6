# Security Policy

## Supported version

Security fixes are applied to the current `0.6.x` development line on the `master` branch. Historical snapshots under `archive/` are retained for provenance and are not supported production releases.

## Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, private source file, or exploit path in a public issue.

Use GitHub's private vulnerability-reporting flow from the repository **Security** tab. If private reporting is unavailable, contact the repository owner through the GitHub profile and request a private channel. Include:

- affected commit or version;
- affected file and line range;
- reproduction steps;
- expected and observed behavior;
- impact and required preconditions;
- any proof-of-concept data with secrets removed.

## Security boundaries

WAKE Engine is designed as a local-first Windows desktop application with these boundaries:

- the application server binds to loopback rather than a public interface;
- state-changing browser requests require authenticated session and CSRF protections;
- provider credentials use Electron `safeStorage` when supported by the operating system;
- source-folder intake is operator-selected;
- scheduled automatic export is blocked unless the generated packet passes QA;
- generated claims are mapped to source evidence and unsupported wording is blocked;
- runtime state uses atomic writes, write-ahead logging, recovery, and bounded history;
- live runtime data, generated exports, release output, and local credentials must not be committed.

These controls reduce risk but do not make the application immune to malware, a compromised Windows account, hostile source documents, hardware failure, or an operator intentionally bypassing safeguards.

## Repository controls

GitHub Actions performs:

- portable build and runtime-contract verification;
- scheduler verification;
- Windows NSIS installer construction;
- production dependency audit;
- full-history secret scanning;
- SHA-256 checksum generation for installer artifacts.

A green CI result applies only to the tested commit and documented checks.

## Handling secrets and private material

Never commit:

- `.env` files;
- API keys or tokens;
- provider credentials;
- personal manuscripts or client source material;
- generated local state;
- exported campaign packets containing private material;
- screenshots that expose credentials, private paths, or personal data.

If a secret is committed, revoke and rotate it first. Removing it in a later commit does not remove it from Git history.
