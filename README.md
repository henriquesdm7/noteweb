# NoteWeb

Extensão para Chrome/Chromium (Manifest V3) que cola notas flutuantes em qualquer página. Quando você volta à página, cada nota está exatamente onde foi deixada.

## Instalação

```bash
npm install
npm run build
```

Depois, no Chrome:

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `dist/`.

Funciona também em Edge, Brave e Opera. As abas que já estavam abertas antes da instalação precisam ser recarregadas.

## Como usar

- **Criar uma nota:** pelo botão **+ Nova nota** no ícone da extensão, pelo clique direito → **Adicionar nota aqui** (a nota nasce no ponto clicado, já com o texto selecionado, se houver) ou com o atalho <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd>, que cria a nota onde está o mouse (ou no centro da tela, se o mouse estiver fora da página). Perto das bordas, a nota é deslocada para aparecer inteira.
- **Mover:** arraste pela barra superior. A nota fica presa ao conteúdo e rola junto com a página.
- **Redimensionar:** arraste o canto inferior direito.
- **Cor e ícone:** pelo botão de bolinha na barra da nota. O ícone é o que aparece quando a nota está minimizada.
- **Minimizar:** pelo botão `–` ou com duplo clique na barra. A nota vira uma bolinha no mesmo ponto: passe o mouse para ver a primeira linha, clique para abrir e arraste para mover.
- **Excluir:** pelo `×` na nota (pede confirmação se ela tiver texto) ou pela lixeira no popup.
- **Todas as notas e backup:** na página de opções (link no popup) você vê as notas de todas as páginas, busca, exclui e faz **Exportar/Importar** de um arquivo JSON. Na importação, quando a mesma nota existe dos dois lados, fica a versão editada por último.

## O que conta como "a mesma página"

A chave é `protocolo://host/caminho?query`:

- O `#hash` é ignorado.
- A barra final do caminho é removida.
- Os parâmetros da query são ordenados, então `?a=1&b=2` e `?b=2&a=1` são a mesma página.

Em sites que trocam de URL sem recarregar (YouTube, GitHub etc.), as notas mudam junto com o endereço.

## Limitações

- O Chrome não permite extensões em `chrome://`, na Chrome Web Store nem no visualizador de PDF.
- Arquivos locais (`file://`) só funcionam com **Permitir acesso a URLs de arquivo** ligado nos detalhes da extensão.
- As notas ficam no documento principal. Em sites que rolam dentro de um painel interno, e não na página, elas não acompanham essa rolagem. Iframes não recebem notas.
- Se o layout mudar com a largura da janela, a nota mantém as coordenadas salvas. Apenas é empurrada para dentro se ficar além da borda direita.
- Os dados ficam em `chrome.storage.local`, só neste navegador. Use o backup para levá-los a outro computador.

## Desenvolvimento

```bash
npm run dev     # build com recarga automática; carregue dist/ no Chrome
npm test        # testes (Vitest)
npm run build   # checagem de tipos + build de produção em dist/
npm run icons   # regenera os ícones PNG em public/icons/
```

Estrutura:

```
src/
  shared/      tipos, chave da página, storage, backup, ícones, mensagens
  content/     content script: camada em Shadow DOM, NoteView (arrastar, redimensionar, bolinha)
  background/  service worker: menu de contexto e atalho de teclado
  popup/       notas da página atual
  options/     todas as notas, busca, exportar/importar
  ui/          estilos e componentes compartilhados entre popup e opções
tests/         testes da chave da página e do backup
```

## Licença

[MIT](LICENSE). Os ícones das notas vêm do [Tabler Icons](https://tabler.io/icons), também MIT. O aviso de copyright deles está em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
