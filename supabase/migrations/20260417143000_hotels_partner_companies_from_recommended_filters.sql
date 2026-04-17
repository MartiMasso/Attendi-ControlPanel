-- Hotels partner source of truth for Control Panel
-- Partner companies are derived from the hotel's recommendation filters + visible nearby products.

create index if not exists idx_business_details_user_id
  on public.business_details (user_id);

create index if not exists idx_products_visible_geo_owner
  on public.products (user_id, location_lat, location_lng)
  where is_hidden = false
    and deleted_at is null
    and location_lat is not null
    and location_lng is not null;

create or replace function public.get_hotel_partner_companies_with_commissions(p_hotel_id uuid)
returns table (
  company_id uuid,
  company_name text,
  company_email text,
  ce_p_standard_pct numeric,
  ce_p_effective_pct numeric,
  ce_p_override_pct numeric,
  has_custom_ce_p boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_hotel_id is null then
    return;
  end if;

  return query
  with hotel_context as (
    select
      hp.id as hotel_id,
      hp.latitude::double precision as hotel_lat,
      hp.longitude::double precision as hotel_lng,
      greatest(
        coalesce(
          case
            when coalesce(bd.hotel_recommended_filters ->> 'max_distance_km', '') ~ '^[0-9]+([.][0-9]+)?$'
              then (bd.hotel_recommended_filters ->> 'max_distance_km')::double precision
            else null
          end,
          50::double precision
        ),
        0::double precision
      ) as max_distance_km,
      excluded.excluded_company_ids
    from public.profiles hp
    left join public.business_details bd
      on bd.user_id = hp.id
    left join lateral (
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) as excluded_company_ids
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(bd.hotel_recommended_filters -> 'excluded_company_ids', '[]'::jsonb)) = 'array'
            then coalesce(bd.hotel_recommended_filters -> 'excluded_company_ids', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as entry(value)
      where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) excluded on true
    where hp.account_type = 'hotel'
      and hp.id = p_hotel_id
  ),
  partner_candidates as (
    select distinct
      hc.hotel_id,
      p.user_id as company_id
    from hotel_context hc
    join public.products p
      on p.is_hidden = false
      and p.deleted_at is null
      and p.location_lat is not null
      and p.location_lng is not null
      and p.user_id <> hc.hotel_id
      and (hc.hotel_lat is not null and hc.hotel_lng is not null)
      and p.location_lat::double precision between hc.hotel_lat - (hc.max_distance_km / 111.0) and hc.hotel_lat + (hc.max_distance_km / 111.0)
      and p.location_lng::double precision between hc.hotel_lng - (hc.max_distance_km / (111.0 * greatest(cos(radians(hc.hotel_lat)), 0.01)))
                                           and hc.hotel_lng + (hc.max_distance_km / (111.0 * greatest(cos(radians(hc.hotel_lat)), 0.01)))
    join public.profiles owner
      on owner.id = p.user_id
      and owner.account_type = 'business'
    where not (p.user_id = any(hc.excluded_company_ids))
      and (
        6371::double precision * acos(
          least(
            1::double precision,
            greatest(
              -1::double precision,
              cos(radians(hc.hotel_lat)) * cos(radians(p.location_lat::double precision)) *
              cos(radians(p.location_lng::double precision) - radians(hc.hotel_lng)) +
              sin(radians(hc.hotel_lat)) * sin(radians(p.location_lat::double precision))
            )
          )
        )
      ) <= hc.max_distance_km
  )
  select
    pc.company_id,
    coalesce(
      nullif(trim(bd.business_name), ''),
      nullif(trim(cp.business_name), ''),
      nullif(trim(cp.full_name), ''),
      nullif(trim(cp.username), ''),
      pc.company_id::text
    ) as company_name,
    coalesce(
      nullif(trim(bd.email), ''),
      nullif(trim(cp.username), '')
    ) as company_email,
    coalesce(cp.comision_propietario, 12.5)::numeric as ce_p_standard_pct,
    coalesce(ov.ce_p_pct, cp.comision_propietario, 12.5)::numeric as ce_p_effective_pct,
    ov.ce_p_pct::numeric as ce_p_override_pct,
    (ov.id is not null) as has_custom_ce_p
  from partner_candidates pc
  join public.profiles cp
    on cp.id = pc.company_id
    and cp.account_type = 'business'
  left join public.business_details bd
    on bd.user_id = pc.company_id
  left join public.hotel_company_commission_overrides ov
    on ov.hotel_id = pc.hotel_id
    and ov.company_id = pc.company_id
    and ov.active = true
  order by has_custom_ce_p desc, company_name asc;
