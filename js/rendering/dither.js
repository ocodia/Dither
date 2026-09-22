// Alpha-aware Floyd–Steinberg error diffusion. Transparent pixels cannot carry error.
export function floydSteinberg(data, width, height, intensity = 1) {
  const current = new Float32Array(width + 2), next = new Float32Array(width + 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!data[i + 3]) continue;
      const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      const value = Math.max(0, Math.min(255, luminance + current[x + 1]));
      const quantized = value >= 128 ? 255 : 0, error = value - quantized;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - intensity) + quantized * intensity;
      current[x + 2] += error * 7 / 16;
      next[x] += error * 3 / 16; next[x + 1] += error * 5 / 16; next[x + 2] += error / 16;
    }
    current.set(next); next.fill(0);
  }
  return data;
}
