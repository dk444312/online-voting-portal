
import React, { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../services/supabase';
import type { Voter, Candidate, Selections, Settings } from '../types';
import LoadingSpinner from './LoadingSpinner';
import CandidateOption from './CandidateOption';
import ProgressBar from './ProgressBar';

interface VotingProps {
    voter: Voter;
    onVoteSuccess: () => void;
}

const Voting: React.FC<VotingProps> = ({ voter, onVoteSuccess }) => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [positions, setPositions] = useState<string[]>([]);
    const [selections, setSelections] = useState<Selections>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        setSelections(prev => ({
            ...prev,
            [position]: candidateId,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Check deadline again before submitting
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

            // FIX: Use type guard to ensure all positions are filled and get correct types.
            const filledPositions = Object.values(selections).filter((val): val is number => val !== null);
            if (filledPositions.length !== positions.length) {
                alert('Please select a candidate for each position before submitting.');
                setIsSubmitting(false);
                return;
            }

            const votes = filledPositions.map(candidateId => ({
                voter_id: voter.id,
                candidate_id: candidateId,
            }));

            // FIX: Cast to 'any' because Supabase client is not strongly typed without schema definitions.
            const { error: voteError } = await supabaseClient.from('votes').insert(votes as any);
            if (voteError) throw voteError;

            // FIX: Cast to 'any' because Supabase client is not strongly typed without schema definitions.
            const { error: updateError } = await supabaseClient
                .from('voters')
                .update({ has_voted: true } as any)
                .eq('id', voter.id);

            if (updateError) throw updateError;

            onVoteSuccess();
        } catch (err: any) {
            alert('Error submitting vote: ' + err.message);
            setError('Error submitting vote: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCount = Object.values(selections).filter(s => s !== null).length;

    if (isLoading) {
        return (
            <section className="bg-white border border-slate-200 rounded-xl p-10 shadow-xl text-center text-slate-500 font-medium">
                <LoadingSpinner />
                <p>Loading candidates...</p>
            </section>
        );
    }
    
    if (error) {
         return (
            <section className="bg-white border border-slate-200 rounded-xl p-10 shadow-xl text-center text-red-500">
                {error}
            </section>
        );
    }

    return (
        <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-10 shadow-xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 animate-fadeInUp">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-800 via-blue-500 to-blue-400"></div>
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-800 text-center mb-4">
                <i className="fas fa-ballot-check text-blue-500 mr-3"></i>
                Cast Your Vote
            </h2>
            <div className="bg-emerald-500/10 p-5 rounded-lg mb-8 border border-emerald-500/20">
                <p className="text-slate-800 font-medium text-center">
                    <i className="fas fa-shield-alt text-emerald-500 mr-2"></i> 
                    Select one candidate for each position. Your vote is anonymous and secure.
                </p>
            </div>
            
            <ProgressBar total={positions.length} current={selectedCount} />
             <p className="text-center text-slate-500 mb-8 font-medium">
                Complete your selections: {selectedCount} of {positions.length} positions
            </p>

            <form onSubmit={handleSubmit}>
                 {positions.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No candidates are available for voting at this time.</p>
                ) : (
                    positions.map(position => (
                        <div key={position} className="mb-8 p-6 bg-slate-50 rounded-xl border-l-4 border-blue-500">
                            <h3 className="text-xl font-semibold text-slate-800 mb-4 pb-3 border-b-2 border-blue-500">
                                <i className="fas fa-users mr-3 text-blue-500/80"></i>{position}
                            </h3>
                            <div className="space-y-4">
                                {candidates.filter(c => c.position === position).map(candidate => (
                                    <CandidateOption
                                        key={candidate.id}
                                        candidate={candidate}
                                        isSelected={selections[position] === candidate.id}
                                        onSelect={() => handleSelectCandidate(position, candidate.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}

                {positions.length > 0 && (
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full max-w-md mx-auto flex justify-center items-center gap-3 p-4 bg-blue-800 text-white rounded-lg font-semibold uppercase tracking-wider transition-all duration-300 hover:bg-blue-900 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                    >
                        {isSubmitting ? <LoadingSpinner /> : <i className="fas fa-paper-plane"></i>}
                        {isSubmitting ? 'Submitting...' : 'Submit My Votes'}
                    </button>
                )}
            </form>
        </section>
    );
};

export default Voting;