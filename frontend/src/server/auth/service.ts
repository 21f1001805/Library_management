import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { env } from '@/server/env';
import { HttpError } from '@/server/http';
import { sendEmail } from '@/server/mail';
import { Role } from '@/server/constants';
import * as members from '@/server/members/repository';
import { memberToJson, type MemberOut } from '@/server/members/schemas';
import type { MemberWithRole } from '@/server/members/repository';
import {
  createAccessToken,
  createRefreshToken,
  createResetToken,
  decodeToken,
  hashPassword,
  verifyPassword,
  RESET_TOKEN_EXPIRE_MINUTES,
} from '@/server/auth/security';
import type {
  ForgotPasswordInput,
  GoogleLoginInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '@/server/auth/schemas';

// Mirrors backend/src/app/modules/auth/service.py function-for-function.

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: MemberOut;
  is_new_user: boolean;
}

export function invalidCredentials(): HttpError {
  return new HttpError(401, 'Incorrect email or password');
}
export function invalidRefreshToken(): HttpError {
  return new HttpError(401, 'Invalid or expired refresh token');
}
export function invalidResetToken(): HttpError {
  return new HttpError(400, 'Invalid or expired reset link');
}

function issueToken(user: MemberWithRole, isNewUser = false): TokenResponse {
  return {
    access_token: createAccessToken(user.id),
    refresh_token: createRefreshToken(user.id, user.tokenVersion),
    token_type: 'bearer',
    user: memberToJson(user),
    is_new_user: isNewUser,
  };
}

export async function register(payload: RegisterInput): Promise<TokenResponse> {
  const targetRole = (payload.role || Role.MEMBER).toLowerCase();
  const roleName =
    targetRole === Role.MEMBER || targetRole === Role.GUARDIAN ? targetRole : Role.MEMBER;

  const role = await members.upsertRole(roleName);

  let user: MemberWithRole;
  try {
    user = await members.createMember({
      email: payload.email,
      passwordHash: await hashPassword(payload.password),
      fullName: payload.full_name,
      phone: payload.phone ?? null,
      avatarUrl: payload.avatar_url ?? null,
      roleId: role.id,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'An account with this email already exists');
    }
    throw err;
  }

  await members.touchLastLogin(user.id);
  return issueToken(user);
}

export async function login(payload: LoginInput): Promise<TokenResponse> {
  const user = await members.findByEmail(payload.email);
  if (!user || !user.passwordHash || !(await verifyPassword(payload.password, user.passwordHash))) {
    throw invalidCredentials();
  }
  if (!user.isActive || user.deletedAt !== null) throw invalidCredentials();

  await members.touchLastLogin(user.id);
  return issueToken(user);
}

