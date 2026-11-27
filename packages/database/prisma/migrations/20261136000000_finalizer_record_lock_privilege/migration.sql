-- Idempotent finalization locks its own immutable record before deciding
-- whether a retry is exact.  The NOLOGIN function owner needs only the key
-- lock privilege; runtime roles remain unable to read or alter records.
GRANT SELECT, UPDATE ("captureJobId") ON public."BackupCaptureFinalization" TO porisrom_finalizer_owner;