end;
$$;

revoke all on function public.get_hotel_partner_companies_with_commissions(uuid) from public;
grant execute on function public.get_hotel_partner_companies_with_commissions(uuid) to authenticated;

create or replace function public.get_hotels_partner_counts(p_hotel_ids uuid[] default null)
returns table (
  hotel_id uuid,
  partners_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with hotel_context as (
    select
      hp.id as hotel_id,
      hp.latitude::double precision as hotel_lat,
      hp.longitude::double precision as hotel_lng,
      greatest(
        coalesce(
          case
            when coalesce(bd.hotel_recommended_filters ->> 'max_distance_km', '') ~ '^[0-9]+([.][0-9]+)?$'
              then (bd.hotel_recommended_filters ->> 'max_distance_km')::double precision
            else null
          end,
          50::double precision
        ),
        0::double precision
      ) as max_distance_km,
      excluded.excluded_company_ids
    from public.profiles hp
    left join public.business_details bd
      on bd.user_id = hp.id
    left join lateral (
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) as excluded_company_ids
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(bd.hotel_recommended_filters -> 'excluded_company_ids', '[]'::jsonb)) = 'array'
            then coalesce(bd.hotel_recommended_filters -> 'excluded_company_ids', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as entry(value)
      where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) excluded on true
    where hp.account_type = 'hotel'
      and (p_hotel_ids is null or hp.id = any(p_hotel_ids))
  ),
  partner_candidates as (
    select distinct
      hc.hotel_id,
      p.user_id as company_id
    from hotel_context hc
    join public.products p
      on p.is_hidden = false
      and p.deleted_at is null
      and p.location_lat is not null
      and p.location_lng is not null
      and p.user_id <> hc.hotel_id
      and (hc.hotel_lat is not null and hc.hotel_lng is not null)
      and p.location_lat::double precision between hc.hotel_lat - (hc.max_distance_km / 111.0) and hc.hotel_lat + (hc.max_distance_km / 111.0)
      and p.location_lng::double precision between hc.hotel_lng - (hc.max_distance_km / (111.0 * greatest(cos(radians(hc.hotel_lat)), 0.01)))
                                           and hc.hotel_lng + (hc.max_distance_km / (111.0 * greatest(cos(radians(hc.hotel_lat)), 0.01)))
    join public.profiles owner
      on owner.id = p.user_id
      and owner.account_type = 'business'
    where not (p.user_id = any(hc.excluded_company_ids))
      and (
        6371::double precision * acos(
          least(
            1::double precision,
            greatest(
              -1::double precision,
              cos(radians(hc.hotel_lat)) * cos(radians(p.location_lat::double precision)) *
              cos(radians(p.location_lng::double precision) - radians(hc.hotel_lng)) +
              sin(radians(hc.hotel_lat)) * sin(radians(p.location_lat::double precision))
            )
          )
        )
      ) <= hc.max_distance_km
  )
  select
    hc.hotel_id,
    coalesce(count(distinct pc.company_id), 0)::integer as partners_count
  from hotel_context hc
  left join partner_candidates pc
    on pc.hotel_id = hc.hotel_id
  group by hc.hotel_id;
end;
$$;

revoke all on function public.get_hotels_partner_counts(uuid[]) from public;
grant execute on function public.get_hotels_partner_counts(uuid[]) to authenticated;
