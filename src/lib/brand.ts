// Verifund mark "V-check": the V's right stroke is the checkmark; the gold dot is the payment landing.
// One source for the header logo, favicon, Apple icon and social image.
export const MARK_PATH = "M15 20 L28 46 L50 15";
export const MARK_GRADIENT = [["0", "#0369a1"], [".55", "#0ea5e9"], ["1", "#10b981"]] as const;

export const markSvg = (size = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${
    MARK_GRADIENT.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")
  }</linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><path d="${MARK_PATH}" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="15" r="4.2" fill="#fde68a"/></svg>`;

export const markDataUri = (size = 64) => `data:image/svg+xml;base64,${Buffer.from(markSvg(size)).toString("base64")}`;
