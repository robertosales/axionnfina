# Provedor de IA do AxionnFina

O agente usa uma API compatível com OpenAI apenas como protocolo. O provedor padrão é o Cloudflare Workers AI e o modelo padrão é `@cf/google/gemma-4-26b-a4b-it`, que suporta chamadas de ferramentas.

Não existe fallback automático. Se o Cloudflare estiver sem configuração ou sem cota, o chat retorna indisponibilidade e o restante do produto continua funcionando. Isso impede consumo inesperado no Lovable AI.

## Configuração padrão

Crie um API Token na Cloudflare com a permissão de conta `Workers AI: Read`. Cadastre os valores abaixo apenas como secrets do servidor no ambiente publicado:

```text
AI_PROVIDER=cloudflare
AI_MODEL=@cf/google/gemma-4-26b-a4b-it
CLOUDFLARE_ACCOUNT_ID=<id da conta Cloudflare>
CLOUDFLARE_API_TOKEN=<token com Workers AI: Read>
```

Nunca use prefixo `VITE_` nesses valores e nunca exponha o token no navegador, em logs ou respostas.

O endpoint utilizado no servidor é:

```text
https://api.cloudflare.com/client/v4/accounts/<account-id>/ai/v1
```

Referências oficiais:

- https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/data-usage/

## Rollback explícito

O Lovable AI permanece disponível somente para uma troca operacional deliberada:

```text
AI_PROVIDER=lovable
AI_MODEL=google/gemini-2.5-flash
LOVABLE_API_KEY=<secret do Lovable>
```

Não configure `AI_PROVIDER=lovable` se o objetivo for evitar consumo do saldo Cloud & AI do Lovable.

## Controles aplicados

- autenticação obrigatória antes da chamada ao modelo;
- 10 requisições por minuto por usuário como proteção inicial;
- máximo de 2.000 caracteres por nova mensagem;
- somente as 12 mensagens mais recentes seguem para o modelo;
- no máximo 8 etapas de ferramenta por resposta;
- no máximo 1.200 tokens de saída por etapa;
- contas são agregadas por tipo antes de chegar ao modelo;
- buscas de transações retornam totais e rankings, não a lista bruta;
- nenhum fallback automático entre provedores.

O limite em memória é uma primeira barreira por instância. Antes de grande volume, ele deve ser complementado por uma cota distribuída por usuário e por workspace.
