/**
 * Capacitor 配置 - 用于打包为 iOS/iPadOS 原生应用
 * 构建：npm run build:react && npx cap sync ios
 * 在 Mac 上打开 Xcode：npx cap open ios
 */
const config = {
  appId: 'com.personalbutler.app',
  appName: 'Personal Butler',
  webDir: 'dist',
  server: {
    // 开发时可选：从本机服务器加载，便于调试
    // url: 'http://192.168.x.x:3000',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
    },
  },
};

module.exports = config;
