/**
 * 平台 API 统一入口
 * 根据环境选择 Electron / Web / Capacitor，便于扩展 iPad、Android 等
 */

import * as electronImpl from './electron';
import * as webImpl from './web';
import * as capacitorImpl from './capacitor';
import { isIOS, isIPad, isTablet, isMobileOrTablet } from './device';

const hasElectronAPI = () => typeof window !== 'undefined' && !!window.electronAPI;
const hasCapacitor = () => typeof window !== 'undefined' && !!window.Capacitor;

const platform = hasCapacitor() ? capacitorImpl : hasElectronAPI() ? electronImpl : webImpl;

/** 当前是否为 Web 浏览器环境（含 iPad Safari） */
export const isWeb = () => !hasElectronAPI() && !hasCapacitor();
/** 当前是否为 Capacitor 容器（iOS/Android App） */
export const isCapacitor = () => hasCapacitor();

export const getAppVersion = platform.getAppVersion;
export const getUserDataPath = platform.getUserDataPath;
export const getDatabasePath = platform.getDatabasePath;

export const dbInit = platform.dbInit;
export const dbQuery = platform.dbQuery;
export const dbExecute = platform.dbExecute;

export const log = platform.log;

export const fetchCalendarData = platform.fetchCalendarData;
export const fetchUrl = platform.fetchUrl;
export const fetchJsonPost = platform.fetchJsonPost;

export const showReminderNotification = platform.showReminderNotification;
export const scheduleLocalNotification = platform.scheduleLocalNotification;
export const cancelLocalNotification = platform.cancelLocalNotification;
export const requestPermission = platform.requestPermission;
export const upsertTodo = platform.upsertTodo;
export const deleteTodo = platform.deleteTodo;
export const upsertCalendarEvent = platform.upsertCalendarEvent;
export const deleteCalendarEvent = platform.deleteCalendarEvent;
export const selectImageFile = platform.selectImageFile;
export const selectMediaFile = platform.selectMediaFile;
export const startAudioRecording = platform.startAudioRecording;
export const stopAudioRecording = platform.stopAudioRecording;
export const cancelAudioRecording = platform.cancelAudioRecording;

export const apiBridgeRestart = platform.apiBridgeRestart;
export const readApiBridgeDoc = platform.readApiBridgeDoc;

export const syncExportData = platform.syncExportData;
export const syncImportData = platform.syncImportData;
export const syncOpenOAuthLogin = platform.syncOpenOAuthLogin ?? platform.syncOnedriveOpenLogin;
export const syncOnedriveOpenLogin = platform.syncOnedriveOpenLogin ?? platform.syncOpenOAuthLogin;
export const syncSaveEncryptionPassword = platform.syncSaveEncryptionPassword;
export const syncGetEncryptionPassword = platform.syncGetEncryptionPassword;
export const syncClearEncryptionPassword = platform.syncClearEncryptionPassword;

export const isElectron = platform.isElectron;

/** 设备类型（用于 iPad/平板/移动端 UI 适配） */
export { isIOS, isIPad, isTablet, isMobileOrTablet };

export default platform;
