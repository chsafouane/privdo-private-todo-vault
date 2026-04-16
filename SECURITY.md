# Security

Thanks for caring about security.

## Security Architecture

Privdo uses a layered encryption approach to protect your data both locally and in transit.

### Local Encryption

- **Cipher**: AES-256-CBC with HMAC-SHA256 (encrypt-then-MAC)
- **Key derivation**: PBKDF2 with 600,000 iterations and a 16-byte random salt per device (native Web Crypto API)
- **Sync key derivation**: PBKDF2 via native Web Crypto API (async, non-blocking)
- **PIN storage**: Only a PBKDF2-derived hash is stored — the PIN never persists in plaintext
- **Salt persistence**: The encryption salt is stored in both browser localStorage and the Electron config file, ensuring resilience to localStorage loss
- **Data at rest**: The entire vault (all lists and their tasks) is encrypted as a single blob before being written to IndexedDB, filesystem, or localStorage
- **Brute force protection**: Exponential backoff starting at the 3rd failed attempt, full lockout at 10 attempts (60 seconds). Lockout state persists across page reloads.
- **PIN confirmation**: During initial setup, the PIN must be entered twice to prevent typo-induced lockout

### Sync Encryption (Optional)

When sync is enabled, an additional encryption layer protects data in transit and at rest on the server:

- **Sync key derivation**: PBKDF2 with 600,000 iterations using the sync secret and a fixed salt (`privdo-sync-key`)
- **Sync secret**: In passphrase mode, the 12-word BIP39 passphrase (128 bits of entropy). In email mode, the combination of email + password.
- **Channel identification**: SHA-256 hash of the sync secret with a separate salt (`privdo-channel-id`) — cannot be reversed to recover credentials
- **Server model**: Zero-knowledge — the server stores only opaque encrypted blobs and random channel IDs
- **No authentication**: Neither mode uses Supabase Auth. All operations go through an Edge Function with a service-role key. The server never receives your email, password, or passphrase.
- **Key separation**: Local encryption key (from PIN) and sync encryption key (from passphrase or email+password) are fully independent
- **Rate limiting**: The sync edge function enforces 60 requests per minute per channel
- **CORS**: Origin restriction via `ALLOWED_ORIGINS` environment variable (comma-separated list). Falls back to permissive `*` if unconfigured.
- **Payload limits**: Maximum 5MB per sync blob
- **Optimistic concurrency**: Version-based conflict detection with atomic WHERE clause prevents race conditions

### Electron Security

- **Sandbox**: Enabled — renderer process is fully sandboxed
- **Context isolation**: Enabled — preload and renderer share no JavaScript scope
- **Node integration**: Disabled — no access to Node.js APIs from the renderer
- **IPC allowlist**: Only 5 specific channels are exposed to the renderer
- **CSP**: Content Security Policy set via response headers
- **Navigation blocking**: `will-navigate` and `setWindowOpenHandler` prevent navigation attacks
- **Path traversal protection**: `validateFilePath()` resolves symlinks and validates against the configured storage directory
- **Storage path isolation**: The renderer cannot set `storagePath` directly — only the native file dialog can

### Web Security

- **Content Security Policy**: Strict CSP via meta tag restricts script/style/connect sources
- **No external scripts**: All JavaScript is bundled — no CDN dependencies at runtime

### What the server can see

| Data | Visible to server? |
| --- | --- |
| Task text, list names, deadlines | ❌ Never |
| Your PIN | ❌ Never |
| Your sync passphrase | ❌ Never |
| Your email or password (email mode) | ❌ Never |
| Encrypted blob (opaque) | ✅ Yes |
| Channel ID (random hash) | ✅ Yes |
| Timestamp of last sync | ✅ Yes |

### Positive Security Properties

| Area | Assessment |
| ------ | ----------- |
| Encrypt-then-MAC | AES-256-CBC + HMAC-SHA256 with IV-ciphertext coverage |
| PBKDF2 iterations | 600,000 iterations using native Web Crypto — meets OWASP guidance |
| Constant-time comparison | Used for MAC and PIN hash verification — no length leakage |
| PIN cleared from memory | PIN values cleared from React state immediately after use |
| Sync config encryption | Sync key and channel ID encrypted with local key in localStorage |
| Passphrase entropy | 12 BIP39 words = ~132 bits of entropy |
| Input sanitization | Storage keys sanitized to prevent filename injection |
| Tombstone pruning | 30-day auto-purge prevents unbounded data growth |

### Known Limitations

- **PIN entropy**: PINs accept both letters and numbers (alphanumeric). A short numeric-only PIN has limited entropy — use 6+ characters with mixed content for stronger protection.
- **CryptoJS**: AES operations use the CryptoJS library (pure JavaScript) rather than native Web Crypto API. While functionally correct, native AES-GCM would provide better performance and resistance to JavaScript-level side channels. Migration is planned.
- **Widget data**: The iOS widget bridge writes a truncated task title (50 chars) as plaintext to the shared app group. This is documented behavior to enable the widget feature.
- **Legacy fallback**: Data encrypted with older versions (1,000 PBKDF2 iterations, hardcoded salt) can still be decrypted via a migration path. This exists solely for backward compatibility and does not affect new data.

## Reporting Security Issues

If you believe you have found a security vulnerability, please report it responsibly.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please open a private security advisory on this repository or contact the maintainer directly.

Please include as much of the information listed below as you can to help us better understand and resolve the issue:

- The type of issue (e.g., buffer overflow, SQL injection, or cross-site scripting)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Policy

We follow coordinated disclosure. Please allow reasonable time for a fix before public disclosure.
