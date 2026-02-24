/**
 * 设备/运行环境检测（仅依赖 navigator，用于 UI 适配 iPad / 平板 / iOS）
 * 不依赖 Electron/Capacitor，可在任意前端使用。
 */

const hasWindow = () => typeof window !== 'undefined' && typeof navigator !== 'undefined';

/** 是否 iOS（含 iPhone、iPad） */
export function isIOS() {
  if (!hasWindow()) return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** 是否 iPad（含 iPadOS 13+ 的 Safari 识别为 Mac 的情况） */
export function isIPad() {
  if (!hasWindow()) return false;
  return /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** 是否平板类设备（iPad、Android 平板等） */
export function isTablet() {
  if (!hasWindow()) return false;
  return isIPad() || /Android.*(Tablet|Pad)/i.test(navigator.userAgent);
}

/** 是否移动端（手机或平板） */
export function isMobileOrTablet() {
  if (!hasWindow()) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isTablet();
}
