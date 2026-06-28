import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { NotificationListener } from "@/components/NotificationListener";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Teams from "./pages/Teams";
import Tasks from "./pages/Tasks";
import Messages from "./pages/Messages";
import Attendance from "./pages/Attendance";
import Performance from "./pages/Performance";
import Leaderboard from "./pages/Leaderboard";
import Announcements from "./pages/Announcements";
import UsersManagement from "./pages/UsersManagement";
import AdminTaskProvider from "./pages/AdminTaskProvider";
import Deployments from "./pages/Deployments";
import ProjectSubmissions from "./pages/ProjectSubmissions";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();
const App = () => (<QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NotificationListener />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
            <Route path="/login" element={<LoginPage />}/>
            <Route path="/register" element={<RegisterPage />}/>
            <Route path="/auth/callback" element={<OAuthCallback />}/>
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />}/>
              <Route path="/analytics" element={<Analytics />}/>
              <Route path="/announcements" element={<ProtectedRoute requiredPermission="announcements:view"><Announcements /></ProtectedRoute>}/>
              <Route path="/attendance" element={<ProtectedRoute requiredPermission="attendance:view"><Attendance /></ProtectedRoute>}/>
              <Route path="/projects" element={<Projects />}/>
              <Route path="/projects/:projectId" element={<ProjectDetail />}/>
              <Route path="/teams" element={<ProtectedRoute requiredPermission="teams:manage"><Teams /></ProtectedRoute>}/>
              <Route path="/tasks" element={<Tasks />}/>
              <Route path="/performance" element={<ProtectedRoute requiredPermission="performance:view"><Performance /></ProtectedRoute>}/>
              <Route path="/leaderboard" element={<ProtectedRoute requiredPermission="leaderboard:view"><Leaderboard /></ProtectedRoute>}/>
              <Route path="/messages" element={<ProtectedRoute requiredPermission="chat:view"><Messages /></ProtectedRoute>}/>
              <Route path="/deployments" element={<ProtectedRoute requiredPermission="deployments:view"><Deployments /></ProtectedRoute>}/>
              <Route path="/project-submissions" element={<ProtectedRoute requiredPermission="projects:view"><ProjectSubmissions /></ProtectedRoute>}/>
              <Route path="/users" element={<ProtectedRoute requiredPermission="users:manage"><UsersManagement /></ProtectedRoute>}/>
              <Route path="/admin-provider" element={<ProtectedRoute requiredPermission="projects:create"><AdminTaskProvider /></ProtectedRoute>}/>
              <Route path="/settings" element={<Settings />}/>
            </Route>
            <Route path="*" element={<NotFound />}/>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>);
export default App;

