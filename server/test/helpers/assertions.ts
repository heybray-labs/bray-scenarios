export function expectNotServerError(status: number): void {
  expect(status).toBeLessThan(500);
}

export function expectJsonKeys(body: Record<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    expect(body).toHaveProperty(key);
  }
}
