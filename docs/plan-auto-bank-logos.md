# Plano: Logo Automatica de Bancos ao Criar Conta

## Contexto

Ao adicionar uma conta no AxionnFina, o usuario precisa fazer upload manual da logo do banco via LogoUpload (data URL). Isso e inconveniente - a logo deveria ser resolvida automaticamente a partir do codigo da instituicao selecionada.

O institutions table ja possui o campo code com codigos COMPE (ex: '001' = Banco do Brasil, '341' = Itau), mas esse dado nao e exposto ao frontend para resolucao de logos.

## Fonte dos Logos

### Opcao selecionada: logos-bancos-br (CDN jsDelivr)

**Por que:**
- 473+ instituicoes com logos oficiais de fontes 100% oficiais (BCB STR + Open Finance Brasil)
- URLs de CDN prontas via jsDelivr - sem instalar pacote no bundle
- Lookup por codigo COMPE: logoCdnUrl(341) gera URL do jsDelivr
- Atualizado semanalmente automaticamente
- Indice compacto disponivel: cdn-index.min.json (~60KB) mapeia ISPB para [COMPE, nome, flags]
- A BrasilAPI ja usa esses logos no endpoint /banks/v1/{code}

**URLs de exemplo:**
```
https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/60701190.png  (Itau)
https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00000000.svg  (BB)
```

### Dados complementares

| Fonte | O que fornecem | Limite |
|---|---|---|
| logos-bancos-br CDN | Logo URL por ISPB/COMPE | Sem limite (CDN publica) |
| BrasilAPI /banks/v1/{code} | logo_url + dados do banco | Rate limit generoso |
| institutions.code (local) | Codigo COMPE ja mapeado | 12 instituicoes seedadas |

## Comparativo: Estado Atual vs Proposto

| Aspecto | Atual | Proposto |
|---|---|---|
| Logo ao criar conta | Upload manual (data URL) | Automatica via COMPE code |
| Fonte da logo | Arquivo local do usuario | CDN oficial (logos-bancos-br) |
| Dados da instituicao | code (COMPE) nao exposto | code usado para resolver logo |
| Fallback sem logo | hashColor + iniciais | hashColor + iniciais (inalterado) |
| institutions table | Sem logo_url | Com logo_url populado do CDN |

## Estrategia de Implementacao

### Abordagem: Hibrida (CDN lookup + cache no banco)

1. Ao selecionar instituicao no dropdown -> resolver logo automaticamente via CDN
2. Popular logo_url na tabela institutions -> seed migration com logos do logos-bancos-br
3. Ao salvar conta -> herdar logo_url da instituicao (se nao houver upload manual)
4. Fallback -> manter hashColor + iniciais quando nao houver logo

### Fluxo do usuario

```
1. Usuario abre formulario de nova conta
2. Seleciona instituicao no dropdown (ex: "Itau Unibanco")
3. Logo aparece automaticamente ao lado do nome
4. Usuario pode sobrescrever com upload manual (opcional)
5. Ao salvar, logo_url e persistida na conta
```

## Componentes a Alterar

### 5.1 Migration: Adicionar logo_url a tabela institutions

**Arquivo**: `supabase/migrations/XXXX_add_logo_url_to_institutions.sql`

```sql
ALTER TABLE institutions ADD COLUMN logo_url text;

-- Seed logos das 12 instituicoes existentes usando CDN logos-bancos-br
UPDATE institutions SET logo_url = CASE code
  WHEN '001' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/00000000.png'
  WHEN '033' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png'
  WHEN '077' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/00416630.png'
  WHEN '104' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/00360305.png'
  WHEN '208' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/02916265.png'
  WHEN '237' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/60701190.png'
  WHEN '260' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/18236120.png'
  WHEN '290' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/59285416.png'
  WHEN '323' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/03523617.png'
  WHEN '341' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/60701190.png'
  WHEN '380' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/10597404.png'
  WHEN '102' THEN 'https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/02332886.png'
END;
```

### 5.2 Atualizar hook useOpenFinanceInstitutions

**Arquivo**: `src/lib/finance/accounts.ts` (linha ~117)

Adicionar logo_url ao select:

```ts
.select("id, name, short_name, code, logo_color, logo_url")
```

### 5.3 Criar utilitario resolveBankLogo

**Arquivo**: `src/lib/bank-logos.ts` (novo)

```ts
/**
 * Resolve a URL do logo de um banco a partir do codigo COMPE.
 * Usa a CDN do logos-bancos-br via jsDelivr.
 */
export function resolveBankLogoByCompe(compe: string): string | null {
  const COMPE_TO_ISPB: Record<string, string> = {
    "001": "00000000",  // Banco do Brasil
    "033": "33041634",  // Santander
    "077": "00416630",  // Banco Inter
    "104": "00360305",  // Caixa
    "208": "02916265",  // BTG Pactual
    "237": "60701190",  // Bradesco
    "260": "18236120",  // Nubank
    "290": "59285416",  // PagBank
    "323": "03523617",  // Mercado Pago
    "341": "60701190",  // Itau
    "380": "10597404",  // PicPay
    "102": "02332886",  // XP Investimentos
  };

  const ispb = COMPE_TO_ISPB[compe];
  if (!ispb) return null;
  return `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/${ispb}.png`;
}
```

