import React, { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../services/supabase';
import type { Voter, Candidate, Selections, Settings } from '../types';
import LoadingSpinner from './LoadingSpinner';
import CandidateOption from './CandidateOption';
import ProgressBar from './ProgressBar';

// ──────────────────────────────────────────────────────────────
//  HEADER – MOBILE-FIRST, PERFECTLY POSITIONED LOGOUT
// ──────────────────────────────────────────────────────────────
const Header: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  return (
    <header className="relative flex items-center justify-center px-4 sm:px-6 mb-8">
      {/* Title – centered */}
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black text-center flex-1">
        Online Voting Portal
      </h1>

      {/* Logout Button – absolute, right-aligned, vertically centered */}
      <button
        onClick={onLogout}
        className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 
                   bg-transparent border-none text-slate-500 text-sm font-medium 
                   py-2 px-3 rounded-md transition-all duration-200 
                   hover:text-red-600 hover:bg-red-50 
                   flex items-center gap-1"
        aria-label="Logout"
      >
        Logout
      </button>
    </header>
  );
};

// ──────────────────────────────────────────────────────────────
//  MAIN VOTING COMPONENT
// ──────────────────────────────────────────────────────────────
interface VotingProps {
  voter: Voter;
  onVoteSuccess: () => void;
  onLogout: () => void;
}

