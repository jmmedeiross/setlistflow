# Decisões de arquitetura

## Um aplicativo organizado em módulos

Domínio isolado em uma biblioteca C#, aplicação HTTP com ASP.NET Core, SQLite e interface sem framework. O domínio não depende de banco ou rede. O escopo não exige microsserviços, filas ou serviços de terceiros.

## Tempo em segundos inteiros

Evita arredondamento por ponto flutuante. A interface aceita minutos para o orçamento e mm:ss para a performance. As durações são somadas; crossfades e sobreposições ficam fora desta primeira versão.

## Snapshot por revisão

As tabelas tracks, shows e revisions formam a estrutura relacional. Cada revisão guarda o plano completo em JSON, incluindo metadados e instruções. Isso mantém um roteiro antigo legível mesmo quando uma faixa é desativada. O custo é não consultar cada instrução como uma linha relacional separada.

## Concorrência explícita

Transação de escrita SQLite e atualização condicional pelo número de versão. Duas requisições com a mesma versão não geram dois salvamentos: uma vence, outra retorna 409. Não existe atualização silenciosa de última escrita. O navegador mantém o rascunho local no conflito e oferece recarregamento confirmado pelo usuário.

## Publicação de demonstração

O workspace editável é local, sem identidade ou permissões por usuário. O modo de consulta bloqueia mutações da API e controles de edição da interface. Autenticação e autorização são requisitos de uma futura utilização real, não funcionalidades alegadas nesta entrega.

## Catálogo sem integração externa

Seis registros com fonte pública, sem download de conteúdo musical. A aplicação não depende da disponibilidade do Spotify nem de credenciais. O catálogo não indica repertório oficial, popularidade, BPM, tonalidade ou instruções reais do artista.
