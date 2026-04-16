Thanks for caring about security.

# Security

## Security Architecture

Privdo uses a layered encryption approach to protect your data both locally and in transit.

### Local Encryption
- **Cipher**: AES-256 via CryptoJS
- **Key derivation**: PBKDF2 with 600,000 iterations and a 16-byte random salt per device
- **PIN storage**: Only a PBKDF2-derived hash is stored — the PIN never persists in plaintext
- **Data at rest**: The entire vault (all lists and their tasks) is encrypted as a single blob before being written to IndexedDB, filesystem, or localStorage

### Sync Encryption (Optional)
When sync is enabled, an additional encryption layer protects data in transit and at rest on the server:

- **Sync key derivation**: PBKDF2 with 600,000 iterations using the sync secret and a fixed salt (`privdo-sync-key`)
- **Sync secret**: In passphrase mode, the 12-word BIP39 passphrase (128 bits of entropy). In email mode, the combination of email + password.
- **Channel identification**: SHA-256 hash of the sync secret with a separate salt (`privdo-channel-id`) — cannot be reversed to recover credentials
- **Server model**: Zero-knowledge — the server stores only opaque encrypted blobs and random channel IDs
- **No authentication**: Neither mode uses Supabase Auth. All operations go through an Edge Function with a service-role key. The server never receives your email, password, or passphrase.
- **Key separation**: Local encryption key (from PIN) and sync encryption key (from passphrase or email+password) are fully independent

### What the server can see
| Data | Visible to server? |
|---|---|
| Task text, list names, deadlines | ❌ Never |
| Your PIN | ❌ Never |
| Your sync passphrase | ❌ Never |
| Your email or password (email mode) | ❌ Never |
| Encrypted blob (opaque) | ✅ Yes |
| Channel ID (random hash) | ✅ Yes |
| Timestamp of last sync | ✅ Yes |

## Reporting Security Issues

If you believe you have found a security vulnerability, please report it responsibly.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please open a private security advisory on this repository or contact the maintainer directly.

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

We follow coordinated disclosure. Please allow reasonable time for a fix before public disclosure.
