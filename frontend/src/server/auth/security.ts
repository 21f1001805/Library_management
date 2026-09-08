import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '@/server/env';

// Mirrors backend/src/app/core/security.py exactly — same claim shapes, same expiries —
// so tokens/cookies stay valid against either backend during the module-by-module
// cutover. bcryptjs produces standard $2b$ hashes, interoperable with the Python
// `bcrypt` package's output, so existing passwordHash values keep verifying.
const ACCESS_TOKEN_EXPIRE_MINUTES = 15;
const REFRESH_TOKEN_EXPIRE_DAYS = 7;
export const RESET_TOKEN_EXPIRE_MINUTES = 30;

export type TokenType = 'access' | 'refresh' | 'reset';

export interface TokenClaims {
  sub: string;
  type: TokenType;
  ver?: number;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

function encode(payload: Omit<TokenClaims, 'exp'>, expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return jwt.sign({ ...payload, exp }, env.JWT_SECRET, { algorithm: 'HS256' });
}

export function createAccessToken(userId: string): string {
  return encode({ sub: userId, type: 'access' }, ACCESS_TOKEN_EXPIRE_MINUTES * 60);
}

export function createRefreshToken(userId: string, tokenVersion: number): string {
  return encode(
    { sub: userId, type: 'refresh', ver: tokenVersion },
    REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
  );
}

export function createResetToken(userId: string, tokenVersion: number): string {
  return encode(
    { sub: userId, type: 'reset', ver: tokenVersion },
    RESET_TOKEN_EXPIRE_MINUTES * 60,
  );
}

export const REFRESH_TOKEN_EXPIRE_SECONDS = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60;
export const ACCESS_TOKEN_EXPIRE_SECONDS = ACCESS_TOKEN_EXPIRE_MINUTES * 60;

// Callers must still check claims.type themselves — this only verifies signature/expiry,
// same contract as decode_token() in security.py.
export function decodeToken(token: string): TokenClaims {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenClaims;
}
