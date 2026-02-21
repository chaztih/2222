export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  completed: boolean | number;
  photo_url: string | null;
  completed_at: string | null;
}

export interface Task {
  id: number;
  title: string;
  created_at: string;
  subtasks: Subtask[];
}

export interface PhotoEntry extends Subtask {
  task_title: string;
}
