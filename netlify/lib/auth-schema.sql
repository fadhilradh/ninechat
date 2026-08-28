-- Better Auth core schema for Postgres.
--
-- Prefer generating this rather than trusting a checked-in copy to stay
-- current:  npx @better-auth/cli@latest migrate
--
-- It is committed so a fresh Netlify DB can be brought up with one paste, and
-- so the shape of what accounts actually store is reviewable in the repo.
-- Identifiers are quoted because Better Auth uses camelCase columns.

CREATE TABLE IF NOT EXISTS "user" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "image"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "token"     TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session" ("expiresAt");

CREATE TABLE IF NOT EXISTS "account" (
  "id"                    TEXT PRIMARY KEY,
  "userId"                TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  -- The provider's own id for this user; equals "userId" for email/password.
  "accountId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "idToken"               TEXT,
  "accessTokenExpiresAt"  TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope"                 TEXT,
  -- Only populated for the email/password provider. Hashed by Better Auth.
  "password"              TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_idx"
  ON "account" ("providerId", "accountId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON "verification" ("identifier");
