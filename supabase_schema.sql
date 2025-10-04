
-- Create expenses table for storing user financial data
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category text not null,
  amount numeric not null,
  date date not null default now()::date,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster queries by user_id
create index expenses_user_id_idx on expenses(user_id);

-- Create index for faster queries by date
create index expenses_date_idx on expenses(date desc);

-- Enable Row Level Security (RLS)
alter table expenses enable row level security;

-- Create policy so users can only access their own expenses
create policy "Users can only access their own expenses" on expenses
  for all using (auth.uid() = user_id);

-- Grant permissions to authenticated users
grant select, insert, update, delete on expenses to authenticated;
