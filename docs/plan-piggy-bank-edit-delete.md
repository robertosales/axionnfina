# Plano: Editar, Excluir e Emoji Picker nos Cofrinhos

## Contexto

Os cofrinhos apenas possuem criar, aportar e resgatar. Faltam:
- Editar nome/ícone/cor
- Excluir (com regras de saldo)
- Substituir input de emoji por um picker com categorias

## Requisitos do Usuario

1. **Editar cofrinho** — alterar nome, ícone e cor
2. **Excluir cofrinho** — com regras:
   - Saldo = 0 → exclusão direta
   - Saldo > 0 → mostrar opções: transferir para outro cofrinho OU zerar saldo (resgatar para conta)
3. **Emoji picker** — ao clicar no ícone, mostrar lista de emojis diversificados (viagem, casa, carro, etc.)

## Arquivos a Alterar

### 3.1 Migration: RPC update_piggy_bank + delete_piggy_bank

**Arquivo**: `supabase/migrations/20260919100000_piggy_bank_edit_delete.sql` (novo)

```sql
-- 1. Atualizar cofrinho (nome, ícone, cor)
CREATE OR REPLACE FUNCTION public.update_piggy_bank(
  p_piggy_bank_id UUID,
  p_name TEXT,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.piggy_banks
    WHERE id = p_piggy_bank_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;

  UPDATE public.piggy_banks
  SET name = p_name, icon = p_icon, color = p_color
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;
END;
$$;

-- 2. Excluir cofrinho (exige saldo = 0)
CREATE OR REPLACE FUNCTION public.delete_piggy_bank(
  p_piggy_bank_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC(15,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT balance INTO v_balance
  FROM public.piggy_banks
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Cofrinho não encontrado';
  END IF;
  IF v_balance != 0 THEN
    RAISE EXCEPTION 'Saldo deve ser zero para excluir. Transfira ou resgate o valor primeiro.';
  END IF;

  -- CASCADE deleta movements automaticamente
  DELETE FROM public.piggy_banks
  WHERE id = p_piggy_bank_id AND user_id = v_user_id;
END;
$$;

-- 3. Transferir saldo entre cofrinhos
CREATE OR REPLACE FUNCTION public.transfer_piggy_bank(
  p_from_id UUID,
  p_to_id UUID,
  p_amount NUMERIC(15,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_from_balance NUMERIC(15,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verificar ownership dos dois cofrinhos
  SELECT balance INTO v_from_balance
  FROM public.piggy_banks
  WHERE id = p_from_id AND user_id = v_user_id;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Cofrinho de origem não encontrado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.piggy_banks
    WHERE id = p_to_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Cofrinho de destino não encontrado';
  END IF;
  IF p_from_id = p_to_id THEN
    RAISE EXCEPTION 'Cofrinhos devem ser diferentes';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente no cofrinho de origem';
  END IF;

  -- Withdraw from origin (movement)
  INSERT INTO public.piggy_bank_movements (piggy_bank_id, type, amount, note)
  VALUES (p_from_id, 'withdrawal', p_amount, 'Transferência entre cofrinhos');

  -- Deposit to destination (movement)
  INSERT INTO public.piggy_bank_movements (piggy_bank_id, type, amount, note)
  VALUES (p_to_id, 'deposit', p_amount, 'Transferência entre cofrinhos');
END;
$$;
```

### 3.2 Atualizar tipos Supabase

**Arquivo**: `src/integrations/supabase/types.ts`

Adicionar as novas funções RPC no tipo `Database["public"]["Functions"]`:
- `update_piggy_bank`
- `delete_piggy_bank`
- `transfer_piggy_bank`

### 3.3 Atualizar hooks

**Arquivo**: `src/hooks/use-piggy-banks.ts`

Adicionar:

```ts
export interface UpdatePiggyBankInput {
  piggy_bank_id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface TransferPiggyBankInput {
  from_id: string;
  to_id: string;
  amount: number;
}

export function useUpdatePiggyBank() { ... }   // chama update_piggy_bank RPC
export function useDeletePiggyBank() { ... }   // chama delete_piggy_bank RPC
export function useTransferPiggyBank() { ... } // chama transfer_piggy_bank RPC
```

Invalidação de queries: `["piggy-banks"]`

### 3.4 Criar componente EmojiPicker

**Arquivo**: `src/components/finance/EmojiPicker.tsx` (novo)

Grid de emojis organizados por categoria:

