do $$
begin
  if to_regclass('public.reservations') is not null
    and to_regclass('public.products') is not null
    and to_regclass('public.profiles') is not null
    and to_regclass('public.platform_commission_settings') is not null
    and to_regclass('public.reservation_hotel_attributions') is not null
    and to_regclass('public.hotel_company_commission_overrides') is not null
    and to_regclass('public.analytics_cutover') is not null
  then
    execute 'drop view if exists public.reservation_financial_ledger_v1';

    execute $view$
      create view public.reservation_financial_ledger_v1 as
      with settings as (
        select coalesce(k_hotel, 0.4)::numeric as k_hotel
        from public.platform_commission_settings
        where id = 1
        limit 1
      ),
      cutover as (
        select coalesce(
          (select business_performance_from from public.analytics_cutover where id = 1),
          '-infinity'::timestamptz
        ) as business_performance_from
      ),
      base as (
        select
          r.id::text as reservation_id,
          p.user_id as owner_user_id,
          owner.account_type::text as owner_type,
          r.user_id as buyer_user_id,
          coalesce(rha.hotel_id, r.source_hotel_id) as linked_hotel_id,
          case
            when owner.account_type::text = 'hotel'
              and (
                coalesce(rha.hotel_id, r.source_hotel_id) is null
                or coalesce(rha.hotel_id, r.source_hotel_id) = p.user_id
              )
              then 'hotel_own_product'
            when coalesce(rha.hotel_id, r.source_hotel_id) is not null
              and coalesce(rha.hotel_id, r.source_hotel_id) <> p.user_id
              then 'hotel_link_external'
            else 'standard'
          end as flow_type,
          case
            when coalesce(rha.hotel_id, r.source_hotel_id) is not null
              and coalesce(rha.hotel_id, r.source_hotel_id) <> p.user_id
              then coalesce(rha.hotel_id, r.source_hotel_id)
            else p.user_id
          end as entity_id,
          case
            when coalesce(rha.hotel_id, r.source_hotel_id) is not null
              and coalesce(rha.hotel_id, r.source_hotel_id) <> p.user_id
              then 'hotel'
            else owner.account_type::text
          end as entity_type,
          r.product_id,
          p.title as product_title,
          r.created_at,
          r.start_date,
          r.end_date,
          r.refunded_at,
          coalesce(r.payment_authorized_at, r.created_at) as effective_at,
          date_trunc('month', timezone('Europe/Madrid', coalesce(r.payment_authorized_at, r.created_at))) as effective_at_month,
          r.status,
          greatest(0, coalesce(r.rental_amount, 0) + coalesce(r.addons_amount, 0))::bigint as p_base_cents,
          greatest(0, coalesce(r.insurance_amount, 0))::bigint as insurance_cents,
          greatest(
            0,
            coalesce(
              r.fee_amount,
              round(coalesce(rha.client_fee_amount, 0) * 100)::integer,
              0
            )
          )::bigint as ccl_cents,
          greatest(0, coalesce(r.refunded_amount, 0))::bigint as refunded_customer_cents,
          coalesce(
            r.transfer_amount::bigint,
            round(rha.owner_amount * 100)::bigint
          ) as owner_amount_persisted_cents,
          coalesce(
            r.hotel_commission_amount::bigint,
            round(rha.hotel_amount * 100)::bigint
          ) as hotel_amount_persisted_cents,
          round(rha.attendi_amount * 100)::bigint as attendi_amount_persisted_cents,
          coalesce(rha.comision_propietario_pct, owner.comision_propietario)::numeric as cp_pct_effective,
          coalesce(override.ce_p_pct, rha.comision_propietario_pct, owner.comision_propietario)::numeric as ce_p_pct_effective,
          coalesce(rha.comision_hotel_pct, owner.comision_hotel)::numeric as ch_pct_effective,
          coalesce((select k_hotel from settings), 0.4)::numeric as k_hotel_effective,
          coalesce(p.cancellation_refund_pct, 100)::numeric as cancellation_refund_pct,
          extract(
            epoch from (
              (r.start_date::timestamp at time zone 'Europe/Madrid')
              - coalesce(r.payment_authorized_at, r.created_at)
            )
          ) / 86400.0 as authorized_to_start_days,
          (rha.reservation_id is not null) as has_real_attribution,
          (
            coalesce(lower(r.status), '') like '%cancel%'
            or coalesce(lower(r.status), '') like '%refund%'
            or coalesce(lower(r.status), '') like '%reject%'
            or coalesce(lower(r.status), '') like '%expired%'
          ) as is_cancellation_status
        from public.reservations r
        left join public.products p
          on p.id = r.product_id
        left join public.profiles owner
          on owner.id = p.user_id
        left join public.reservation_hotel_attributions rha
          on rha.reservation_id = r.id::text
        left join public.hotel_company_commission_overrides override
          on override.hotel_id = coalesce(rha.hotel_id, r.source_hotel_id)
          and override.company_id = p.user_id
          and override.active = true
        where p.user_id is not null
          and coalesce(r.payment_authorized_at, r.created_at) >= (select business_performance_from from cutover)
      ),
      prepared as (
        select
          *,
          (p_base_cents + insurance_cents + ccl_cents)::bigint as gross_customer_cents,
          case
            when refunded_customer_cents >= (p_base_cents + insurance_cents + ccl_cents) then 0
            when cancellation_refund_pct = 100 and authorized_to_start_days <= 7 then 0
            else ccl_cents
          end::bigint as ccl_retained_cents
        from base
      ),
      retention as (
        select
          *,
          greatest(0, ccl_cents - ccl_retained_cents)::bigint as refunded_ccl_cents,
          greatest(0, refunded_customer_cents - greatest(0, ccl_cents - ccl_retained_cents))::bigint as refund_after_ccl_cents,
          least(insurance_cents, greatest(0, refunded_customer_cents - greatest(0, ccl_cents - ccl_retained_cents)))::bigint as refunded_insurance_cents,
          least(
            p_base_cents,
            greatest(
              0,
              greatest(0, refunded_customer_cents - greatest(0, ccl_cents - ccl_retained_cents))
              - least(insurance_cents, greatest(0, refunded_customer_cents - greatest(0, ccl_cents - ccl_retained_cents)))
            )
          )::bigint as refunded_customer_base_cents,
          greatest(0, (p_base_cents + insurance_cents + ccl_cents) - refunded_customer_cents)::bigint as net_customer_retained_cents,
          case
            when (refunded_customer_cents > 0 or is_cancellation_status)
              then greatest(0::numeric, least(1::numeric, 1::numeric - (cancellation_refund_pct / 100.0)))
            else null
          end as retention_hint
        from prepared
      ),
      split as (
        select
          *,
          case
            when not (refunded_customer_cents > 0 or is_cancellation_status) then p_base_cents
            when refunded_customer_cents > 0 then greatest(0, p_base_cents - refunded_customer_base_cents)
            when retention_hint is not null then round(p_base_cents::numeric * retention_hint)::bigint
            else p_base_cents
          end as retained_base_cents
        from retention
      ),
      formula as (
        select
          *,
          case
            when flow_type = 'hotel_link_external' then round(retained_base_cents::numeric * (1 - (coalesce(ce_p_pct_effective, 0) / 100.0)))::bigint
            when flow_type = 'hotel_own_product' then round(retained_base_cents::numeric * (1 - (coalesce(ch_pct_effective, 0) / 100.0)))::bigint
            else round(retained_base_cents::numeric * (1 - (coalesce(cp_pct_effective, 0) / 100.0)))::bigint
          end as owner_amount_formula_cents,
          case
            when flow_type = 'hotel_link_external' then round(
              retained_base_cents::numeric
              * (coalesce(ce_p_pct_effective, 0) / 100.0)
              * coalesce(k_hotel_effective, 0)
            )::bigint
            else 0::bigint
          end as hotel_amount_formula_cents
        from split
      ),
      resolved as (
        select
          *,
          greatest(0, coalesce(owner_amount_persisted_cents, 0))::bigint as owner_amount_persisted_nonneg_cents,
          case
            when flow_type = 'hotel_link_external' then greatest(0, coalesce(hotel_amount_persisted_cents, 0))::bigint
            else 0::bigint
          end as hotel_amount_persisted_nonneg_cents,
          greatest(0, coalesce(attendi_amount_persisted_cents, 0))::bigint as attendi_amount_persisted_nonneg_cents,
          (
            has_real_attribution
            and owner_amount_persisted_cents is not null
            and attendi_amount_persisted_cents is not null
            and (flow_type <> 'hotel_link_external' or hotel_amount_persisted_cents is not null)
          ) as has_complete_persisted_split
        from formula
      )
      select
        reservation_id,
        owner_user_id,
        owner_type,
        buyer_user_id,
        linked_hotel_id,
        flow_type,
        entity_id,
        entity_type,
        product_id,
        product_title,
        created_at,
        start_date,
        end_date,
        refunded_at,
        effective_at,
        effective_at_month,
        status,
        p_base_cents,
        insurance_cents,
        ccl_cents,
        gross_customer_cents,
        refunded_customer_cents,
        retained_base_cents,
        case
          when has_complete_persisted_split
            and abs(
              (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
              - net_customer_retained_cents
            ) <= 1
            then owner_amount_persisted_nonneg_cents
          else owner_amount_formula_cents
        end as owner_amount_cents,
        case
          when has_complete_persisted_split
            and abs(
              (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
              - net_customer_retained_cents
            ) <= 1
            then 'persisted'::text
          else 'formula'::text
        end as owner_amount_source,
        case
          when has_complete_persisted_split
            and abs(
              (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
              - net_customer_retained_cents
            ) <= 1
            then hotel_amount_persisted_nonneg_cents
          else hotel_amount_formula_cents
        end as hotel_amount_cents,
        case
          when has_complete_persisted_split
            and abs(
              (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
              - net_customer_retained_cents
            ) <= 1
            then attendi_amount_persisted_nonneg_cents
          else greatest(0, net_customer_retained_cents - owner_amount_formula_cents - hotel_amount_formula_cents)
        end as attendi_amount_before_stripe_cents,
        0::bigint as stripe_fee_cents,
        case
          when has_complete_persisted_split
            and abs(
              (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
              - net_customer_retained_cents
            ) <= 1
            then attendi_amount_persisted_nonneg_cents
          else greatest(0, net_customer_retained_cents - owner_amount_formula_cents - hotel_amount_formula_cents)
        end as attendi_net_cents,
        cp_pct_effective,
        ce_p_pct_effective,
        ch_pct_effective,
        k_hotel_effective,
        case
          when p_base_cents > 0 then greatest(0::numeric, least(1::numeric, retained_base_cents::numeric / p_base_cents::numeric))
          else 0::numeric
        end as retention_pct_effective,
        not (
          has_complete_persisted_split
          and abs(
            (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
            - net_customer_retained_cents
          ) <= 1
        ) as is_estimated,
        case
          when (
            has_complete_persisted_split
            and abs(
              (owner_amount_persisted_nonneg_cents + hotel_amount_persisted_nonneg_cents + attendi_amount_persisted_nonneg_cents)
              - net_customer_retained_cents
            ) <= 1
          ) then null
          when has_complete_persisted_split then 'Persisted split is inconsistent with net retained customer amount; fallback formula applied.'
          else 'Missing persisted split amounts; fallback formula applied.'
        end as estimation_reason
      from resolved;
    $view$;

    execute 'grant select on public.reservation_financial_ledger_v1 to authenticated, service_role';
  end if;
end $$;
