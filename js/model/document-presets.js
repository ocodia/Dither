// Pixel dimensions, not CSS viewport sizes. Device models are named explicitly.
// References: https://support.apple.com/en-us/121029
// https://support.apple.com/en-us/121031 and https://support.apple.com/en-us/121032
// https://www.apple.com/ipad-11/specs/ and https://support.apple.com/en-au/121456
// https://support.google.com/youtube/answer/12950272
// https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo
const pixels = (id, name, width, height) => ({ id, name, width, height });
const print = (id, name, width, height, unit = 'mm', ppi = 300) => ({
  id, name: `${name} · ${width} × ${height} ${unit} · ${ppi} PPI`,
  width: Math.round(width / (unit === 'mm' ? 25.4 : 1) * ppi),
  height: Math.round(height / (unit === 'mm' ? 25.4 : 1) * ppi),
  note: `Sized for ${width} × ${height} ${unit} at ${ppi} PPI. Set this print size when printing the exported PNG.${ppi < 300 ? ' Large-format preset uses a lower resolution to fit the canvas limit.' : ''}`
});

export const documentPresetGroups = [
  { name: 'General', presets: [
    pixels('landscape', 'Landscape', 1600, 1000),
    pixels('square', 'Square', 1080, 1080),
    pixels('portrait', 'Portrait', 1080, 1920)
  ] },
  { name: 'Social media', note: 'Platforms may crop covers and profile pictures. Keep important content away from the edges.', presets: [
    pixels('instagram-square', 'Instagram · square post', 1080, 1080),
    pixels('instagram-portrait', 'Instagram · portrait post (4:5)', 1080, 1350),
    pixels('instagram-tall', 'Instagram · tall post (3:4)', 1080, 1440),
    pixels('social-story', 'Instagram / Facebook · story', 1080, 1920),
    pixels('vertical-video', 'Reels / TikTok / Shorts · vertical', 1080, 1920),
    pixels('instagram-profile', 'Instagram · profile', 320, 320),
    pixels('facebook-cover', 'Facebook · cover', 820, 312),
    pixels('facebook-post', 'Facebook · landscape post', 1200, 630),
    pixels('facebook-profile', 'Facebook · profile', 400, 400),
    pixels('youtube-thumbnail', 'YouTube · thumbnail', 1280, 720),
    pixels('youtube-cover', 'YouTube · channel banner', 2560, 1440),
    pixels('youtube-profile', 'YouTube · profile', 800, 800),
    pixels('x-header', 'X / Twitter · header', 1500, 500),
    pixels('x-profile', 'X / Twitter · profile', 400, 400),
    pixels('x-post', 'X / Twitter · landscape post', 1600, 900),
    pixels('linkedin-header', 'LinkedIn · personal header', 1584, 396),
    pixels('linkedin-profile', 'LinkedIn · profile', 400, 400),
    pixels('pinterest-pin', 'Pinterest · pin', 1000, 1500)
  ] },
  { name: 'Print', presets: [
    print('a0', 'A0', 841, 1189, 'mm', 100),
    print('a1', 'A1', 594, 841, 'mm', 150),
    print('a2', 'A2', 420, 594, 'mm', 150),
    print('a3', 'A3', 297, 420),
    print('a4', 'A4', 210, 297),
    print('a5', 'A5', 148, 210),
    print('a6', 'A6', 105, 148),
    print('a7', 'A7', 74, 105),
    print('letter', 'US Letter', 8.5, 11, 'in'),
    print('legal', 'US Legal', 8.5, 14, 'in'),
    print('tabloid', 'US Tabloid', 11, 17, 'in')
  ] },
  { name: 'Photos', presets: [
    print('wallet', 'Wallet', 2.5, 3.5, 'in'),
    print('photo-portrait', 'Portrait', 4, 6, 'in'),
    print('photo-landscape', 'Landscape / postcard', 6, 4, 'in'),
    print('photo-5x7', 'Portrait', 5, 7, 'in'),
    print('photo-8x10', 'Portrait', 8, 10, 'in'),
    print('photo-10x8', 'Landscape', 10, 8, 'in'),
    print('photo-square', 'Square', 5, 5, 'in'),
    print('photo-square-large', 'Square', 8, 8, 'in'),
    print('photo-panorama', 'Panorama', 12, 4, 'in')
  ] },
  { name: 'Screens', presets: [
    pixels('vga', 'VGA', 640, 480),
    pixels('svga', 'SVGA', 800, 600),
    pixels('xga', 'XGA', 1024, 768),
    pixels('hd', 'HD · 720p', 1280, 720),
    pixels('full-hd', 'Full HD · 1080p', 1920, 1080),
    pixels('2k', '2K · DCI', 2048, 1080),
    pixels('qhd', 'QHD · 1440p', 2560, 1440),
    pixels('ultrawide', 'Ultrawide QHD', 3440, 1440),
    pixels('uhd', '4K UHD · 2160p', 3840, 2160),
    pixels('4k', '4K · DCI', 4096, 2160)
  ] },
  { name: 'Devices', note: 'Native display pixels in portrait orientation. Use Swap dimensions for landscape.', presets: [
    pixels('iphone-16', 'iPhone 16', 1179, 2556),
    pixels('iphone-16-pro', 'iPhone 16 Pro', 1206, 2622),
    pixels('iphone-16-pro-max', 'iPhone 16 Pro Max', 1320, 2868),
    pixels('ipad-a16', 'iPad 11-inch (A16)', 1640, 2360),
    pixels('ipad-mini', 'iPad mini (A17 Pro)', 1488, 2266)
  ] }
];
