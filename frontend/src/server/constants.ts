// Mirrors backend/src/app/core/constants.py's Role enum — same serialized values.
export const Role = {
  ADMIN: 'admin',
  LIBRARIAN: 'librarian',
  MANAGER: 'manager',
  MEMBER: 'member',
  GUARDIAN: 'guardian',
  IT_HEAD: 'it-head',
} as const;

export type RoleName = (typeof Role)[keyof typeof Role];
