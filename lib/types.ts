export interface User {
  id: string
  email: string
  name: string | null
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  height: string | null
  location: string | null
  salary: string | null
  fav_quote: string | null
  fav_date_place: string | null
  forty_yard_dash: string | null
  bio: string | null
  photos: string[]
  onboarding_complete: boolean
  created_at: string
}

export interface Prompt {
  id: string
  user_id: string
  question: string
  answer: string
  created_at: string
}

export interface UserWithPrompts extends User {
  prompts: Prompt[]
  two_mans?: User[]
}

export interface TwoManLink {
  id: string
  user1_id: string
  user2_id: string
  requester_id: string
  status: 'pending' | 'accepted'
  created_at: string
  // Joined fields
  user1?: User
  user2?: User
  partner?: User // resolved: whichever side isn't the current user
}

export interface Match {
  id: string
  duo1_user1_id: string
  duo1_user2_id: string
  duo2_user1_id: string
  duo2_user2_id: string
  status: 'pending' | 'matched'
  group_chat_id: string | null
  created_at: string
}

export interface MatchWithUsers extends Match {
  duo1_user1: User
  duo1_user2: User
  duo2_user1: User
  duo2_user2: User
}

export interface Message {
  id: string
  match_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: User
}

export interface DuoNotification {
  id: string
  notified_user_id: string
  triggered_by_user_id: string
  target_user_id: string
  seen: boolean
  created_at: string
  triggered_by?: User
  target?: User
}

export const PROMPT_QUESTIONS = [
  'My idea of a perfect date',
  'The way to my heart is',
  'Biggest green flag',
  "I'm known for",
  'Change my mind about',
  'Ideal double date would be',
]
