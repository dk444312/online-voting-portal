
export interface Voter {
  id: number;
  username: string;
  has_voted: boolean;
}

export interface Candidate {
  id: number;
  name: string;
  position: string;
  photo_url: string;
  created_at: string;
}

export interface Vote {
    voter_id: number;
    candidate_id: number;
}

export interface Settings {
    key: string;
    value: string;
}

export type Selections = Record<string, number | null>;
