import useSettingsStore from '../stores/settingsStore';

const DEFAULT_NAME = 'AI 管家';

/**
 * 获取用户自定义的管家名称，未设置则返回默认「AI 管家」
 * @returns {string}
 */
export function getAssistantName() {
  try {
    const name = useSettingsStore.getState().get('ai_assistant_name');
    return (name && String(name).trim()) || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}
