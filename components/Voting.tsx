import React, { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../services/supabase';
import type { Voter, Candidate, Selections, Settings } from '../types';
import LoadingSpinner from './LoadingSpinner';
import CandidateOption from './CandidateOption';
import ProgressBar from './ProgressBar';
import { format } from 'date-fns';

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
  const [showSummary, setShowSummary] = useState(false); // NEW: Summary modal
  const [submitTime, setSubmitTime] = useState<Date | null>(null); // NEW: Timestamp

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
    if (currentPage < positions.length) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
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
        alert('Voting has ended. Your vote cannot be submitted.');
        setIsSubmitting(false);
        return;
      }

      const filledPositions = Object.values(selections).filter((val): val is number => val !== null);
      if (filledPositions.length !== positions.length) {
        alert('Please complete all positions before submitting.');
        setIsSubmitting(false);
        return;
      }

      const votes = filledPositions.map(candidateId => ({
        voter_id: voter.id,
        candidate_id: candidateId,
      }));

      const { error: voteError } = await supabaseClient.from('votes').insert(votes as any);
      if (voteError) throw voteError;

      const { error: updateError } = await supabaseClient
        .from('voters')
        .update({ has_voted: true } as any)
        .eq('id', voter.id);
      if (updateError) throw updateError;

      // Record submission time
      const now = new Date();
      setSubmitTime(now);

      // Show summary instead of navigating away
      setShowSummary(true);
    } catch (err: any) {
      alert('Error submitting vote: ' + err.message);
      setError('Error submitting vote: ' + err.message);
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

  // Loading / Error / Empty
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600 font-medium">Loading election...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl w-full text-center">
          <p className="text-gray-600">No candidates are available for voting at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ==================== WELCOME MODAL ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-fadeIn">
            <h1 className="text-3xl md:text-4xl font-bold text-center text-blue-900 mb-4">
              2025 Finale Dinner Awards Voting
            </h1>
            <p className="text-gray-700 text-center mb-6 leading-relaxed">
              Welcome, <span className="font-bold text-blue-700">{voter.name}</span>!<br />
              You are now casting your vote for the annual awards.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg"
              >
                Start Voting
              </button>
              <button
                onClick={onLogout}
                className="px-8 py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== VOTING SUMMARY MODAL ==================== */}
      {showSummary && submitTime && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Vote Submitted Successfully!</h2>
              <p className="text-gray-600 mt-2">Your vote has been recorded securely.</p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
              <h3 className="font-semibold text-lg text-gray-800 mb-4">Your Voting Summary</h3>
              <div className="space-y-3">
                {positions.map(pos => {
                  const selectedCandidate = candidates.find(c => c.id === selections[pos]);
                  const isSkipped = skipped.has(pos);
                  return (
                    <div key={pos} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                      <div>
                        <p className="font-medium text-gray-900">{pos}</p>
                        <p className="text-sm text-gray-600">
                          {isSkipped ? (
                            <span className="text-orange-600 font-medium">Skipped</span>
                          ) : (
                            selectedCandidate?.name || '—'
                          )}
                        </p>
                      </div>
                      {isSkipped ? (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Abstained</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Voted</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center text-sm text-gray-500 space-y-1">
              <p><strong>Voter:</strong> {voter.name}</p>
              <p><strong>Submitted on:</strong> {format(submitTime, 'PPP')}</p>
              <p><strong>Time:</strong> {format(submitTime, 'p')} (CAT)</p>
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => {
                  setShowSummary(false);
                  onVoteSuccess(); // Navigate to thank you / dashboard
                }}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition shadow-md"
              >
                Continue
              </button>
              <button
                onClick={onLogout}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MAIN VOTING UI (only if not submitted) ==================== */}
      {!showSummary && (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 py-8 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-t-2xl shadow-sm border-b border-gray-200 p-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Cast Your Vote</h1>
                <p className="mt-2 text-gray-600">
                  Select one candidate per position. Your vote is secure and anonymous.
                </p>
              </div>
              <button
                onClick={onLogout}
                className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition shadow-md"
              >
                Logout
              </button>
            </div>

            {/* Progress */}
            <div className="bg-white px-6 pt-4 pb-2">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Question {currentPage + 1} of {positions.length + 1}</span>
                <span className="font-medium">{completedCount} of {positions.length} completed</span>
              </div>
              <ProgressBar total={positions.length + 1} current={currentPage + 1} />
            </div>

            <form onSubmit={handleSubmit}>
              {/* Question Page */}
              {!isLastPage ? (
                <div className="bg-white p-6 md:p-10">
                  <div className="max-w-2xl">
                    <h2 className="text-lg md:text-xl font-medium text-gray-900 mb-6 flex items-center">
                      {currentPosition}
                      <span className="text-red-500 ml-1">Required</span>
                    </h2>

                    <div className="space-y-3">
                      {candidates
                        .filter(c => c.position === currentPosition)
                        .map(candidate => (
                          <CandidateOption
                            key={candidate.id}
                            candidate={candidate}
                            isSelected={selections[currentPosition] === candidate.id}
                            onSelect={() => handleSelectCandidate(currentPosition, candidate.id)}
                          />
                        ))}
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleSkip(currentPosition)}
                        className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                          skipped.has(currentPosition)
                            ? 'bg-green-600 text-white hover:bg-green-700 shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {skipped.has(currentPosition) ? (
                          <>Skipped</>
                        ) : (
                          'Skip this position'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Review Page */
                <div className="bg-white p-6 md:p-10">
                  <h2 className="text-xl font-medium text-gray-900 mb-6">Review Your Selections</h2>
                  <div className="space-y-4 max-w-2xl">
                    {positions.map((pos, idx) => {
                      const selectedCandidate = candidates.find(c => c.id === selections[pos]);
                      const isSkipped = skipped.has(pos);
                      return (
                        <div
                          key={pos}
                          className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{pos}</p>
                            <p className="text-sm text-gray-700 mt-1">
                              {isSkipped
                                ? 'Skipped'
                                : selectedCandidate?.name || 'Not selected'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentPage(idx)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 rounded-b-2xl flex justify-between items-center shadow-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isFirstPage}
                  className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                    isFirstPage
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-white shadow-sm'
                  }`}
                >
                  Back
                </button>

                {isLastPage ? (
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedCount < positions.length}
                    className={`px-8 py-3 rounded-xl font-semibold text-white transition-all flex items-center gap-3 shadow-lg ${
                      isSubmitting || selectedCount < positions.length
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Submitting...
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
                    className={`px-8 py-3 rounded-xl font-semibold text-white transition-all shadow-lg ${
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

export default Voting;