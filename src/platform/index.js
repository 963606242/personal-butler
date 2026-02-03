/**
 * 平台 API 统一入口
 * 根据环境选择 Electron 或 Web 实现，便于后续扩展 Mac / Linux / Android
 */

import * as electronImpl from './electron';
import * as webImpl from './web';
import * as capacitorImpl from './capacitor';

const hasElectronAPI = () => typeof window !== 'undefined' && !!window.electronAPI;
const hasCapacitor = () => typeof window !== 'undefined' && !!window.Capacitor;

const platform = hasCapacitor() ? capacitorImpl : hasElectronAPI() ? electronImpl : webImpl;

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

export const apiBridgeRestart = platform.apiBridgeRestart;
export const readApiBridgeDoc = platform.readApiBridgeDoc;

export const isElectron = platform.isElectron;

export default platform;
