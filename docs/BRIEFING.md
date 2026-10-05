# SetlistFlow — planejamento de shows

## Natureza do projeto

Projeto independente de portfólio de João Medeiros. Briefing simulado com Yunk Vino como artista de referência. Não houve solicitação, contratação, parceria ou aprovação pelo artista ou por sua equipe. As situações de produção e os shows apresentados são fictícios.

## Solicitação simulada, na perspectiva da equipe

“Precisamos de uma ferramenta para preparar o repertório de cada apresentação. Queremos organizar a ordem das músicas, considerar as versões usadas no palco, reservar tempo para falas e transições e entregar à equipe um roteiro claro. Se o tempo disponível mudar, precisamos ajustar o show sem perder as instruções de operação.”

Este texto foi criado para o estudo de caso; não é uma declaração real de Yunk Vino.

## Problema

Uma playlist informa a ordem das gravações, mas o planejamento de um show também precisa considerar cortes, intros, pausas, participações e orientações para DJ, áudio e iluminação. O projeto explora esse problema de produção musical sem afirmar que ele ocorre na equipe real do artista.

## Usuários previstos

- Produção: define o tempo disponível e prepara o repertório.
- Artista e direção musical: revisam a sequência e as versões das músicas.
- DJ e equipe de palco: consultam o roteiro aprovado e suas instruções.

## Primeira versão

1. **Catálogo de faixas:** título, projeto/álbum, duração de estúdio, fonte e data de consulta. Duração ao vivo é um campo separado e editável.
2. **Planejamento de apresentação:** nome fictício do evento, tempo máximo, margem de segurança e ordem das faixas.
3. **Versão de palco:** apresentação completa ou trecho, duração planejada, intro, pausa posterior e observações.
4. **Cálculo do tempo:** total das versões ao vivo, intros e pausas; diferença para o limite; indicação clara quando ultrapassa o tempo.
5. **Roteiro técnico:** instruções opcionais para entrada da base, áudio e iluminação. Nenhum arquivo de música será incluído no repositório.
6. **Reordenação:** mover faixas para cima/baixo ou arrastar, com controles acessíveis por teclado.
7. **Revisões:** salvar rascunho, aprovar uma versão e consultar versões anteriores. Uma edição cria nova revisão, preservando o roteiro aprovado.
8. **Modo palco:** roteiro legível no celular, com números grandes, faixa atual, próxima faixa e anotações. A duração é planejada; a aplicação não detecta automaticamente o áudio executado.
9. **Exportação:** documento imprimível/PDF pelo navegador com ordem, tempos e instruções, identificando a revisão e a natureza demonstrativa do projeto.

## Regras de negócio

- Todos os cálculos usam segundos inteiros; a interface exibe minutos e segundos.
- A duração ao vivo não é deduzida da gravação. Quando ausente, o cálculo pode usar a duração de estúdio, mas deve identificar essa estimativa.
- Total planejado = soma das durações selecionadas + intros + pausas. Na primeira versão, não há sobreposição/crossfade automática.
- Limite utilizável = tempo máximo − margem de segurança.
- Estourar o limite gera alerta e impede aprovar o roteiro até ajustar o planejamento.
- Durações negativas, títulos vazios e margem maior que o tempo disponível são rejeitados.
- Excluir uma faixa do catálogo não pode apagar o conteúdo de um roteiro já aprovado: a revisão guarda uma cópia dos dados usados.
- Cada alteração usa um número de versão. Se outra pessoa salvar antes, a aplicação informa conflito em vez de sobrescrever silenciosamente.
- BPM, tonalidade e energia são opcionais. Não serão apresentados como dados reais sem uma fonte ou análise válida. Energia informada manualmente é uma avaliação de planejamento.
- Participações e instruções de palco dos exemplos são fictícias e identificadas como tal.

## Catálogo demonstrativo inicial

Os nomes e as durações abaixo representam gravações disponíveis no Spotify. Não constituem o repertório real de um show do artista. A interface deverá indicar a origem e distinguir gravação de versão ao vivo.

| Faixa | Projeto | Duração de estúdio |
|---|---|---|
| Leans, Pt. 2 | 237 | 2:52 |
| Flashbacks | 237 | 2:44 |
| Fim | 237 | 3:04 |
| Amiri | MR. | 2:46 |
| Safety | MR. | 2:37 |
| Viciar | MR. | 3:15 |

Fontes consultadas em 5 de outubro de 2026:

- [237 no Spotify](https://open.spotify.com/embed/album/3VGvkH5X8bhjIV0rSohaVU)
- [MR. no Spotify](https://open.spotify.com/album/5VOHcEH6D1DMngkxky552g)

Não importar capas, letras, áudios ou imagens do artista. O produto terá identidade visual própria. Os links das fontes abrem o catálogo externo; não dependem de tokens de acesso.

## Critérios de aceitação

- As seis gravações da tabela somam **17:18**. Com cinco pausas de 20 segundos entre elas, o planejamento soma **18:58**.
- Em um cenário fictício de 20 minutos com margem de segurança de dois minutos, esse planejamento excede o limite utilizável em **0:58**, e não pode ser aprovado.
- Ao ajustar as pausas ou as versões de palco, o total e o alerta são recalculados.
- Reordenar faixas preserva suas instruções e não altera o total.
- A exportação corresponde à revisão aprovada, mesmo que exista um rascunho mais recente.
- Salvar duas alterações simultâneas na mesma revisão produz um conflito identificável; nenhuma alteração é perdida silenciosamente.
- Não há contatos pessoais, credenciais, arquivos musicais ou eventos reais nos dados de demonstração.

## Proposta técnica para o portfólio

Backend em C# com ASP.NET Core, banco relacional e testes das regras de negócio e das operações de API. Interface web responsiva, com JavaScript/TypeScript, e testes de fluxo no navegador. GitHub Actions executa as verificações; Docker facilita executar o ambiente.

Escolher o banco e a biblioteca de interface na implementação. Um aplicativo organizado com módulos de catálogo, apresentações e revisões é suficiente para o escopo inicial; não há necessidade de microsserviços.

## Evidências para candidatura

- Modelagem de dados: faixa, versão de palco, apresentação, item do repertório e revisão.
- Backend: validação, cálculo de duração, persistência e controle de concorrência.
- Qualidade: testes de limite de tempo, dados inválidos, revisões e conflitos; casos de teste e relatório de defeitos.
- Frontend: interação acessível, adaptação ao celular e impressão.
- Engenharia: documentação da API, histórico de decisões, execução reproduzível e verificações automatizadas.

No currículo, mencionar apenas funcionalidades implementadas e demonstráveis. Exemplo após a entrega: “Desenvolvi uma aplicação de planejamento de shows com cálculo de duração, revisões de repertório e testes automatizados, em um estudo de caso independente inspirado no catálogo de Yunk Vino.”

## Sequência de implementação

1. Cálculo de duração e testes, com o catálogo demonstrativo.
2. API e persistência de apresentações e itens.
3. Interface para montar e ajustar o repertório.
4. Revisões, aprovação e proteção contra alterações concorrentes.
5. Modo palco, exportação, testes de fluxo e demonstração pública.

## Entregas e situação atual

Este briefing orientou a primeira versão implementada. O README descreve as funcionalidades entregues, como executar, as verificações realizadas e os limites atuais. Autenticação, uso real por organizações e análise de áudio não fazem parte desta versão.
