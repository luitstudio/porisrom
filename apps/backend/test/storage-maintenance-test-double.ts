/** Existing storage unit tests are not coordinator tests; production always injects
 * the durable coordinator. */
export const allowStorageMutation = {
  run: <T>(_kind: string, mutate: (lease: { operationId: string; assertNotFenced(): Promise<void> }) => Promise<T>) =>
    mutate({ operationId: "test-operation", assertNotFenced: async () => undefined }),
};
