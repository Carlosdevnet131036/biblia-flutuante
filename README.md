# Bíblia Flutuante

Abra `Abrir Bíblia.bat` ou execute `npm start`.

- **Lupa / Ctrl+F:** busca por referência (`João 3:16`, `Sl 23`, `1 Co 13:4`) ou palavras na tradução atual. A busca ignora acentos e maiúsculas. Use Enter para abrir o primeiro resultado.
- **Ícone de páginas / Ctrl+M:** alterna entre livro aberto e uma página compacta. O tamanho da fonte é preservado.
- **Ajustes e backup:** tamanho da letra, tema, transparência, escala, exportação e restauração de dados.
- **Anotações:** organize cada versículo com até 8 temas (por exemplo, `Fé, Família`). Escreva os temas separados por vírgulas na anotação ou na folha de estudo. Eles são salvos imediatamente e incluídos nos backups.
- **Filtros das anotações:** combine tema, cor e busca por texto, referência ou tema. A busca ignora acentos e maiúsculas; use **Sem tema** para encontrar anotações antigas e **Limpar filtros** para voltar à lista completa.
- **Setas:** página anterior e seguinte. **Esc:** fecha o painel atual.

As traduções são baixadas na primeira abertura e ficam disponíveis offline depois disso.

## Salvamento e backup

Cada edição de nota, estudo ou voto é gravada imediatamente, com confirmação de sucesso ou aviso de erro. Os dados existentes do aplicativo são migrados automaticamente na primeira abertura desta versão.

Os dados ficam em `%APPDATA%\biblia-flutuante\meus-dados.json`. O arquivo `meus-dados.anterior.json` preserva a versão anterior à primeira alteração da sessão. Se o arquivo principal estiver inválido, o aplicativo tenta recuperar essa cópia.

Use **Exportar backup** para criar um arquivo JSON com suas anotações, destaques, estudos, votos e posição de leitura. **Restaurar backup** valida o arquivo e pede confirmação antes de substituir os dados, preservando uma cópia do conteúdo anterior. Arquivos danificados são preservados quando uma restauração explícita é feita.

## Verificação

Execute `npm test` para verificar persistência imediata, recuperação, validação e restauração de backup, busca e sintaxe do código de interface.

Para gerar as capturas e verificar a interface real do Electron, execute `node_modules\electron\dist\electron.exe tests/visual-main.js`. A verificação usa um perfil separado em `artifacts/test-profile`, sem alterar seus dados, e salva as imagens e o relatório `artifacts/verificacao.json`.

## Usar no iPhone (app web)

O mesmo código roda no navegador: `web-api.js` substitui a ponte do Electron, guardando os dados no próprio aparelho e baixando as traduções na primeira leitura (depois funcionam offline).

1. Abra o endereço do GitHub Pages no **Safari** do iPhone.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone criado: o app abre em tela cheia. Deslize para os lados para virar as páginas.

Os dados do iPhone ficam separados dos do computador. Use **Ajustes → Exportar/Restaurar backup** para levar suas anotações de um para o outro.
