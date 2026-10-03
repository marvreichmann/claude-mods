export type Stage = { name: string; total: number; done: number }

export type Plan = {
  id: string
  title: string
  stages: Stage[]
  current: number
  status: 'active' | 'done' | 'failed'
}

export type TaskItem = {
  id: string
  subject: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
}

export type TaskList = { title: string; items: TaskItem[] }

declare module 'claude-code' {
  interface PluginState {
    'plan-progress': {
      plans: Record<string, Plan>
      lists: Record<string, TaskList>
      muted: boolean
    }
  }
}
