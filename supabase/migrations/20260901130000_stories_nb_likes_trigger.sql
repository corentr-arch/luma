-- Maintient stories.nb_likes en phase avec les lignes de stories_likes,
-- de façon atomique côté base (évite les compteurs faux en cas de likes
-- concurrents, contrairement à une mise à jour calculée côté client).
create or replace function stories_maj_nb_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update stories set nb_likes = nb_likes + 1 where id = new.story_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update stories set nb_likes = greatest(0, nb_likes - 1) where id = old.story_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trig_stories_likes_insert on stories_likes;
create trigger trig_stories_likes_insert
  after insert on stories_likes
  for each row execute function stories_maj_nb_likes();

drop trigger if exists trig_stories_likes_delete on stories_likes;
create trigger trig_stories_likes_delete
  after delete on stories_likes
  for each row execute function stories_maj_nb_likes();
