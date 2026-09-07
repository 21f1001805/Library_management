import type { Role } from '@/providers/AuthProvider';

// Every avatar file under public/avatars/<folder>/, served by plain URL rather than a
// bundler-specific glob import (Vite's import.meta.glob has no Next.js equivalent). This
// manifest mirrors the directory contents exactly (order preserved from the old glob's
// lexicographic Object.keys().sort()) — update it if avatar files are added/removed.
const AVATAR_FILES: Record<string, string[]> = {
  admin: ['admin_1.jpg', 'admin_2.jpg'],
  staff: ['staff_1.jpg', 'staff_2.jpg', 'staff_3.jpg', 'staff_4.jpg'],
  member: [
    'member_1.jpg',
    'member_10.jpg',
    'member_11.jpg',
    'member_12.jpg',
    'member_13.jpg',
    'member_14.jpg',
    'member_15.jpg',
    'member_16.jpg',
    'member_17.jpg',
    'member_18.jpg',
    'member_19.jpg',
    'member_2.jpg',
    'member_20.jpg',
    'member_21.jpg',
    'member_22.jpg',
    'member_3.jpg',
    'member_4.jpg',
    'member_5.jpg',
    'member_6.jpg',
    'member_7.jpg',
    'member_8.jpg',
    'member_9.jpg',
  ],
  guardian: [
    'guardian_1.jpg',
    'guardian_2.jpg',
    'guardian_3.jpg',
    'guardian_4.jpg',
    'guardian_5.jpg',
  ],
  'it-head': ['it-head_1.jpg', 'it-head_2.jpg'],
};

const PRESET_IMAGE_FILES = ['member_female9.jpg', 'member_male_7.jpg'];

// Loose files with no role folder — not returned by any getter below, kept only so
// resolveAvatarUrl can still recognize a stored avatar_url that happens to reference one.
const UNFILED_FILES = [
  'female_1.png',
  'female_2.png',
  'female_3.png',
  'female_4.png',
  'female_5.png',
  'male_1.png',
  'male_2.png',
  'male_3.png',
  'male_4.png',
  'male_5.png',
];

// Only 5 avatar sets exist. 'librarian' has no dedicated folder — librarians share the
// same staff dashboard/context as managers, so they draw from the 'staff' pool too.
const ROLE_FOLDERS: Record<Role, string> = {
  admin: 'admin',
  manager: 'staff',
  librarian: 'staff',
  member: 'member',
  guardian: 'guardian',
  'it-head': 'it-head',
};

function urlsFor(folder: string, files: string[]): string[] {
  return files.map((file) => `/avatars/${folder}/${file}`);
}

/** Returns the avatar preset image URLs for the given role's picker. */
export function getAvatarPresets(role: Role): string[] {
  const folder = ROLE_FOLDERS[role];
  return urlsFor(folder, AVATAR_FILES[folder] ?? []);
}

/** Returns the avatar preset images for registration (from Preset_Image if present, or role folder). */
export function getRegistrationAvatarPresets(role: Role = 'member'): string[] {
  if (PRESET_IMAGE_FILES.length > 0) {
    return urlsFor('Preset_Image', PRESET_IMAGE_FILES);
  }
  return getAvatarPresets(role);
}

/** Resolves any stored avatar URL/filename to a valid asset URL. */
export function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/avatars/')) return url;

  // Extract the base filename (e.g. "member_female9.jpg") and match it against every
  // known folder, same fallback resolveAvatarUrl always had for a bare/legacy filename.
  const baseName = url.split('/').pop()?.split('?')[0];
  if (!baseName) return url;

  for (const [folder, files] of Object.entries(AVATAR_FILES)) {
    if (files.includes(baseName)) return `/avatars/${folder}/${baseName}`;
  }
  if (PRESET_IMAGE_FILES.includes(baseName)) return `/avatars/Preset_Image/${baseName}`;
  if (UNFILED_FILES.includes(baseName)) return `/avatars/${baseName}`;

  return url;
}
