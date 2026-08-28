# `retry(fn, options)`

Calls `fn` and retries it on failure, using exponential backoff between attempts.

## Signature

```ts
function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
```

## Parameters

`fn` -- a zero-argument function returning a promise. Called once per attempt; its return value
resolves the outer promise on success.

`options.attempts` -- maximum number of calls to `fn`, including the first one. Defaults to `3`.

`options.baseDelayMs` -- delay before the second call, in milliseconds. Each subsequent delay
doubles the previous one. Defaults to `100`.

`options.shouldRetry` -- a predicate `(error: unknown) => boolean`. When it returns `false`, the
function rethrows immediately instead of scheduling another call. Defaults to always returning
`true`.

## Return value

A promise that resolves with `fn`'s return value on the first successful call, or rejects with the
last error once the attempt budget is exhausted.

## Example

```ts
const data = await retry(() => fetchUser(id), {
  attempts: 5,
  baseDelayMs: 200,
  shouldRetry: (err) => err instanceof NetworkError,
});
```

This calls `fetchUser(id)` up to five times. A `NetworkError` triggers another call after a delay
that doubles each time: 200ms, 400ms, 800ms, 1600ms. Any other thrown value stops the loop and
propagates on the first failure.

## Errors

Throws `TypeError` if `fn` is not a function. Throws the underlying rejection reason from `fn` once
the attempt budget is exhausted, unmodified and with its original stack trace intact.
