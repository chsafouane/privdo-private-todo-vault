Thanks for helping make GitHub safe for everyone.

# Security

## Security Architecture

Privdo uses a layered encryption approach to protect your data both locally and in transit.

### Local Encryption
- **Cipher**: AES-256 via CryptoJS
- **Key derivation**: PBKDF2 with 600,000 iterations and a 16-byte random salt per device
- **PIN storage**: Only a PBKDF2-derived hash is stored — the PIN never persists in plaintext
- **Data at rest**: All tasks are encrypted before being written to IndexedDB, filesystem, or localStorage

### Sync Encryption (Optional)
When sync is enabled, an additional encryption layer protects data in transit and at rest on the server:

- **Sync key derivation**: PBKDF2 with 600,000 iterations using the sync passphrase and a fixed salt (`privdo-sync-key`)
- **Passphrase entropy**: 12 BIP39 words = 128 bits of entropy
- **Channel identification**: SHA-256 hash of passphrase (cannot be reversed)
- **Server model**: Zero-knowledge — the server stores only opaque encrypted blobs and random channel IDs
- **Key separation**: Local encryption key (from PIN) and sync encryption key (from passphrase) are fully independent

### What the server can see
| Data | Visible to server? |
|---|---|
| Task text, completion, deadlines | ❌ Never |
| Your PIN | ❌ Never |
| Your sync passphrase | ❌ Never |
| Encrypted blob (opaque) | ✅ Yes |
| Channel ID (random hash) | ✅ Yes |
| Timestamp of last sync | ✅ Yes |
| Email (if using email mode) | ✅ Yes |

## Reporting Security Issues

If you believe you have found a security vulnerability in any GitHub-owned repository, please report it to us through coordinated disclosure.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please send an email to opensource-security[@]github.com.

Please include as much of the information listed below as you can to help us better understand and resolve the issue:

  * The type of issue (e.g., buffer overflow, SQL injection, or cross-site scripting)
  * Full paths of source file(s) related to the manifestation of the issue
  * The location of the affected source code (tag/branch/commit or direct URL)
  * Any special configuration required to reproduce the issue
  * Step-by-step instructions to reproduce the issue
  * Proof-of-concept or exploit code (if possible)
  * Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Policy

See [GitHub's Safe Harbor Policy](https://docs.github.com/en/site-policy/security-policies/github-bug-bounty-program-legal-safe-harbor#1-safe-harbor-terms)
