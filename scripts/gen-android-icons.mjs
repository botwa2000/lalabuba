import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'icon-512.png');

// launcher icon size + adaptive foreground size (108dp at each density)
const densities = [
  { folder: 'mipmap-mdpi',    icon: 48,  foreground: 108 },
  { folder: 'mipmap-hdpi',    icon: 72,  foreground: 162 },
  { folder: 'mipmap-xhdpi',   icon: 96,  foreground: 216 },
  { folder: 'mipmap-xxhdpi',  icon: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', icon: 192, foreground: 432 },
];

for (const { folder, icon, foreground } of densities) {
  const dir = join(root, 'android', 'app', 'src', 'main', 'res', folder);
  mkdirSync(dir, { recursive: true });

  await sharp(src).resize(icon, icon).toFile(join(dir, 'ic_launcher.png'));
  await sharp(src).resize(icon, icon).toFile(join(dir, 'ic_launcher_round.png'));
  await sharp(src).resize(foreground, foreground).toFile(join(dir, 'ic_launcher_foreground.png'));

  console.log(`${folder}: launcher=${icon}px  foreground=${foreground}px`);
}

console.log('Done.');
