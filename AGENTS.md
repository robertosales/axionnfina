<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Supabase — preferência do usuário

- O usuário administra o Supabase exclusivamente pelo Lovable.
- Prepare migrations SQL e instruções concretas para o usuário executar pelo Lovable; não presuma acesso direto ao banco nem solicite credenciais.
- Não marque migrations, RLS ou regeneração de tipos como validadas sem receber o resultado da execução no Supabase.
