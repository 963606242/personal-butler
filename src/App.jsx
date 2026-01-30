import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { App as AntApp, Layout, Result, Button } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Schedule from './pages/Schedule';
import Habits from './pages/Habits';
import Equipment from './pages/Equipment';
import Clothing from './pages/Clothing';
import Outfits from './pages/Outfits';
import Weather from './pages/Weather';
import News from './pages/News';
import AIChat from './pages/AIChat';
import Countdown from './pages/Countdown';
import Settings from './pages/Settings';
import FunTools from './pages/FunTools';
import { OnboardingProvider } from './context/OnboardingContext';

const { Content } = Layout;

// 错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('应用错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="应用出现错误"
          subTitle={this.state.error?.message || '未知错误'}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <OnboardingProvider>
          <AntApp>
            <MainLayout>
              <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/clothing" element={<Clothing />} />
            <Route path="/outfits" element={<Outfits />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/news" element={<News />} />
            <Route path="/ai" element={<AIChat />} />
            <Route path="/countdown" element={<Countdown />} />
            <Route path="/fun" element={<FunTools />} />
            <Route path="/settings" element={<Settings />} />
              </Routes>
            </MainLayout>
          </AntApp>
        </OnboardingProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
