import { webcrypto } from "node:crypto"

/**
 * Better Auth reaches for a global `crypto` to generate ids and tokens. Node
 * only exposes one globally from 19 onwards, and Netlify's function runtime is
 * not necessarily the version the build ran on -- so sign-up fails at the
 * first `generateId` with a bare "crypto is not defined".
 *
 * Assigning the built-in implementation costs nothing on a runtime that
 * already has it, and is the difference between working and not on one that
 * does not. Imported for its side effect only; keep it first in auth.ts.
 */
if (!(globalThis as { crypto?: Crypto }).crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    enumerable: false,
    writable: false,
  })
}
