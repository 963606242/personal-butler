/**
 * 本地图片组件：Electron 下将 file:// 路径通过 IPC 转为 base64 显示，解决 webSecurity 开启时无法加载 file:// 的问题
 */
import React, { useState, useEffect } from 'react';
import { readImageFile, isElectron } from '../platform';

function getDisplaySrc(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) return imagePath;
  if (imagePath.startsWith('/') || /^[A-Za-z]:/.test(imagePath)) {
    return isElectron() ? null : `file:///${imagePath.replace(/\\/g, '/')}`;
  }
  return imagePath;
}

export default function LocalImage({ src, alt, className, style, fallback, onError, ...rest }) {
  const [displaySrc, setDisplaySrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!src) {
      setDisplaySrc(null);
      return;
    }
    if (src.startsWith('data:') || src.startsWith('http')) {
      setDisplaySrc(src);
      return;
    }
    if (isElectron() && (src.startsWith('/') || /^[A-Za-z]:/.test(src))) {
      readImageFile(src)
        .then((dataUrl) => setDisplaySrc(dataUrl || null))
        .catch(() => setDisplaySrc(null));
      return;
    }
    setDisplaySrc(getDisplaySrc(src));
  }, [src]);

  if (!displaySrc || failed) {
    return fallback || null;
  }

  return (
    <img
      src={displaySrc}
      alt={alt || ''}
      className={className}
      style={style}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
}
