export class CurrentUserGateUnavailableError extends Error {
  constructor() {
    super("The current user request did not complete");
  }
}

export async function loadBoundedCurrentUser<T>(
  load: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      load(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new CurrentUserGateUnavailableError());
        }, timeoutMs);
      }),
    ]);
  } catch {
    throw new CurrentUserGateUnavailableError();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
