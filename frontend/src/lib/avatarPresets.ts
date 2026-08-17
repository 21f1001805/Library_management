import female1 from '@/assets/avatars/female_1.png';
import female2 from '@/assets/avatars/female_2.png';
import female3 from '@/assets/avatars/female_3.png';
import female4 from '@/assets/avatars/female_4.png';
import female5 from '@/assets/avatars/female_5.png';
import male1 from '@/assets/avatars/male_1.png';
import male2 from '@/assets/avatars/male_2.png';
import male3 from '@/assets/avatars/male_3.png';
import male4 from '@/assets/avatars/male_4.png';
import male5 from '@/assets/avatars/male_5.png';

const AVATAR_PRESETS = [
  female1,
  male1,
  female2,
  male2,
  female3,
  male3,
  female4,
  male4,
  female5,
  male5,
];

export function getAvatarPresets(): string[] {
  return AVATAR_PRESETS;
}
