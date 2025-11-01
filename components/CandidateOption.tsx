import React from 'react';
import type { Candidate } from '../types';

interface CandidateOptionProps {
  candidate: Candidate;
  isSelected: boolean;
  onSelect: () => void;
}

const CandidateOption: React.FC<CandidateOptionProps> = ({
  candidate,
  isSelected,
  onSelect,
}) => {
  const selectedClasses = isSelected
    ? 'bg-blue-500/5 border-blue-500 ring-2 ring-blue-500/20'
    : 'bg-white hover:bg-slate-50 hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-md';

  return (
    <div
      onClick={onSelect}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      tabIndex={0}
      role="radio"
      aria-checked={isSelected}
      className={`flex items-center p-5 border-2 border-slate-200 rounded-xl cursor-pointer transition-all duration-300 ${selectedClasses}`}
    >
      <img
        src={candidate.photo_url}
        alt={candidate.name}
        onError={e => {
          const t = e.target as HTMLImageElement;
          t.onerror = null;
          t.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E`;
        }}
        className="w-16 h-16 rounded-lg mr-5 object-cover border-2 border-slate-200"
      />
      <div className="flex-grow">
        <div className="font-semibold text-lg text-slate-800">{candidate.name}</div>
        <small className="text-slate-500">Running for {candidate.position}</small>
      </div>
      <div
        className="ml-5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200"
        style={{ borderColor: isSelected ? '#3b82f6' : '#e2e8f0' }}
      >
        {isSelected && <div className="w-3 h-3 bg-blue-500 rounded-full"></div>}
      </div>
    </div>
  );
};

export default CandidateOption;
