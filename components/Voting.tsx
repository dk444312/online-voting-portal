// Voting.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../services/supabase';
import type { Voter, Candidate, Selections, Settings } from '../types';
import LoadingSpinner from './LoadingSpinner';
import CandidateOption from './CandidateOption';
import ProgressBar from './ProgressBar';

/* --------------------------------------------------------------
   1. HELPER: Format date/time in CAT (Blantyre, Malawi)
   -------------------------------------------------------------- */
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Blantyre',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return date.toLocaleString('en-GB', options).replace(',', '');
};

/* --------------------------------------------------------------
   2. MAIN VOTING COMPONENT
   -------------------------------------------------------------- */
interface VotingProps {
  voter: Voter;
  onVoteSuccess: () => void;
  onLogout: () => void;
}

const Voting: React.FC<VotingProps> = ({ voter, onVoteSuccess, onLogout }) => {
  // ────── State ──────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [submitTime, setSubmitTime] = useState<Date | null>(null);

  // ────── Load candidates ──────
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

      const uniquePositions = [...new Set(data.map(c => c.position))];
      setPositions(uniquePositions);
      setCandidates(data);

      const init: Selections = {};
      uniquePositions.forEach(p => (init[p] = null));
      setSelections(init);
    } catch (err: any) {
      setError(`Failed to load candidates: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // ────── Handlers ──────
  const selectCandidate = (pos: string, id: number) => {
    setSelections(s => ({ ...s, [pos]: id }));
    setSkipped(prev => {
      const n = new Set(prev);
      n.delete(pos);
      return n;
    });
  };

  const toggleSkip = (pos: string) => {
    setSkipped(prev => {
      const n = new Set(prev);
      if (n.has(pos)) {
        n.delete(pos);
      } else {
        n.add(pos);
        setSelections(s => ({ ...s, [pos]: null }));
      }
      return n;
    });
  };

  const next = () => currentPage < positions.length && setCurrentPage(p => p + 1);
  const back = () => currentPage > 0 && setCurrentPage(p => p - 1);

  const submitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: settings } = await supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'voting_deadline')
        .single();

      if (settings && new Date() > new Date(settings.value)) {
        alert('Voting has ended.');
        return;
      }

      const filled = Object.values(selections).filter((v): v is number => v !== null);
      if (filled.length !== positions.length) {
        alert('Please complete every position.');
        return;
      }

      const votes = filled.map(id => ({ voter_id: voter.id, candidate_id: id }));
      const { error: voteErr } = await supabaseClient.from('votes').insert(votes);
      if (voteErr) throw voteErr;

      const { error: voterErr } = await supabaseClient
        .from('voters')
        .update({ has_voted: true })
        .eq('id', voter.id);
      if (voterErr) throw voterErr;

      setSubmitTime(new Date());
      setShowSummary(true);
    } catch (err: any) {
      alert('Submission failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ────── Derived values ──────
  const currentPos = positions[currentPage];
  const selectedCount = Object.values(selections).filter(v => v !== null).length;
  const completedCount = selectedCount + skipped.size;
  const isLastPage = currentPage === positions.length;
  const isFirstPage = currentPage === 0;
  const canProceed = currentPos
    ? selections[currentPos] !== null || skipped.has(currentPos)
    : true;

  // ────── Early returns ──────
  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (positions.length === 0) return <EmptyScreen />;

  // ────── Render ──────
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 to-gray-100">
      {/* ==================== FIXED LOGOUT BUTTON (TOP-RIGHT) ==================== */}
      <button
        onClick={onLogout}
        className="fixed top-4 right-4 z-50 
                   flex items-center gap-2 
                   px-4 py-2 
                   bg-white/90 backdrop-blur-sm 
                   text-red-600 text-sm font-medium 
                   rounded-full shadow-lg 
                   hover:bg-red-50 hover:shadow-xl 
                   transition-all duration-200"
        aria-label="Logout"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>

      {/* ==================== WELCOME MODAL ==================== */}
      {showWelcome && (
        <WelcomeModal
          voterName={voter.name}
          onStart={() => setShowWelcome(false)}
        />
      )}

      {/* ==================== VOTING SUMMARY ==================== */}
      {showSummary && submitTime && (
        <SummaryModal
          voter={voter}
          positions={positions}
          selections={selections}
          skipped={skipped}
          candidates={candidates}
          submitTime={submitTime}
          onContinue={() => {
            setShowSummary(false);
            onVoteSuccess();
          }}
        />
      )}

      {/* ==================== MAIN VOTING UI ==================== */}
      {!showSummary && (
        <div className="pt-16 pb-8 px-4">
          <div className="max-w-3xl mx-auto">

            {/* Progress */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-2">
                <span>Question {currentPage + 1} of {positions.length + 1}</span>
                <span className="font-medium">{completedCount} of {positions.length} completed</span>
              </div>
              <ProgressBar total={positions.length + 1} current={currentPage + 1} />
            </div>

            <form onSubmit={submitVote}>
              {/* Question Page */}
              {!isLastPage ? (
                <QuestionPage
                  position={currentPos}
                  candidates={candidates.filter(c => c.position === currentPos)}
                  selectedId={selections[currentPos]}
                  isSkipped={skipped.has(currentPos)}
                  onSelect={id => selectCandidate(currentPos, id)}
                  onSkip={() => toggleSkip(currentPos)}
                />
              ) : (
                <ReviewPage
                  positions={positions}
                  selections={selections}
                  skipped={skipped}
                  candidates={candidates}
                  onEdit={setCurrentPage}
                />
              )}

              {/* Navigation */}
              <Navigation
                isFirst={isFirstPage}
                isLast={isLastPage}
                canProceed={canProceed}
                isSubmitting={isSubmitting}
                selectedCount={selectedCount}
                totalPositions={positions.length}
                onBack={back}
                onNext={next}
              />
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* --------------------------------------------------------------
   3. SMALL REUSABLE UI COMPONENTS
   -------------------------------------------------------------- */
const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
      <LoadingSpinner />
      <p className="mt-4 text-gray-600 font-medium">Loading election...</p>
    </div>
  </div>
);

const ErrorScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
      <p className="text-red-600 font-medium">{message}</p>
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

const WelcomeModal = ({ voterName, onStart }: { voterName: string; onStart: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-fadeIn">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
        2025 Finale Dinner Awards
      </h1>
      <p className="text-gray-700 mb-5">
        Welcome, <strong className="text-blue-700">{voterName}</strong>!
      </p>
      <button
        onClick={onStart}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg text-sm"
      >
        Start Voting
      </button>
    </div>
  </div>
);

const SummaryModal = ({
  voter,
  positions,
  selections,
  skipped,
  candidates,
  submitTime,
  onContinue,
}: {
  voter: Voter;
  positions: string[];
  selections: Selections;
  skipped: Set<string>;
  candidates: Candidate[];
  submitTime: Date;
  onContinue: () => void;
}) => (
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
            const cand = candidates.find(c => c.id === selections[pos]);
            const skippedPos = skipped.has(pos);
            return (
              <div key={pos} className="flex justify-between items-center p-2 bg-white rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 text-xs">{pos}</p>
                  <p className="text-gray-600">{skippedPos ? 'Skipped' : cand?.name || '—'}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    skippedPos ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {skippedPos ? 'Abstained' : 'Voted'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-gray-500">
        <p><strong>Voter:</strong> {voter.name}</p>
        <p><strong>Submitted:</strong> {formatDate(submitTime)} (CAT)</p>
      </div>

      <button
        onClick={onContinue}
        className="w-full mt-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg text-sm"
      >
        Continue
      </button>
    </div>
  </div>
);

const QuestionPage = ({
  position,
  candidates,
  selectedId,
  isSkipped,
  onSelect,
  onSkip,
}: {
  position: string;
  candidates: Candidate[];
  selectedId: number | null;
  isSkipped: boolean;
  onSelect: (id: number) => void;
  onSkip: () => void;
}) => (
  <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 mb-6">
    <h2 className="text-lg sm:text-xl font-medium text-gray-900 mb-5 flex items-center">
      {position} <span className="text-red-500 ml-1">Required</span>
    </h2>
    <div className="space-y-3">
      {candidates.map(c => (
        <CandidateOption
          key={c.id}
          candidate={c}
          isSelected={selectedId === c.id}
          onSelect={() => onSelect(c.id)}
        />
      ))}
    </div>
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={onSkip}
        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-all ${
          isSkipped
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {isSkipped ? 'Skipped' : 'Skip this position'}
      </button>
    </div>
  </div>
);

const ReviewPage = ({
  positions,
  selections,
  skipped,
  candidates,
  onEdit,
}: {
  positions: string[];
  selections: Selections;
  skipped: Set<string>;
  candidates: Candidate[];
  onEdit: (idx: number) => void;
}) => (
  <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 mb-6">
    <h2 className="text-lg sm:text-xl font-medium text-gray-900 mb-5">Review Your Selections</h2>
    <div className="space-y-3">
      {positions.map((pos, i) => {
        const cand = candidates.find(c => c.id === selections[pos]);
        const skippedPos = skipped.has(pos);
        return (
          <div
            key={pos}
            className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
          >
            <div>
              <p className="font-medium text-gray-900 text-sm">{pos}</p>
              <p className="text-xs text-gray-700 mt-0.5">
                {skippedPos ? 'Skipped' : cand?.name || 'Not selected'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(i)}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
            >
              Edit
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

const Navigation = ({
  isFirst,
  isLast,
  canProceed,
  isSubmitting,
  selectedCount,
  totalPositions,
  onBack,
  onNext,
}: {
  isFirst: boolean;
  isLast: boolean;
  canProceed: boolean;
  isSubmitting: boolean;
  selectedCount: number;
  totalPositions: number;
  onBack: () => void;
  onNext: () => void;
}) => (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 rounded-b-2xl flex justify-between items-center shadow-sm">
    <button
      type="button"
      onClick={onBack}
      disabled={isFirst}
      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
        isFirst ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-white'
      }`}
    >
      Back
    </button>

    {isLast ? (
      <button
        type="submit"
        disabled={isSubmitting || selectedCount < totalPositions}
        className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 shadow-md transition-all ${
          isSubmitting || selectedCount < totalPositions
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
        onClick={onNext}
        disabled={!canProceed}
        className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all ${
          canProceed
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        Next
      </button>
    )}
  </div>
);

export default Voting;