const Voting: React.FC<VotingProps> = ({ voter, onVoteSuccess, onLogout }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(true);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [submitTime, setSubmitTime] = useState<Date | null>(null);

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseClient
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: true })
        .returns<Candidate[]>();

      if (fetchError) throw fetchError;

      if (data) {
        setCandidates(data);
        const uniquePositions = [...new Set(data.map(c => c.position))];
        setPositions(uniquePositions);
        const initialSelections = uniquePositions.reduce((acc, pos) => {
          acc[pos] = null;
          return acc;
        }, {} as Selections);
        setSelections(initialSelections);
      }
    } catch (err: any) {
      setError(`Error loading candidates: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleSelectCandidate = (position: string, candidateId: number) => {
    setSelections(prev => ({ ...prev, [position]: candidateId }));
    setSkipped(prev => {
      const next = new Set(prev);
      next.delete(position);
      return next;
    });
  };

  const toggleSkip = (position: string) => {
    setSkipped(prev => {
      const next = new Set(prev);
      if (next.has(position)) {
        next.delete(position);
        setSelections(s => ({ ...s, [position]: s[position] ?? null }));
      } else {
        next.add(position);
        setSelections(s => ({ ...s, [position]: null }));
      }
      return next;
    });
  };

  const handleNext = () => {
    if (currentPage < positions.length) setCurrentPage(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: settings, error: deadlineError } = await supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'voting_deadline')
        .returns<Pick<Settings, 'value'>[]>();

      if (deadlineError) throw deadlineError;
      if (settings && settings.length > 0 && new Date() > new Date(settings[0].value)) {
        alert('Voting has ended.');
        setIsSubmitting(false);
        return;
      }

      const filled = Object.values(selections).filter((v): v is number => v !== null);
      if (filled.length !== positions.length) {
        alert('Please complete all positions.');
        setIsSubmitting(false);
        return;
      }

      const votes = filled.map(id => ({ voter_id: voter.id, candidate_id: id }));
      const { error: voteError } = await supabaseClient.from('votes').insert(votes as any);
      if (voteError) throw voteError;

      const { error: updateError } = await supabaseClient
        .from('voters')
        .update({ has_voted: true } as any)
        .eq('id', voter.id);
      if (updateError) throw updateError;

      setSubmitTime(new Date());
      setShowSummary(true);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPosition = positions[currentPage];
  const selectedCount = Object.values(selections).filter(s => s !== null).length;
  const completedCount = selectedCount + skipped.size;
  const isLastPage = currentPage === positions.length;
  const isFirstPage = currentPage === 0;
  const isPositionSelected = currentPosition
    ? selections[currentPosition] !== null || skipped.has(currentPosition)
    : true;

  // Loading / Error
  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;
  if (positions.length === 0) return <EmptyScreen />;

  return (
    <>
      {/* ==================== WELCOME MODAL (NO LOGOUT) ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fadeIn">
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-blue-900 mb-3">
              2025 Finale Dinner Awards
            </h1>
            <p className="text-gray-700 text-center text-sm mb-5">
              Welcome, <strong className="text-blue-700">{voter.name}</strong>!
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg text-sm"
            >
              Start Voting
            </button>
          </div>
        </div>
      )}

      {/* ==================== VOTING SUMMARY ==================== */}
      {showSummary && submitTime && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-fadeIn">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Vote Submitted!</h2>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border border-blue-100">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Your Summary</h3>
              <div className="space-y-2 text-xs">
                {positions.map(pos => {
                  const candidate = candidates.find(c => c.id === selections[pos]);
                  const isSkipped = skipped.has(pos);
                  return (
                    <div key={pos} className="flex justify-between items-center p-2 bg-white rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{pos}</p>
                        <p className="text-gray-600">
                          {isSkipped ? 'Skipped' : candidate?.name || '—'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${isSkipped ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {isSkipped ? 'Abstained' : 'Voted'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center text-xs text-gray-500">
              <p><strong>Voter:</strong> {voter.name}</p>
              <p><strong>Submitted:</strong> {format(submitTime, 'PPP p')} (CAT)</p>
            </div>

            <button
              onClick={() => {
                setShowSummary(false);
                onVoteSuccess();
              }}
              className="w-full mt-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg text-sm"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ==================== MAIN UI ==================== */}
      {!showSummary && (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 py-6 px-4">
          <div className="max-w-3xl mx-auto">
            {/* PERFECT MOBILE HEADER */}
            <Header onLogout={onLogout} />

            {/* Progress */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-2">
                <span>Question {currentPage + 1} of {positions.length + 1}</span>
                <span className="font-medium">{completedCount} of {positions.length} completed</span>
              </div>
              <ProgressBar total={positions.length + 1} current={currentPage + 1} />
            </div>

            <form onSubmit={handleSubmit}>
              {/* Question Page */}
              {!isLastPage ? (
                <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 mb-6">
                  <h2 className="text-lg sm:text-xl font-medium text-gray-900 mb-5 flex items-center">
                    {currentPosition} <span className="text-red-500 ml-1">Required</span>
                  </h2>
                  <div className="space-y-3">
                    {candidates
                      .filter(c => c.position === currentPosition)
                      .map(c => (
                        <CandidateOption
                          key={c.id}
                          candidate={c}
                          isSelected={selections[currentPosition] === c.id}
                          onSelect={() => handleSelectCandidate(currentPosition, c.id)}
                        />
                      ))}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => toggleSkip(currentPosition)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-all ${
                        skipped.has(currentPosition)
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {skipped.has(currentPosition) ? 'Skipped' : 'Skip this position'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Review Page */
                <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 mb-6">
                  <h2 className="text-lg sm:text-xl font-medium text-gray-900 mb-5">Review Your Selections</h2>
                  <div className="space-y-3">
                    {positions.map((pos, idx) => {
                      const candidate = candidates.find(c => c.id === selections[pos]);
                      const isSkipped = skipped.has(pos);
                      return (
                        <div
                          key={pos}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
                        >
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{pos}</p>
                            <p className="text-xs text-gray-700 mt-0.5">
                              {isSkipped ? 'Skipped' : candidate?.name || 'Not selected'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentPage(idx)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                          >
                            Edit
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 rounded-b-2xl flex justify-between items-center shadow-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isFirstPage}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isFirstPage ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  Back
                </button>

                {isLastPage ? (
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedCount < positions.length}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 shadow-md transition-all ${
                      isSubmitting || selectedCount < positions.length
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" /> Submitting...
                      </>
                    ) : (
                      'Submit Vote'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isPositionSelected}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all ${
                      isPositionSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// ──────────────────────────────────────────────────────────────
//  HELPER SCREENS
// ──────────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
      <LoadingSpinner />
      <p className="mt-4 text-gray-600 font-medium">Loading election...</p>
    </div>
  </div>
);

const ErrorScreen = ({ error }: { error: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
      <p className="text-red-600 font-medium">{error}</p>
    </div>
  </div>
);

const EmptyScreen = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl w-full text-center">
      <p className="text-gray-600">No candidates available.</p>
    </div>
  </div>
);

export default Voting;