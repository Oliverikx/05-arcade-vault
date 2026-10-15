export interface User {
  name: string;
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

export const USER_KEY = "av_user";
export const SCORES_KEY = "av_scores";
