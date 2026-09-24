-- Setup's "Keep my word on 85% of days" goal, saved before it could be measured, is now read from
-- the days themselves. (A separate file: a new enum value can't be used in the transaction that
-- adds it.)
update public.yearly_goals
set progress_source = 'keep_word', current_value = null, aggregation = 'latest'
where progress_source = 'manual'
  and goal_type = 'performance'
  and unit = '%'
  and title like 'Keep my word on %';
