# Corrigir tela em branco do app publicado

## O que está acontecendo
O registro enviado mostra que a regra de segurança de conteúdo (CSP) definida em `src/lib/security.ts` e aplicada em `src/server.ts` bloqueia:
- os scripts embutidos na página que o TanStack Start usa para iniciar o app (`window.$_TSR`). Sem eles, aparece "Expected to find bootstrap data on window.$_TSR" e a página não abre;
- as fontes do Google (DM Sans e Space Grotesk);
- o script do Lovable (`cdn.gpteng.co`), usado pelo preview e pelos relatórios de erro.

Além disso, `frame-ancestors 'none'` e `X-Frame-Options: DENY` impedem que o app abra dentro do preview do editor.

## Correção (só em `src/lib/security.ts`)
- `script-src`: incluir `'unsafe-inline'` (necessário para os dados de inicialização do TanStack, que não usam nonce nesta configuração) e `https://cdn.gpteng.co`; remover a variável `scriptSrc`, que não é usada.
- `style-src`: incluir `https://fonts.googleapis.com`.
- `connect-src`: incluir `https://*.lovable.app`, `https://cdn.gpteng.co`, `https://brapi.dev` e `https://query1.finance.yahoo.com` para manter as chamadas do lado do navegador funcionando.
- `frame-ancestors`: trocar `'none'` por `'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev`.
- Remover `X-Frame-Options: DENY`, que é substituído pelo `frame-ancestors`.
- Manter os demais cabeçalhos: nosniff, Referrer-Policy e Permissions-Policy.

## Validação
- Fazer um build de produção e servir o resultado localmente. Abrir `/`, `/auth` e `/dashboard` com sessão ativa usando Playwright e confirmar que não aparecem erros de CSP nem de `$_TSR` no console.
- Conferir o cabeçalho `Content-Security-Policy` retornado pelo servidor.
- Depois, publicar de novo.
