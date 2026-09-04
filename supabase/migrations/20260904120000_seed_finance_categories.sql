-- Categorias iniciais adicionais para o fluxo manual de receitas, despesas e transferencias.
INSERT INTO public.transaction_categories (
  code, label, name, parent_id, icon, color, kind, is_system, sort_order
)
SELECT
  item.code,
  item.label,
  item.label,
  parent.id,
  item.icon,
  item.color,
  item.kind,
  true,
  item.sort_order
FROM (
  VALUES
    ('income_sales', 'Vendas', 'INCOME', 'receipt', '#16a34a', 'income', 15),
    ('income_benefits', 'Beneficios', 'INCOME', 'gift', '#16a34a', 'income', 16),
    ('income_reimbursements', 'Reembolsos', 'INCOME', 'undo-2', '#16a34a', 'income', 17),
    ('income_returns', 'Rendimentos', 'INCOME', 'trending-up', '#16a34a', 'income', 18),
    ('expense_services', 'Contas e servicos', 'FIXED', 'receipt', '#dc2626', 'expense', 26),
    ('expense_taxes_fees', 'Impostos e taxas', 'TAX', 'file-text', '#db2777', 'expense', 63),
    ('expense_other', 'Outras despesas', 'VARIABLE', 'more-horizontal', '#f97316', 'expense', 90),
    ('transfer_pix', 'Pix', 'TRANSFER', 'arrow-left-right', '#4f46e5', 'transfer', 44)
) AS item(code, label, parent_code, icon, color, kind, sort_order)
JOIN public.transaction_categories parent ON parent.code = item.parent_code
ON CONFLICT (code) DO NOTHING;