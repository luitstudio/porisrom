-- PostgreSQL's POSIX regex implementation rejects the previous {0,511}
-- repetition bound. Keep the same prefix and character policy, while making
-- length and path-shape checks explicit and portable.
ALTER TABLE "BackupCanonicalSet"
  DROP CONSTRAINT "BackupCanonicalSet_canonicalStorageKey_check";

ALTER TABLE "BackupCanonicalSet"
  ADD CONSTRAINT "BackupCanonicalSet_canonicalStorageKey_check" CHECK (
    char_length("canonicalStorageKey") > char_length('backup-canonical/')
    AND char_length("canonicalStorageKey") <= 529
    AND "canonicalStorageKey" ~ '^backup-canonical/[A-Za-z0-9][A-Za-z0-9._/-]*$'
    AND "canonicalStorageKey" NOT LIKE '%..%'
    AND "canonicalStorageKey" NOT LIKE '%//%'
    AND right("canonicalStorageKey", 1) <> '/'
    AND position(chr(92) in "canonicalStorageKey") = 0
  );
