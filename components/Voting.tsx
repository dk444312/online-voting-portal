import React, { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../services/supabase';
import type { Voter, Candidate, Selections } from '../types';
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

      const votes = Object.entries(selections)
        .filter(([_, id]) => id !== null)
        .map(([_, id]) => ({ voter_id: voter.id, candidate_id: id as number }));

      if (votes.length > 0) {
        const { error: voteErr } = await supabaseClient.from('votes').insert(votes);
        if (voteErr) throw voteErr;
      }

      const { error: voterErr } = await supabaseClient
        .from('voters')
        .update({ has_voted: true })
        .eq('id', voter.id);
      if (voterErr) throw voterErr;

      onVoteSuccess();
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
    <>
      {/* Google-style global styles injected via Tailwind */}
      <div className="min-h-screen bg-gray-50 font-sans antialiased">
        {/* ==================== FIXED LOGOUT BUTTON ==================== */}
        <button
          onClick={onLogout}
          className="fixed top-4 right-4 z-50 
                     flex items-center gap-2 
                     px-4 py-2 
                     bg-white 
                     text-red-600 text-sm font-medium 
                     rounded-full shadow-md 
                     hover:shadow-lg hover:bg-red-50 
                     transition-all duration-200 
                     border border-gray-200"
          aria-label="Logout"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>

        {/* ==================== WELCOME MODAL (Google-style) ==================== */}
        {showWelcome && (
          <WelcomeModal
            voterName={voter.name}
            onStart={() => setShowWelcome(false)}
          />
        )}

        {/* ==================== MAIN VOTING UI ==================== */}
        {!showWelcome && (
          <div className="pt-16 pb-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">

              {/* Progress Card */}
              <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:justify-between text-sm text-gray-600 mb-3">
                  <span className="font-medium">Question {currentPage + 1} of {positions.length}</span>
                  <span className="text-gray-500">{completedCount} of {positions.length} completed</span>
                </div>
                <ProgressBar total={positions.length} current={currentPage} />
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
                  onBack={back}
                  onNext={next}
                />
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/* --------------------------------------------------------------
   3. REUSABLE UI COMPONENTS (Google Material Style)
   -------------------------------------------------------------- */
const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
      <LoadingSpinner />
      <p className="mt-4 text-gray-600 font-medium">Loading election...</p>
    </div>
  </div>
);

const ErrorScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
      <p className="text-red-600 font-medium">{message}</p>
    </div>
  </div>
);

const EmptyScreen = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-sm p-8 max-w-2xl w-full text-center border border-gray-200">
      <p className="text-gray-600">No candidates available.</p>
    </div>
  </div>
);

const WelcomeModal = ({ voterName, onStart }: { voterName: string; onStart: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center border border-gray-200 animate-in fade-in zoom-in duration-200">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
        2025 Finale Dinner Awards Voting
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Welcome, <strong className="text-blue-600">{voterName}</strong>!<br />
        Cast your vote for the winners in each category.
      </p>
      <button
        onClick={onStart}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-md transition-all text-sm"
      >
        Start Voting
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
  <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 mb-6 border border-gray-200">
    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
      {position}
    </h2>
    <p className="text-xs text-gray-500 mb-5">Select one candidate or skip</p>

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

    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
      <button
        type="button"
        onClick={onSkip}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
          isSkipped
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {isSkipped ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Skipped
          </>
        ) : (
          'Skip this position'
        )}
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
  <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 mb-6 border border-gray-200">
    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-5">Review Your Votes</h2>
    <div className="space-y-3">
      {positions.map((pos, i) => {
        const cand = candidates.find(c => c.id === selections[pos]);
        const skippedPos = skipped.has(pos);
        return (
          <div
            key={pos}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900 text-sm">{pos}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {skippedPos ? 'Skipped' : cand?.name || 'Not selected'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(i)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
  onBack,
  onNext,
}: {
  isFirst: boolean;
  isLast: boolean;
  canProceed: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
}) => (
  <div className="bg-white px-5 py-4 rounded-b-2xl flex justify-between items-center shadow-sm border-t border-gray-200">
    <button
      type="button"
      onClick={onBack}
      disabled={isFirst}
      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
        isFirst
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      Back
    </button>

    {isLast ? (
      <button
        type="submit"
        disabled={isSubmitting}
        className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 shadow-md transition-all ${
          isSubmitting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
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
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        Next
      </button>
    )}
  </div>
);

export default Voting;