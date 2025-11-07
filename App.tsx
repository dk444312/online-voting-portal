import React, { useState, useCallback } from 'react';
import Login from './components/Login';
import Voting from './components/Voting';
import ThankYou from './components/ThankYou';
import type { Voter } from './types';

type View = 'login' | 'voting' | 'thank-you';

const App: React.FC = () => {
  const [view, setView] = useState<View>('login');
  const [voter, setVoter] = useState<Voter | null>(null);

  // ────── Login → Voting / ThankYou ──────
  const handleLoginSuccess = useCallback((loggedInVoter: Voter) => {
    setVoter(loggedInVoter);
    setView(loggedInVoter.has_voted ? 'thank-you' : 'voting');
  }, []);

  // ────── Voting → ThankYou (called from Voting summary) ──────
  const handleVoteSuccess = useCallback(() => {
    setView('thank-you');
  }, []);

  // ────── Logout from any screen (Voting header calls this) ──────
  const handleLogout = useCallback(() => {
    setVoter(null);
    setView('login');
  }, []);

  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />;

      case 'voting':
        if (!voter) {
          setView('login');
          return <Login onLoginSuccess={handleLoginSuccess} />;
        }
        return (
          <Voting
            voter={voter}
            onVoteSuccess={handleVoteSuccess}
            onLogout={handleLogout}   // Voting’s internal Header uses this
          />
        );

      case 'thank-you':
        return <ThankYou onLogout={handleLogout} />;

      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-5 font-sans text-slate-800 relative overflow-hidden">
      {/* Subtle background gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_50%,_rgba(30,64,175,0.03)_0%,_transparent_50%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.03)_0%,_transparent_50%),radial-gradient(circle_at_40%_80%,_rgba(96,165,250,0.03)_0%,_transparent_50%)]"></div>
      </div>

      {/* Main container */}
      <div className="w-full max-w-3xl z-10">
        {/* Header is now **inside Voting**, so we don’t render it here */}
        <main>{renderView()}</main>
      </div>
    </div>
  );
};

export default App;