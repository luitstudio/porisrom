export function effectiveEnvironment(baseEnvironment: Record<string, string | undefined>, commandEnvironment?: Record<string, string | undefined>): Readonly<Record<string, string | undefined>>;
export function safeDiagnostic(value: unknown): string;
export function assertDisposableOwnerUrl(environment: Record<string, string | undefined>, expectedUrl: string, selectedPort: string): Readonly<Record<string, string | undefined>>;
export function createInvoker(args: {
  spawn: (command: string, args: string[], options: { cwd: string; shell: boolean; encoding: string; env: Record<string, string | undefined> }) => { status: number | null; stdout?: string; stderr?: string };
  baseEnvironment: Record<string, string | undefined>;
  root: string;
  shell: boolean;
}): (command: string, args: string[], options?: { cwd?: string; env?: Record<string, string | undefined> }) => string;
export function assertFreshDatabaseIdentity(output: string, expected: { database: string; owner: string }): void;
export function assertHarnessMarkerIdentity(output: string, expected: { database: string; owner: string; runId: string }): void;