```ts
const EMOJI_CATEGORIES = [
  {
    label: "Financeiro",
    emojis: ["🐷", "💰", "🏦", "💳", "📈", "🪙", "💵", "🏧", "📊", "🪙"]
  },
  {
    label: "Viagem",
    emojis: ["✈️", "🏖️", "🗺️", "🧳", "🌍", "🛫", "🚂", "🏨", "⛱️", "🎒"]
  },
  {
    label: "Casa",
    emojis: ["🏠", "🏡", "🔑", "🛋️", "🔨", "🏗️", "🪴", "🏠", "🔌", "🧱"]
  },
  {
    label: "Carro",
    emojis: ["🚗", "🚙", "🏎️", "⛽", "🔧", "🛣️", "🅿️", "🚕", "🚌", "🏍️"]
  },
  {
    label: "Educação",
    emojis: ["📚", "🎓", "✏️", "🎒", "🏫", "📖", "🔬", "💻", "🎓", "📝"]
  },
  {
    label: "Saúde",
    emojis: ["💊", "🏥", "🩺", "❤️", "🏃", "🧘", "🍎", "💪", "🩹", "🦷"]
  },
  {
    label: "Compras",
    emojis: ["🛒", "🛍️", "👗", "💻", "📱", "🎮", "🎵", "👟", "⌚", "📦"]
  },
  {
    label: "Alimentação",
    emojis: ["🍔", "🍕", "🍣", "☕", "🍕", "🍰", "🧁", "🥘", "🍜", "🍩"]
  },
  {
    label: "Metas",
    emojis: ["🎯", "⭐", "🏆", "🎪", "🎨", "🎭", "🎬", "🎤", "🎸", "⚽"]
  },
];
```

Componente: grid de botões, ao clicar chama `onSelect(emoji)`. Usa `Popover` para abrir/fechar.

### 3.5 Atualizar PiggyBankCard

**Arquivo**: `src/components/finance/PiggyBankCard.tsx`

Adicionar `onEdit` prop e menu de ações:

```tsx
type PiggyBankCardProps = {
  bank: PiggyBank;
  onDeposit: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onDelete: () => void;
};
```

Substituir os botões "Aportar"/"Resgatar" por um layout com:
- Ícone/emoji (clicável para ver detalhes)
- Nome + badge de saldo
- Botões de ação: Aportar, Resgatar
- `EntityActionsMenu` com Editar e Excluir

### 3.6 Atualizar piggy-banks.tsx (página principal)

**Arquivo**: `src/routes/_authenticated/piggy-banks.tsx`

Mudanças:

1. **Importar novos hooks**: `useUpdatePiggyBank`, `useDeletePiggyBank`, `useTransferPiggyBank`
2. **Importar**: `EntityActionsMenu`, `EmojiPicker`, `AlertDialog` (para delete com saldo)
3. **Estado do formulário de edição**:
   ```ts
   const [editId, setEditId] = useState<string | null>(null);
   ```
4. **Handler de edição** (`handleOpenEdit`): popula form com dados do cofrinho
5. **Handler de salvar edição** (`handleSaveEdit`): chama `updatePiggyBank.mutateAsync()`
6. **Handler de exclusão** (`handleDelete`):
   - Se saldo = 0 → `AlertDialog` de confirmação → `deletePiggyBank.mutateAsync()`
   - Se saldo > 0 → `Dialog` com opções:
     - **Opção A**: Transferir para outro cofrinho (select de cofrinhos + input de valor)
     - **Opção B**: Zerar saldo (resgatar tudo para uma conta)
7. **Substituir input de emoji** por `EmojiPicker` com `Popover`
8. **Adicionar `LifecycleFilter`** para ver arquivados (o hook já suporta `showArchived`)
9. **Passar handlers** para `PiggyBankCard`: `onEdit`, `onDelete`

### 3.7 Dialog de exclusão com saldo > 0

Quando o usuário tenta excluir um cofrinho com saldo:

```
┌─────────────────────────────────────────┐
│  Excluir cofrinho "Viagem"?             │
│                                         │
│  Este cofrinho possui R$ 1.250,00.      │
│  Escolha uma opção:                     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🔄 Transferir para outro cofrinho│    │
│  │ [Select: cofrinho destino    ▾] │    │
│  │ [Valor: R$ 1.250,00           ] │    │
│  │            [Transferir]         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 💰 Resgatar para conta          │    │
│  │ [Select: conta destino       ▾] │    │
│  │            [Resgatar tudo]      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Cancelar]                             │
└─────────────────────────────────────────┘
```

## Preservado

- Criar cofrinho permanece igual
- Aportar/Resgatar permanecem iguais
- Trigger de saldo automático continua funcionando
- RLS policies existentes continuam válidas
- Nenhuma quebra de API existente

## Validacao

- typecheck: verificar tipos das novas funções RPC
- lint: verificar warnings
- build: build completo
- Teste manual: criar cofrinho → editar → adicionar saldo → excluir (deve bloquear) → transferir/zerar → excluir
