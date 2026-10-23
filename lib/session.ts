export interface User {
  id: string;
  email: string | null;
  name: string | null; // user_metadata.username; null until picked (OAuth first login)
}

// Legacy fake-identity key; only used to remove the stale entry.
export const USER_KEY = "av_user";