export async function googleLogin(payload: GoogleLoginInput): Promise<TokenResponse> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new HttpError(503, 'Google login is not configured on this server');
  }

  const client = new OAuth2Client();
  let claims;
  try {
    const ticket = await client.verifyIdToken({
      idToken: payload.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    claims = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Invalid Google token');
  }
  if (!claims) throw new HttpError(401, 'Invalid Google token');

  if (!claims.email_verified) {
    throw new HttpError(401, 'Google account email is not verified');
  }

  const email = String(claims.email).trim().toLowerCase();
  let user = await members.findByEmail(email);
  let isNewUser = user === null;

  if (user === null) {
    const role = await members.upsertRole(Role.MEMBER);
    try {
      user = await members.createMember({
        email,
        passwordHash: null,
        fullName: claims.name || email.split('@')[0],
        phone: null,
        avatarUrl: claims.picture ?? null,
        roleId: role.id,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Another callback for the same first-time Google identity won the create
        // race. Reuse that canonical account instead of returning 500.
        const existing = await members.findByEmail(email);
        if (!existing) throw err;
        user = existing;
        isNewUser = false;
      } else {
        throw err;
      }
    }
  } else if (!user.isActive || user.deletedAt !== null) {
    throw new HttpError(403, 'This account is disabled');
  }

  await members.touchLastLogin(user.id);
  return issueToken(user, isNewUser);
}

export async function updateProfile(
  user: MemberWithRole,
  payload: UpdateProfileInput,
): Promise<TokenResponse> {
  const data: Prisma.UserUpdateInput = {};

  if (payload.full_name !== undefined && payload.full_name !== null) {
    data.fullName = payload.full_name;
  }
  if ('phone' in payload) data.phone = payload.phone;
  if (payload.password !== undefined && payload.password !== null) {
    // Changing an existing password requires proving you know it — possession of a
    // 15-minute access token is not proof of identity, and without this check that
    // token became a permanent takeover that also locked the real owner out, because
    // the tokenVersion bump below kills their sessions. A Google-created account has
    // no hash yet (its first password set is exempt); every later change is checked.
    if (
      user.passwordHash !== null &&
      (!payload.current_password || !(await verifyPassword(payload.current_password, user.passwordHash)))
    ) {
      throw new HttpError(403, 'Current password is incorrect');
    }
    data.passwordHash = await hashPassword(payload.password);
    data.tokenVersion = { increment: 1 };
  }
  if ('avatar_url' in payload) data.avatarUrl = payload.avatar_url;

  const updated = Object.keys(data).length > 0 ? await members.updateMember(user.id, data) : user;
  return issueToken(updated);
}

export async function refresh(refreshToken: string): Promise<TokenResponse> {
  let claims;
  try {
    claims = decodeToken(refreshToken);
  } catch {
    throw invalidRefreshToken();
  }
  if (claims.type !== 'refresh' || !claims.sub) throw invalidRefreshToken();

  const user = await members.findById(claims.sub);
  if (!user || !user.isActive || user.deletedAt !== null) throw invalidRefreshToken();

  // ver must match the user's current tokenVersion — logout() bumps it, which
  // invalidates every refresh token issued before that point in one step.
  if (claims.ver !== user.tokenVersion) throw invalidRefreshToken();

  return issueToken(user);
}

export async function logout(user: MemberWithRole): Promise<void> {
  await members.bumpTokenVersion(user.id);
}

export async function deleteAccount(user: MemberWithRole): Promise<void> {
  if (user.role.name !== Role.MEMBER) {
    throw new HttpError(403, "Staff accounts can't be self-deleted — contact an admin");
  }

  // Minimal direct query rather than the full loans module (not ported yet, phase 3) —
  // mirrors loans/service.py's list_my_loans + the "unreturned or unpaid fine" check.
  const openLoan = await prisma.loan.findFirst({
    where: { memberId: user.id, OR: [{ returnedAt: null }, { finePaid: false }] },
  });
  if (openLoan) {
    throw new HttpError(
      409,
      'Return all borrowed books and clear outstanding fines before deleting your account',
    );
  }

  await members.updateMember(user.id, { deletedAt: new Date(), isActive: false });
  await members.bumpTokenVersion(user.id);
}

export async function forgotPassword(payload: ForgotPasswordInput): Promise<void> {
  const user = await members.findByEmail(payload.email);
  // Always resolve regardless of whether the account exists — don't let this endpoint
  // be used to enumerate registered emails.
  if (!user || !user.isActive || user.deletedAt !== null) return;

  const token = createResetToken(user.id, user.tokenVersion);
  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail(
    user.email,
    'Reset your library password',
    `Reset your password: ${resetLink}\n\nThis link expires in ${RESET_TOKEN_EXPIRE_MINUTES} minutes. ` +
      "If you didn't request this, ignore it.",
  );
}

export async function resetPassword(payload: ResetPasswordInput): Promise<void> {
  let claims;
  try {
    claims = decodeToken(payload.token);
  } catch {
    throw invalidResetToken();
  }
  if (claims.type !== 'reset' || !claims.sub) throw invalidResetToken();

  const user = await members.findById(claims.sub);
  if (!user || !user.isActive || user.deletedAt !== null) throw invalidResetToken();

  // ver must match — a used or superseded reset token, or one issued before a
  // subsequent logout/reset, is rejected the same way refresh() rejects stale tokens.
  if (claims.ver !== user.tokenVersion) throw invalidResetToken();

  await members.updateMember(user.id, { passwordHash: await hashPassword(payload.password) });
  // Bump tokenVersion so the reset token (and every existing session) is invalidated.
  await members.bumpTokenVersion(user.id);
}
