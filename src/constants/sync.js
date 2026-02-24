/**
 * 同步相关常量
 * 与 Remotely Save 等应用类似：可使用「内置」OAuth 应用，用户无需自行注册 Azure/Google/Dropbox。
 * 构建时通过环境变量注入（如 VITE_ONEDRIVE_CLIENT_ID），未配置则用户需在设置中填写或使用其他同步目标。
 */
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

/** 内置 OneDrive 客户端 ID（构建时 VITE_ONEDRIVE_CLIENT_ID），有值时用户可直接点击「登录并授权」无需 Azure */
export const BUILTIN_ONEDRIVE_CLIENT_ID = (env.VITE_ONEDRIVE_CLIENT_ID || '').trim();

export const HAS_BUILTIN_ONEDRIVE = !!BUILTIN_ONEDRIVE_CLIENT_ID;
