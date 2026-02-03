/**
 * 平台 API 接口定义（JSDoc，供文档与实现参考）
 * 所有平台实现（Electron / Web / 未来 Mac/Linux/Android）需提供与此兼容的 API。
 *
 * @typedef {Object} IPlatformAPI
 *
 * @property {() => Promise<string>} getAppVersion - 应用版本号
 * @property {() => Promise<string>} getUserDataPath - 用户数据目录路径
 * @property {() => Promise<string>} getDatabasePath - 数据库文件路径
 *
 * @property {() => Promise<{ success: boolean, error?: string }>} dbInit - 初始化数据库
 * @property {(sql: string, params?: any[]) => Promise<{ success: boolean, data?: any[], error?: string }>} dbQuery - 查询
 * @property {(sql: string, params?: any[]) => Promise<{ success: boolean, data?: any, error?: string }>} dbExecute - 执行
 *
 * @property {(level: string, message: string) => Promise<void>} log - 写日志到平台（如主进程文件）
 *
 * @property {(url: string) => Promise<{ success: boolean, data?: any, status?: number, error?: string, errorBody?: string }>} fetchCalendarData - 日历 API（主进程请求，避 CORS）
 * @property {(url: string) => Promise<{ success: boolean, data?: any, status?: number, errorBody?: string }>} fetchUrl - GET 请求（主进程，避代理问题）
 * @property {(opts: { url: string, body: object, headers?: Record<string, string> }) => Promise<{ success: boolean, data?: any, status?: number, errorBody?: string }>} fetchJsonPost - POST JSON（主进程）
 *
 * @property {(payload: { title: string, body?: string }) => Promise<void>} showReminderNotification - 系统提醒通知（立即触发）
 * @property {(payload: { id: string, title: string, body?: string, at: number, sound?: boolean }) => Promise<{ success: boolean, error?: string }>} scheduleLocalNotification - 定时本地通知（iOS/Android: LocalNotifications；Electron: 可退化为立即通知或后续实现）
 * @property {(id: string) => Promise<{ success: boolean }>} cancelLocalNotification - 取消本地通知
 * @property {(scope: 'notifications' | 'calendar' | 'reminders') => Promise<{ success: boolean, status: 'granted' | 'denied' | 'prompt', error?: string }>} requestPermission - 请求系统权限（通知/日历/提醒事项）
 *
 * @property {(payload: { externalId: string, title: string, notes?: string, dueAt?: number, completed?: boolean }) => Promise<{ success: boolean, systemId?: string, error?: string }>} upsertTodo - 写入系统代办/提醒事项（iOS Reminders / 其他平台可占位）
 * @property {(systemId: string) => Promise<{ success: boolean, error?: string }>} deleteTodo - 删除系统代办
 * @property {(payload: { externalId: string, title: string, notes?: string, startAt: number, endAt: number, location?: string, allDay?: boolean }) => Promise<{ success: boolean, systemId?: string, error?: string }>} upsertCalendarEvent - 写入系统日程（iOS Calendar / 其他平台可占位）
 * @property {(systemId: string) => Promise<{ success: boolean, error?: string }>} deleteCalendarEvent - 删除系统日程
 * @property {() => Promise<{ success: boolean, filePath?: string, canceled?: boolean } | null>} selectImageFile - 选择图片文件；Electron 返回 { success, filePath } 或 { canceled }，Web 返回 null
 *
 * @property {() => Promise<{ success?: boolean, [key: string]: any }>} apiBridgeRestart - 重启 API 桥服务
 * @property {() => Promise<{ success: boolean, content?: string }>} readApiBridgeDoc - 读取 API 说明文档
 */

export {};
