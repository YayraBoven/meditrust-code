import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppFrame } from './components/Shell';
import { CheckInput, Confirm, NoMatch, Prescribed, Running } from './screens/Check';
import Help from './screens/Help';
import History from './screens/History';
import Home from './screens/Home';
import Profile from './screens/Profile';
import Result from './screens/Result';
import Summary from './screens/Summary';
import Welcome from './screens/Welcome';
import { useApp } from './store/useApp';

function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const onboarded = useApp((s) => s.onboarded);
  return onboarded ? <>{children}</> : <Navigate to="/app/welcome" replace />;
}

function AppRoutes() {
  const location = useLocation();
  const guard = (el: ReactNode) => (
    <RequireOnboarding>
      <Page>{el}</Page>
    </RequireOnboarding>
  );
  return (
    <AppFrame>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="welcome" element={<Page><Welcome /></Page>} />
          <Route index element={guard(<Home />)} />
          <Route path="profile" element={guard(<Profile />)} />
          <Route path="check" element={guard(<CheckInput />)} />
          <Route path="check/confirm" element={guard(<Confirm />)} />
          <Route path="check/no-match" element={guard(<NoMatch />)} />
          <Route path="check/prescribed" element={guard(<Prescribed />)} />
          <Route path="check/running" element={guard(<Running />)} />
          <Route path="result/:id" element={guard(<Result />)} />
          <Route path="summary/:id" element={guard(<Summary />)} />
          <Route path="history" element={guard(<History />)} />
          <Route path="help" element={guard(<Help />)} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AnimatePresence>
    </AppFrame>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/app/*" element={<AppRoutes />} />
      {/* The laptop landing page comes in the next milestone; until then "/" opens the app. */}
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
