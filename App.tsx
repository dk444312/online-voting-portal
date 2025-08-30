
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Login from './components/Login';
import Voting from './components/Voting';
import ThankYou from './components/ThankYou';
import type { Voter } from './types';

type View = 'login' | 'voting' | 'thank-you';

const App: React.FC = () => {
    const [view, setView] = useState<View>('login');
    const [voter, setVoter] = useState<Voter | null>(null);

    const handleLoginSuccess = useCallback((loggedInVoter: Voter) => {
        setVoter(loggedInVoter);
        if (loggedInVoter.has_voted) {
            setView('thank-you');
        } else {
            setView('voting');
        }
    }, []);
    
    const handleVoteSuccess = useCallback(() => {
        setView('thank-you');
        setVoter(null); // Clear voter session after voting
    }, []);

    const handleLogout = useCallback(() => {
        setVoter(null);
        setView('login');
    }, []);

    const renderView = () => {
        switch (view) {
            case 'login':
                return <Login onLoginSuccess={handleLoginSuccess} />;
            case 'voting':
                if (voter) {
                    return <Voting voter={voter} onVoteSuccess={handleVoteSuccess} />;
                }
                // Fallback to login if voter is not set
                setView('login');
                return <Login onLoginSuccess={handleLoginSuccess} />;
            case 'thank-you':
                return <ThankYou />;
            default:
                return <Login onLoginSuccess={handleLoginSuccess} />;
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-5 font-sans text-slate-800 relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none z-0">
                 <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_50%,_rgba(30,64,175,0.03)_0%,_transparent_50%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.03)_0%,_transparent_50%),radial-gradient(circle_at_40%_80%,_rgba(96,165,250,0.03)_0%,_transparent_50%)]"></div>
            </div>
            <div className="w-full max-w-3xl z-10">
                <Header showLogout={view !== 'login'} onLogout={handleLogout} />
                <main>
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default App;
