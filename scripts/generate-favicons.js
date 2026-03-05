const { favicons } = require('favicons');
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../public/cover-image.png');
const outputDir = path.join(__dirname, '../public');

const configuration = {
  path: '/',
  appName: 'ThreatAlert',
  appShortName: 'ThreatAlert',
  appDescription: 'Real-Time Community Safety Map',
  developerName: null,
  developerURL: null,
  dir: 'auto',
  lang: 'en-US',
  background: '#0e1220',
  theme_color: '#0e1220',
  appleStatusBarStyle: 'black-translucent',
  display: 'standalone',
  orientation: 'any',
  scope: '/',
  start_url: '/',
  preferRelatedApplications: false,
  relatedApplications: undefined,
  version: '1.0',
  pixel_art: false,
  loadManifestWithCredentials: false,
  manifestMaskable: true,
  icons: {
    android: false,
    appleIcon: { offset: 10, background: true },
    appleStartup: false,
    favicons: true,
    windows: false,
    yandex: false,
  },
};

async function generateFavicons() {
  try {
    console.log('Generating favicons from cover-image.png...');
    
    const response = await favicons(source, configuration);
    
    // Save images
    for (const image of response.images) {
      const filePath = path.join(outputDir, image.name);
      fs.writeFileSync(filePath, image.contents);
      console.log(`✓ Generated ${image.name}`);
    }
    
    // Save files (like browserconfig.xml, manifest.json if needed)
    for (const file of response.files) {
      const filePath = path.join(outputDir, file.name);
      fs.writeFileSync(filePath, file.contents);
      console.log(`✓ Generated ${file.name}`);
    }
    
    console.log('\n✓ Favicons generated successfully!');
    console.log('\nGenerated files:');
    response.images.forEach(img => console.log(`  - ${img.name}`));
    
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
