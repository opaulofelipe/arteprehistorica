# Quiz — Arte Pré-Histórica

Quiz visual mobile-first feito somente com HTML, CSS e JavaScript. O banco contém 25 perguntas — cinco para cada continente — sem repetição dentro da mesma rodada.

## Arquivos

- `index.html`: estrutura e conteúdo da interface.
- `styles.css`: visual de papiro, responsividade, estados e animações.
- `script.js`: sorteio, progresso, persistência local, acessibilidade e feedback.
- `questions.json`: perguntas, opções, respostas, datas, locais, textos, imagens e fontes.
- `FONTES-E-LICENCAS.md`: referências históricas, créditos e decisões de pesquisa.

## Como executar

O navegador bloqueia `fetch()` em muitos arquivos abertos diretamente por `file://`. Sirva a pasta por HTTP.

Com Python:

```bash
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

Também funciona com Live Server, servidores estáticos de IDEs e hospedagens como GitHub Pages, Netlify ou Cloudflare Pages.

## Como editar as questões

Cada item de `questions.json` deve ter:

- um `id` único;
- exatamente quatro itens únicos em `choices`;
- um `answer` que também exista em `choices`;
- URL e descrição da imagem em `image`;
- `date`, `place`, `country`, `explanation` e a fonte histórica.

O JavaScript valida essas regras antes de iniciar. Ao mudar o banco, altere também o campo `version`; isso impede que um progresso antigo seja misturado com a versão nova.

## Comportamento

- A ordem das 25 perguntas é embaralhada no começo de cada rodada.
- As quatro alternativas também são embaralhadas.
- Um identificador só aparece uma vez na rodada.
- O progresso fica no `localStorage` do navegador e pode ser retomado.
- A descrição da imagem só é revelada após a resposta, para não entregar a solução a leitores de tela.
- Há animações de acerto e erro, com respeito a `prefers-reduced-motion`.
- Se uma imagem externa falhar, a interface oferece o link da fonte.

## Observação sobre as imagens

As fotografias e figuras científicas são carregadas de Wikimedia Commons, The Metropolitan Museum of Art e Nature. Isso mantém os créditos e as versões de acervo vinculados às fontes. Para uso totalmente offline, baixe cada imagem respeitando a licença descrita e troque `image.url` por um caminho local.
