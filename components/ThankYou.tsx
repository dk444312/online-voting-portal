
import React from 'react';

const ThankYou: React.FC = () => {
    return (
        <section className="bg-white border border-slate-200 rounded-xl p-10 shadow-xl relative overflow-hidden animate-bounceInScale">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300"></div>
            <div className="text-center py-10">
                <i className="fas fa-check-circle text-6xl text-emerald-500 mb-6 block"></i>
                <strong className="text-2xl md:text-3xl text-emerald-600 font-semibold block">
                    Thank You for Voting!
                </strong>
                <p className="text-slate-500 mt-4 max-w-sm mx-auto">
                    Your vote has been securely recorded. You cannot vote again in this election.
                </p>
            </div>
        </section>
    );
};

export default ThankYou;
