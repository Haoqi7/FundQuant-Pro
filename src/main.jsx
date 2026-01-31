import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GlobalProvider } from './context/GlobalState'

console.log('应用正在启动...'); // 用于调试

const root = ReactDOM.createRoot(document.getElementById('root'));

try {
  root.render(
    <React.StrictMode>
      <GlobalProvider>
        <App />
      </GlobalProvider>
    </React.StrictMode>
  );
  console.log('应用挂载成功');
} catch (error) {
  console.error('应用启动失败:', error);
  document.getElementById('root').innerHTML = '<div style="color:red; padding:20px;">系统启动错误，请查看控制台 (F12)</div>';
}