-- Atomic stock movements.
--
-- Before this, the browser computed a new *absolute* stock number and upserted
-- it (sync.js -> dispatchMenu). Two registers selling the same last unit inside
-- one sync window each wrote their own value, the last write won, and the
-- oversell left no trace anywhere: the database agreed with whichever register
-- happened to sync last, so a recount was the only way to notice.
--
-- apply_stock_movement takes a row lock, applies a signed delta, clamps at
-- zero, and reports how much of the movement it could not satisfy. Concurrent
-- callers serialise on the lock, so the second seller of the last unit reads a
-- stock of 0 and is told it came up short instead of quietly driving the
-- number negative.
--
-- security invoker (the default, stated explicitly) so Row Level Security still
-- applies: this function cannot do anything the calling role could not already
-- do, and an anonymous caller is stopped by the menu_items policies before the
-- update is ever reached.

create or replace function public.apply_stock_movement(
  p_name  text,
  p_delta integer
)
returns table (item_name text, stock integer, shortfall integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_stock integer;
  updated_stock integer;
  missing       integer := 0;
begin
  -- Serialise concurrent movements on this item. A second caller blocks here
  -- until the first commits, then reads the already-decremented value.
  select m.stock
    into current_stock
    from public.menu_items m
   where m.name = p_name
     for update;

  if current_stock is null then
    -- Unknown item: nothing to move. Reported as a no-op, not an error, so a
    -- queued sale for a since-deleted menu line still drains the queue.
    return query select p_name, 0, 0;
    return;
  end if;

  updated_stock := current_stock + p_delta;
  if updated_stock < 0 then
    missing := -updated_stock;
    updated_stock := 0;
  end if;

  update public.menu_items
     set stock = updated_stock,
         updated_at = now()
   where name = p_name;

  return query select p_name, updated_stock, missing;
end;
$$;

-- Defence in depth: RLS already refuses anonymous writes, but the function
-- should not be callable from the anon role at all.
revoke execute on function public.apply_stock_movement(text, integer) from anon;

comment on function public.apply_stock_movement(text, integer) is
  'Atomically apply a signed stock delta, clamped at zero. Returns the resulting stock and how much of the movement could not be satisfied (0 when fully satisfied).';

-- An explicit recount is a different operation from a sale. When a manager
-- types a real count into the menu editor they mean "there are exactly this
-- many", which is an absolute value and cannot be expressed as a delta
-- without being wrong whenever the device's belief had drifted from the
-- server's. So it gets its own function — still locked, still RLS-checked,
-- but authoritative on purpose.
--
-- Without this, editing an item's price would have had to carry the device's
-- stock number along with it, which is exactly the clobber apply_stock_movement
-- exists to prevent.
create or replace function public.set_menu_item_stock(
  p_name  text,
  p_value integer
)
returns table (item_name text, stock integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_stock integer;
begin
  updated_stock := greatest(0, coalesce(p_value, 0));

  update public.menu_items
     set stock = updated_stock,
         updated_at = now()
   where name = p_name;

  if not found then
    return query select p_name, 0;
    return;
  end if;

  return query select p_name, updated_stock;
end;
$$;

revoke execute on function public.set_menu_item_stock(text, integer) from anon;

comment on function public.set_menu_item_stock(text, integer) is
  'Set an item''s stock to an exact counted value, clamped at zero. For explicit recounts; use apply_stock_movement for sales and restocks.';
