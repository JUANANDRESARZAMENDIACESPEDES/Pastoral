// Genera iconos circulares desde pjl-logo.svg usando sharp
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'public', 'pjl-logo.svg');
const OUT = path.join(__dirname, '..', 'public');

async function generate() {
  const svgBuf = fs.readFileSync(SRC);
  const sizes = [
    { name: 'favicon-16.png', size: 48 },
    { name: 'favicon-32.png', size: 96 },
    { name: 'favicon-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192.png', size: 192 },
    { name: 'android-chrome-512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    await sharp(svgBuf)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT, name));
    console.log(`  ✓ ${name} (${size}x${size})`);
  }
  console.log('Done');
}

generate().catch(e => { console.error(e); process.exit(1); });
