-- PostgreSQL requires UPDATE privilege for SELECT ... FOR UPDATE.  The
-- definer function reads this row only; grant the immutable key column solely
-- to its NOLOGIN owner so neither runtime role gains request mutation rights.
GRANT UPDATE (id) ON public."BackupCaptureRequest" TO porisrom_finalizer_owner;
