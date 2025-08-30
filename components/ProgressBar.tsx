
import React from 'react';

interface ProgressBarProps {
    total: number;
    current: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ total, current }) => {
    const progressPercentage = total > 0 ? (current / total) * 100 : 0;

    return (
        <div className="bg-slate-200 h-2.5 rounded-full my-4 max-w-md mx-auto overflow-hidden">
            <div
                className="h-full bg-gradient-to-r from-blue-800 to-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
            ></div>
        </div>
    );
};

export default ProgressBar;
