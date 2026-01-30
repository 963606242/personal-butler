import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import './index.css';

window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<div style="padding: 24px; text-align: center; color: #666;">页面加载异常，请刷新重试。</div>';
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <I18nProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </I18nProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('React 渲染错误:', error);
    rootElement.innerHTML = `<div style="padding: 24px; max-width: 480px; margin: 40px auto; text-align: center;">
      <h2 style="color: #333; margin-bottom: 12px;">应用遇到问题</h2>
      <p style="color: #666;">请尝试关闭后重新打开应用。</p>
    </div>`;
  }
}
