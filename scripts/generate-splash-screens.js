/**
 * iOS Splash Screen Generator
 * 
 * Generates Apple launch images for all iOS device sizes.
 * These appear instantly when the app launches, before any JS loads.
 * 
 * NEW THEME: White gradient background with blue Helpy logo
 * 
 * Usage: node scripts/generate-splash-screens.js
 * 
 * Note: This script uses canvas to generate the images.
 * Install dependency: npm install canvas
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// All iOS device splash screen sizes
// Format: [width, height, scale, deviceName]
const SPLASH_SIZES = [
  // iPhone 15 Pro Max, 14 Pro Max
  [1290, 2796, 3, 'iPhone 15 Pro Max'],
  // iPhone 15 Pro, 14 Pro
  [1179, 2556, 3, 'iPhone 15 Pro'],
  // iPhone 15, 15 Plus, 14, 14 Plus, 13, 13 Pro, 12, 12 Pro
  [1170, 2532, 3, 'iPhone 15'],
  [1284, 2778, 3, 'iPhone 15 Plus'],
  // iPhone 13 mini, 12 mini
  [1080, 2340, 3, 'iPhone 13 mini'],
  // iPhone 11 Pro Max, XS Max
  [1242, 2688, 3, 'iPhone 11 Pro Max'],
  // iPhone 11 Pro, XS, X
  [1125, 2436, 3, 'iPhone 11 Pro'],
  // iPhone 11, XR
  [828, 1792, 2, 'iPhone 11'],
  // iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus
  [1242, 2208, 3, 'iPhone 8 Plus'],
  // iPhone 8, 7, 6s, 6, SE (2nd & 3rd gen)
  [750, 1334, 2, 'iPhone 8'],
  // iPhone SE (1st gen), 5s, 5c, 5
  [640, 1136, 2, 'iPhone SE 1st'],
  // iPad Pro 12.9" (6th, 5th, 4th, 3rd gen)
  [2048, 2732, 2, 'iPad Pro 12.9'],
  // iPad Pro 11" (4th, 3rd, 2nd, 1st gen)
  [1668, 2388, 2, 'iPad Pro 11'],
  // iPad Pro 10.5", Air (3rd gen)
  [1668, 2224, 2, 'iPad Pro 10.5'],
  // iPad (10th gen)
  [1640, 2360, 2, 'iPad 10th'],
  // iPad (9th, 8th, 7th gen), Air (2nd gen)
  [1620, 2160, 2, 'iPad 9th'],
  // iPad mini (6th gen)
  [1488, 2266, 2, 'iPad mini 6th'],
  // iPad (6th, 5th gen), mini (5th gen), Air
  [1536, 2048, 2, 'iPad 6th'],
  // iPad mini (4th gen and earlier)
  [768, 1024, 1, 'iPad mini 4th'],
];

const OUTPUT_DIR = path.join(__dirname, '../public/splash');

/**
 * Draw gradient background (new Helpy theme)
 * Mimics: linear-gradient(to right bottom, #fafafa, #eef6f8)
 */
function drawGradientBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#fafafa');
  gradient.addColorStop(0.3, '#f8f8fa');
  gradient.addColorStop(0.5, '#f4f7f9');
  gradient.addColorStop(0.7, '#f1f6f8');
  gradient.addColorStop(1, '#eef6f8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

async function generateSplashScreens() {
  console.log('🎨 Generating iOS splash screens (new Helpy theme)...');
  console.log('   Background: White gradient');
  console.log('   Logo: Blue Helpy logo');
  console.log('');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Load the blue Helpy logo (for new white background theme)
  const logoPath = path.join(__dirname, '../public/helpy-logo-blue.png');
  let logo;
  try {
    logo = await loadImage(logoPath);
    console.log(`✅ Loaded blue logo: ${logo.width}x${logo.height}`);
  } catch (error) {
    console.error('❌ Failed to load helpy-logo-blue.png:', error.message);
    console.log('📝 Creating text-based splash screens instead...');
    console.log('   (Add helpy-logo-blue.png to public/ folder for proper splash screens)');
    logo = null;
  }
  
  // Generate each splash screen
  for (const [width, height, scale, deviceName] of SPLASH_SIZES) {
    const filename = `splash-${width}x${height}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Draw gradient background (new Helpy theme)
    drawGradientBackground(ctx, width, height);
    
    if (logo) {
      // Calculate logo size (should be readable but not too large)
      // Target: logo is about 35% of screen width
      const targetWidth = width * 0.35;
      const logoScale = targetWidth / logo.width;
      const logoWidth = logo.width * logoScale;
      const logoHeight = logo.height * logoScale;
      
      // Center the logo
      const x = (width - logoWidth) / 2;
      const y = (height - logoHeight) / 2;
      
      // Draw the logo
      ctx.drawImage(logo, x, y, logoWidth, logoHeight);
    } else {
      // Fallback: draw "helpy" text in Helpy blue
      const fontSize = Math.floor(width * 0.12);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = '#3EAFD2'; // Helpy blue
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('helpy', width / 2, height / 2);
    }
    
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    
    console.log(`✅ Generated: ${filename} (${deviceName})`);
  }
  
  console.log('');
  console.log('🎉 All splash screens generated!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('');
  console.log('📋 Add these link tags to index.html:');
  console.log('');
  
  // Generate the HTML link tags
  for (const [width, height, scale, deviceName] of SPLASH_SIZES) {
    // Calculate device dimensions (width/scale, height/scale)
    const deviceWidth = width / scale;
    const deviceHeight = height / scale;
    
    console.log(`<link rel="apple-touch-startup-image" href="/splash/splash-${width}x${height}.png" media="(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${scale})">`);
  }
}

// Run the generator
generateSplashScreens().catch(console.error);
