import type { Role } from '@/providers/AuthProvider';

// Every avatar file under src/assets/avatars/<folder>/, keyed by its full path.
// Vite resolves each to its built asset URL (same as a normal `import img from '...'`).
const avatarModules = import.meta.glob<string>('../assets/avatars/**/*.{jpg,jpeg,png}', {
  eager: true,
  import: 'default',
});

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

function loadFolder(folder: string): string[] {
  return Object.keys(avatarModules)
    .filter((path) => path.includes(`/avatars/${folder}/`))
    .sort()
    .map((path) => avatarModules[path]);
}

/** Returns the avatar preset image URLs for the given role's picker. */
export function getAvatarPresets(role: Role): string[] {
  const folder = ROLE_FOLDERS[role];
  return loadFolder(folder);
}
