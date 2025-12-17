
import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import { Menu, Loader2, Brain } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { LanguageProvider } from './contexts/LanguageContext';
import SynapseBot from './components/SynapseBot';
import OnboardingModal from './components/OnboardingModal';

// --- Lazy Load Components ---
const HomeDashboard = React.lazy(() => import('./components/HomeDashboard'));
const QuizArena = React.lazy(() => import('./components/QuizArena'));
const AdmissionSearch = React.lazy(() => import('./components/AdmissionSearch'));
const StudyTracker = React.lazy(() => import('./components/StudyTracker'));
const QuizBattlePrototype = React.lazy(() => import('./components/QuizBattlePrototype'));
const CourseSection = React.lazy(() => import('./components/CourseSection'));
const ExamPackSection = React.lazy(() => import('./components/ExamPackSection'));
const QuestionBank = React.lazy(() => import('./components/QuestionBank'));
const ProfilePage = React.lazy(() => import('./components/ProfilePage'));
const AdminPage = React.lazy(() => import('./components/AdminPage'));
const LeaderboardPage = React.lazy(() => import('./components/LeaderboardPage'));
const DailyChallengePage = React.lazy(() => import('./components/DailyChallengePage'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400">
    <Loader2 size={40} className="animate-spin text-primary mb-4" />
    <p className="text-xs font-bold tracking-wider">লোড হচ্ছে...</p>
  </div>
);

// Layout Component to handle Navigation and Common UI
const MainLayout: React.FC<{ 
  themeMode: 'light' | 'dark' | 'system', 
  toggleTheme: () => void,
  children: React.ReactNode,
  openSynapse: () => void
}> = ({ themeMode, toggleTheme, children, openSynapse }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isProfileComplete, profileLoading } = useAuth(); // Check profile status & loading state

  // Map paths to Titles
  const getTitle = (pathname: string) => {
    if (pathname.startsWith('/profile/')) return 'প্রোফাইল';
    switch (pathname) {
      case '/dashboard': return 'ধ্রুবক';
      case '/quiz': return 'কুইজ জোন';
      case '/battle': return 'কুইজ ব্যাটল';
      case '/admission': return 'ভর্তি তথ্য';
      case '/tracker': return 'রুটিন';
      case '/courses': return 'কোর্সসমূহ';
      case '/exams': return 'মডেল টেস্ট';
      case '/qbank': return 'প্রশ্ন ব্যাংক';
      case '/profile': return 'প্রোফাইল';
      case '/admin': return 'অ্যাডমিন';
      case '/leaderboard': return 'লিডারবোর্ড';
      case '/challenges': return 'চ্যালেঞ্জ';
      default: return 'ধ্রুবক';
    }
  };

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-200 text-gray-900 dark:text-gray-100">
      {/* Onboarding Overlay: Only show if NOT loading AND profile is incomplete */}
      {!profileLoading && !isProfileComplete && <OnboardingModal />}

      <Navigation 
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        themeMode={themeMode}
        toggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header - Compact Version */}
        <div className="md:hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between transition-colors sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              <Brain size={16} />
            </div>
            <span className="font-bold text-gray-800 dark:text-white text-base tracking-tight">
              {getTitle(location.pathname)}
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors active:scale-95"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Main Content Area with Suspense */}
        <main className="flex-1 overflow-hidden p-0 md:p-6 bg-gray-50 dark:bg-gray-900 transition-colors relative">
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const [isSynapseOpen, setIsSynapseOpen] = useState(false);
  
  // Theme State
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('themeMode');
      return (saved as 'light' | 'dark' | 'system') || 'system';
    }
    return 'system';
  });

  // Apply Theme Effect
  useEffect(() => {
    const applyTheme = () => {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);

      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();
    localStorage.setItem('themeMode', themeMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeMode === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  // Loading State
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-primary">
        <Loader2 size={48} className="animate-spin" />
      </div>
    );
  }

  const openSynapse = () => setIsSynapseOpen(true);

  // Use HashRouter instead of BrowserRouter to avoid path issues on different environments
  return (
    <LanguageProvider>
      <AdminProvider>
        <HashRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={!currentUser ? <LandingPage onLoginClick={() => window.location.hash = '#/auth'} /> : <Navigate to="/dashboard" />} />
            <Route path="/auth" element={!currentUser ? <AuthPage onBack={() => window.location.hash = '#/'} /> : <Navigate to="/dashboard" />} />

            {/* Protected Routes */}
            <Route path="/*" element={
              currentUser ? (
                <MainLayout themeMode={themeMode} toggleTheme={toggleTheme} openSynapse={openSynapse}>
                    <Routes>
                      <Route path="/dashboard" element={<HomeDashboard openSynapse={openSynapse} />} />
                      <Route path="/courses" element={<CourseSection />} />
                      <Route path="/qbank" element={<QuestionBank />} />
                      <Route path="/exams" element={<ExamPackSection />} />
                      <Route path="/quiz" element={<QuizArena />} />
                      <Route path="/battle" element={<QuizBattlePrototype />} />
                      <Route path="/leaderboard" element={<LeaderboardPage />} />
                      <Route path="/tracker" element={<StudyTracker />} />
                      <Route path="/admission" element={<AdmissionSearch />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/profile/:userId" element={<ProfilePage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="/challenges" element={<DailyChallengePage openSynapse={openSynapse} />} />
                      <Route path="*" element={<Navigate to="/dashboard" />} />
                    </Routes>
                </MainLayout>
              ) : (
                <Navigate to="/auth" />
              )
            } />
          </Routes>
          <SynapseBot isOpen={isSynapseOpen} onClose={() => setIsSynapseOpen(false)} />
        </HashRouter>
      </AdminProvider>
    </LanguageProvider>
  );
};

export default App;
