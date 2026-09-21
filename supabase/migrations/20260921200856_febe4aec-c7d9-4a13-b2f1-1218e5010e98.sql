CREATE OR REPLACE FUNCTION public.get_wallet_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'total_accounts', COUNT(*),
        'checking_count', COUNT(*) FILTER (WHERE type = 'checking'),
        'savings_count', COUNT(*) FILTER (WHERE type = 'savings'),
        'credit_count', COUNT(*) FILTER (WHERE type = 'credit'),
        'investment_count', COUNT(*) FILTER (WHERE type = 'investment'),
        'total_balance', COALESCE(SUM(balance), 0),
        'liquid_balance', COALESCE(SUM(balance) FILTER (WHERE type IN ('checking','savings')), 0),
        'investment_balance', COALESCE(SUM(balance) FILTER (WHERE type = 'investment'), 0),
        'total_credit_limit', COALESCE(SUM(COALESCE(credit_limit, 0)), 0),
        'total_overdraft_used', COALESCE(SUM(
          CASE WHEN balance < 0 THEN LEAST(-balance, COALESCE(credit_limit, 0)) ELSE 0 END
        ), 0),
        'total_available_credit', COALESCE(SUM(
          GREATEST(COALESCE(credit_limit, 0) + LEAST(balance, 0), 0)
        ), 0)
      )
      FROM public.accounts
      WHERE user_id = auth.uid() AND is_archived = false
    ),
    'by_institution', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'name', COALESCE(i.name, a.institution, 'Outros'),
          'logo_color', i.logo_color,
          'account_count', COUNT(*),
          'balance', SUM(a.balance)
        ) AS t
        FROM public.accounts a
        LEFT JOIN public.institutions i ON i.id = a.institution_id
        WHERE a.user_id = auth.uid() AND a.is_archived = false
        GROUP BY i.name, a.institution, i.logo_color
        ORDER BY SUM(a.balance) DESC
      ) bi
    ),
    'accounts', (
      SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'institution_name', COALESCE(i.name, a.institution),
          'logo_color', i.logo_color,
          'type', a.type,
          'balance', a.balance,
          'available_balance', a.available_balance,
          'credit_limit', a.credit_limit,
          'overdraft_used', CASE WHEN a.balance < 0 THEN LEAST(-a.balance, COALESCE(a.credit_limit, 0)) ELSE 0 END,
          'spendable_balance', a.balance + COALESCE(a.credit_limit, 0),
          'is_primary', a.is_primary,
          'is_manual', a.is_manual,
          'open_finance', a.open_finance,
          'card_last_four', cc.last_four,
          'card_brand', cc.brand,
          'last_sync_at', a.last_sync_at,
          'currency', a.currency
        ) AS t
        FROM public.accounts a
        LEFT JOIN public.institutions i ON i.id = a.institution_id
        LEFT JOIN public.credit_cards cc ON cc.account_id = a.id
        WHERE a.user_id = auth.uid() AND a.is_archived = false
        ORDER BY a.is_primary DESC, a.balance DESC
      ) acc
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary() TO authenticated;