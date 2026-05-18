import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Supabase Todos List</h1>
      <ul>
        {todos?.map((todo) => (
          <li key={todo.id}>{todo.name}</li>
        ))}
      </ul>
      {(!todos || todos.length === 0) && <p>No todos found. If you just set up your database, make sure you have created a <code>todos</code> table with a <code>name</code> column.</p>}
    </div>
  )
}
