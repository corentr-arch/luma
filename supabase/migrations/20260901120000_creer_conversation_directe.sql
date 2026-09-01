-- RPC sécurisée pour créer une conversation directe entre l'utilisateur connecté
-- et un autre utilisateur. Contourne la RLS de conversation_membres (qui empêche
-- à raison un utilisateur d'insérer une ligne d'adhésion pour quelqu'un d'autre)
-- tout en vérifiant explicitement l'identité de l'appelant.
create or replace function creer_conversation_directe(autre_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if auth.uid() = autre_user_id then
    raise exception 'Impossible de créer une conversation avec soi-même';
  end if;

  select cm1.conversation_id into conv_id
  from conversation_membres cm1
  join conversation_membres cm2 on cm1.conversation_id = cm2.conversation_id
  join conversations c on c.id = cm1.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = autre_user_id and c.type = 'direct'
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into conversations (type) values ('direct') returning id into conv_id;
  insert into conversation_membres (conversation_id, user_id)
    values (conv_id, auth.uid()), (conv_id, autre_user_id);

  return conv_id;
end;
$$;

grant execute on function creer_conversation_directe(uuid) to authenticated;
