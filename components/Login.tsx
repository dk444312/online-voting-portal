
import React, { useState, useEffect } from 'react';
import { supabaseClient } from '../services/supabase';
import type { Voter, Settings } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface LoginProps {
    onLoginSuccess: (voter: Voter) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showInitialLoader, setShowInitialLoader] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowInitialLoader(false);
        }, 3000); 

        return () => clearTimeout(timer);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Please enter both username and password.');
            return;
        }
        setError(null);
        setIsLoading(true);

        try {
            const { data: voters, error: fetchError } = await supabaseClient
                .from('voters')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .returns<Voter[]>();

            if (fetchError) throw fetchError;

            if (!voters || voters.length === 0) {
                setError('Invalid username or password. Please check your credentials.');
                return;
            }

            const voter = voters[0];

            const { data: settings, error: deadlineError } = await supabaseClient
                .from('settings')
                .select('value')
                .eq('key', 'voting_deadline')
                .returns<Pick<Settings, 'value'>[]>();

            if (deadlineError) throw deadlineError;

            if (settings && settings.length > 0 && settings[0].value) {
                const deadline = new Date(settings[0].value);
                if (new Date() > deadline) {
                    setError('Voting has ended. The deadline has passed.');
                    return;
                }
            }

            onLoginSuccess(voter);

        } catch (err: any) {
            setError('Login error: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-10 shadow-xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 animate-fadeInUp">
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-800 via-blue-500 to-blue-400"></div>
             {showInitialLoader ? (
                <div className="flex flex-col items-center justify-center py-16 animate-fadeInDown">
                    <h1 className="text-4xl font-bold text-slate-800 mb-4">Campus Vote</h1>
                    <div className="flex items-center justify-center space-x-3 mt-2">
                        <svg className="animate-spin h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-slate-600 text-lg animate-pulse">authenticating your access</p>
                    </div>
                </div>
             ) : (
                <div className="animate-fadeIn">
                    <h2 className="text-2xl md:text-3xl font-semibold text-slate-800 text-center mb-4">
                        <i className="fas fa-user-lock text-black mr-3"></i>
                        Voter Authentication
                    </h2>
                    <p className="text-center text-slate-500 mb-8">
                        Enter your credentials to access the secure voting system
                    </p>
                    <form onSubmit={handleLogin} className="max-w-md mx-auto">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            autoComplete="username"
                            className="block w-full p-4 mb-5 border-2 border-slate-200 rounded-lg text-base font-medium transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:-translate-y-px"
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="block w-full p-4 mb-5 border-2 border-slate-200 rounded-lg text-base font-medium transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:-translate-y-px"
                        />
                        {error && (
                            <p className="text-center text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg p-3 my-5 font-medium animate-slideInScale">
                                {error}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-3 p-4 bg-black text-white rounded-lg font-semibold uppercase tracking-wider transition-all duration-300 hover:bg-blue-900 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                        >
                            {isLoading ? <LoadingSpinner /> : <i className="fas fa-sign-in-alt"></i>}
                            {isLoading ? 'Logging In...' : 'Login'}
                        </button>
                    </form>
                </div>
             )}
        </section>
    );
};

export default Login;
