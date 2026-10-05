# Contrato HTTP

JSON com propriedades em camelCase. A aplicação serve interface e API na mesma origem; não há autenticação nesta versão local.

| Método | Caminho | Resultado |
|---|---|---|
| GET | `/api/health` | Estado da aplicação |
| GET | `/api/config` | Indica modo de consulta |
| GET | `/api/tracks` | Faixas ativas |
| POST | `/api/tracks` | Cadastro de metadados de faixa; 201 |
| DELETE | `/api/tracks/{id}` | Exclusão lógica da faixa; 204 |
| GET | `/api/shows` | Apresentações com rascunho, aprovado e histórico |
| GET | `/api/shows/{id}` | Apresentação e snapshots |
| POST | `/api/shows` | Criação de apresentação; 201 |
| PUT | `/api/shows/{id}` | Salva nova revisão, com versão esperada |
| POST | `/api/shows/{id}/approve` | Aprova revisão atual, com versão esperada |
| POST | `/api/calculate` | Calcula e valida um plano |

## Plano

```json
{
  "name": "Festival fictício",
  "limitSeconds": 1800,
  "marginSeconds": 120,
  "items": [{
    "entryId": "uma-entrada-unica",
    "trackId": "leans-pt2",
    "title": "Leans, Pt. 2",
    "album": "237",
    "studioSeconds": 172,
    "liveSeconds": null,
    "introSeconds": 0,
    "pauseSeconds": 20,
    "energy": "",
    "cue": ""
  }]
}
```

Ao salvar, o servidor lê título, álbum e duração de gravação do catálogo, sem confiar nesses valores enviados pelo cliente. A entrada identifica uma ocorrência da faixa; a mesma faixa pode aparecer duas vezes, desde que tenha entryIds diferentes.

## Salvar e aprovar

`PUT /api/shows/{id}` recebe `{"expectedVersion": 1, "plan": ...}`. Aprovar recebe `{"expectedVersion": 2}`. Use a versão da resposta mais recente da apresentação.

Salvar ou aprovar incrementa a versão da apresentação. Cada salvamento de plano cria uma revisão numerada. Aprovar não cria outra revisão de conteúdo: aponta para um snapshot já existente. A resposta contém `draft`, `approved` (ou null) e `history`.

## Erros

- **400:** regra de negócio ou valor inválido, com `error` em português.
- **404:** apresentação/faixa inexistente.
- **409:** versão desatualizada; o cliente deve preservar as edições e oferecer recarregamento.
- **403:** escrita indisponível no modo de consulta.
- **413:** corpo informado acima de 1 MB. O servidor web também aplica seu limite padrão a requisições sem Content-Length.

Invariantes e testes estão em `SetlistFlow.Core` e no plano de qualidade.
