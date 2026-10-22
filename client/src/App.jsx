import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders } from './context/AppProviders.jsx';
import { MainLayout } from './layouts/MainLayout.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { WorkspacePage } from './pages/WorkspacePage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { TeamAdminPage } from './pages/TeamAdminPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { SubscriptionDetailPage } from './pages/SubscriptionDetailPage.jsx';
import { PlatformAdminPage } from './pages/PlatformAdminPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

export default function App() {
  return <AppProviders><BrowserRouter><Routes>
    <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/app" element={<WorkspacePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/team" element={<TeamAdminPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={['USER']} />}><Route path="/personal" element={<WorkspacePage />} /></Route>
    <Route element={<ProtectedRoute roles={['PLATFORM_ADMIN']} />}><Route path="/platform" element={<PlatformAdminPage />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></AppProviders>;
}
