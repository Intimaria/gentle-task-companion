export type DailyEntry = {
  id?: number;
  user_id?: string;
  date: string; // YYYY-MM-DD
  mood: string | null;

};

export type Task = {
  id?: number;         
  entry_id: number;    
  text: string;
  status: string;
};

export type Gratitude = {
  id?: number;         
  entry_id: number;    
  text: string;
};