### 5.4 Criar componente InstitutionLogo

**Arquivo**: `src/components/finance/InstitutionLogo.tsx` (novo)

Componente que resolve e exibe a logo automaticamente:

```tsx
type InstitutionLogoProps = {
  institutionName: string;
  compeCode?: string | null;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
};
```

Logica:
1. Se logoUrl (upload manual) existir -> usar
2. Se compeCode existir -> resolver via resolveBankLogoByCompe
3. Senao -> fallback para hashColor + iniciais

### 5.5 Alterar formulario de contas

**Arquivo**: `src/routes/_authenticated/wallet/accounts.tsx`

Mudancas:
1. Ao selecionar institution_id no dropdown, auto-resolver logo_url:
   ```ts
   const selectedInst = institutions.find(i => i.id === form.institution_id);
   if (selectedInst?.logo_url && !form.logo_url) {
     setForm(prev => ({ ...prev, logo_url: selectedInst.logo_url }));
   }
   ```
2. Substituir LogoUpload por InstitutionLogo com botao "Alterar logo"
3. Manter capacidade de upload manual como override

### 5.6 Atualizar AccountAvatar

**Arquivo**: `src/components/finance/AccountAvatar.tsx`

Aceitar compeCode como prop para resolver logo automaticamente quando logoUrl for null:

```tsx
type AccountAvatarProps = {
  logoUrl: string | null;
  compeCode?: string | null;
  name: string;
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
};
```

### 5.7 Atualizar AccountCard

**Arquivo**: `src/components/finance/AccountCard.tsx`

Passar compeCode (do institution.code) para AccountAvatar.

## Atualizacao dos Seeds

### Expandir lista de instituicoes

Adicionar mais instituicoes ao seed da tabela institutions usando os dados do logos-bancos-br:

```sql
INSERT INTO institutions (code, name, short_name, logo_color, logo_url, openfinance_participant) VALUES
  ('001','Banco do Brasil S.A.','BB','#f6c700','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/00000000.png',true),
  ('033','Banco Santander (Brasil) S.A.','Santander','#ec0000','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('077','Banco Inter S.A.','Inter','#ff7a00','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/00416630.png',true),
  ('104','Caixa Economica Federal','Caixa','#0070af','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/00360305.png',true),
  ('208','BTG Pactual S.A.','BTG','#0f2b46','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/02916265.png',true),
  ('237','Banco Bradesco S.A.','Bradesco','#cc092f','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/60701190.png',true),
  ('260','Nu Pagamentos (Nubank)','Nubank','#820ad1','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/18236120.png',true),
  ('290','PagSeguro Digital Ltda.','PagBank','#00a868','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/59285416.png',true),
  ('323','Mercado Pago','Mercado Pago','#00b1ea','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/03523617.png',true),
  ('341','Itau Unibanco S.A.','Itau','#ec7000','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/60701190.png',true),
  ('380','PicPay Inc.','PicPay','#21c25e','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/10597404.png',true),
  ('102','XP Investimentos CCTVM S.A.','XP','#0b0b0b','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/02332886.png',true),
  ('336','Banco C6 S.A.','C6 Bank','#121212','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('655','Banco BV S.A.','BV','#223ad2','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('623','Banco Pan S.A.','Pan','#414141','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('756','Sicoob do Brasil Coope.','Sicoob','#b8d335','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/04891850.png',true),
  ('748','Sicredi S.C.R.L.','Sicredi','#3dae2b','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('041','Banrisul - Bco Eco. Rio Grande do Sul','Banrisul','#0096e6','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('422','Banco Safra S.A.','Safra','#c3ac6c','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true),
  ('212','Banco Original S.A.','Original','#00a857','https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/33041634.png',true)
ON CONFLICT (code) DO UPDATE SET logo_url = EXCLUDED.logo_url;
```

**Nota**: Alguns ISPBs acima sao placeholders. O ideal e usar o endpoint BrasilAPI /banks/v1/{code} para cada COMPE e obter o logo_url exato retornado.

## Risco

- **Baixo**: Nenhuma alteracao de logica de negocio, apenas presentacao
- CDN jsDelivr e publica e gratuita, sem custo adicional
- Fallback existente (hashColor) continua funcionando para instituicoes sem logo
- Nenhuma quebra de API ou schema existente

## Preservado

- Upload manual de logo continua disponivel como override
- Fallback hashColor + iniciais para instituicoes sem logo
- Todos os hooks e queries existentes
- Schema da tabela accounts inalterado
- Nenhuma chamada de API nova obrigatoria (CDN e publica)

## Validacao

- typecheck: verificar tipos dos novos componentes
- lint: verificar warnings
- build: verificar que CDN URLs funcionam
- Teste manual: selecionar instituicao no dropdown e verificar se logo aparece
