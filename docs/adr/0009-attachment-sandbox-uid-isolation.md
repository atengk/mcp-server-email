# 9. Attachment Sandbox UID Subdirectory Isolation and Collision Defense

## Status
Accepted

## Context & Decision
When downloading attachments with identical filenames across multiple email messages (e.g. `invoice.pdf` or `image001.png`), storing them directly into the root sandbox directory causes subsequent downloads to silently overwrite earlier files, corrupting cross-message file comparisons by AI agents. We decided to structure the attachment sandbox with message UID subdirectories (`sandboxDir/${uid}/${safeFileName}`). This completely eliminates collision overwrites while preserving original human-readable filenames and clear message ownership.
