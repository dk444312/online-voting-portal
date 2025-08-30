
import React from 'react';

interface HeaderProps {
    showLogout: boolean;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ showLogout, onLogout }) => {
    return (
        <header className="flex justify-between items-center mb-5 relative">
            <h1 className="flex-grow text-center text-3xl md:text-4xl font-bold text-blue-800">
                <i className="fas fa-vote-yea text-blue-500 mr-4"></i>
                Online Voting Portal
            </h1>
            {showLogout && (
                 <button 
                    onClick={onLogout} 
                    className="absolute top-1/2 right-0 -translate-y-1/2 bg-none border-none text-slate-500 text-sm font-medium py-2 px-3 rounded-md transition-all duration-200 hover:text-red-500 hover:bg-slate-100"
                    aria-label="Logout"
                >
                    <i className="fas fa-sign-out-alt mr-1"></i> Logout
                </button>
            )}
        </header>
    );
};

export default Header;
