# Qualidade e evidências

## Verificações automatizadas

14 cenários em C#: soma das seis durações, pausas, estouro de limite, limite exato, override ao vivo, intro, reordenação, repertório vazio, durações inválidas, margem inválida, identificação de entradas, energia inválida, quantidade máxima e item nulo.

9 testes de integração: catálogo inicial e health; edição preservando o aprovado; versão desatualizada no salvamento e aprovação; rejeição de aprovação acima do limite; exclusão lógica preservando snapshot; metadados do cliente normalizados; entrada inválida/nula e recurso inexistente; persistência após reiniciar e bloqueio de mutações no modo de consulta; duas escritas simultâneas com uma resposta 200 e outra 409.

Resultados locais: **14/14 cenários de domínio e 9/9 testes de integração aprovados**; compilação sem avisos e sintaxe JavaScript válida. Os testes usam banco temporário e não enviam informações para serviços externos.

## Verificação de navegador

| Cenário | Evidência observada |
|---|---|
| 20 minutos, margem 2, set 18:58 | Alerta de excesso de 0:58 e aprovação desabilitada |
| Aprovação da revisão 1 | Modo palco habilitado e revisão aprovada identificada |
| Editar faixa para 2:30, intro 10s | Novo total 18:46 e revisão 2 no histórico |
| Abrir palco antes de aprovar a edição | Usa revisão 1, com performance estimada de 2:52 |
| Segunda sessão salva versão antiga | Aviso de conflito; nome editado continua na tela |
| Adicionar e remover Viciar | Total sobe de 18:46 para 22:01 e volta ao valor anterior |
| Reordenar uma faixa e voltar | Metadados e instruções preservados |

## Ajuste encontrado durante a verificação

Campos das faixas atualizavam o estado apenas no evento change, deixando o botão de salvar desabilitado enquanto a edição estava no campo. O tratamento passou a responder também a input. A atualização do total e o salvamento foram verificados novamente no navegador.

## Próximas melhorias de qualidade

Automatizar os fluxos de navegador no CI, medir acessibilidade com ferramentas dedicadas e testar a imagem Docker. Autenticação e permissões precisam ser verificadas quando implementadas.
