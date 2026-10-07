# Banho e Tosa Pet Peludinho — Site

Site institucional simples (HTML + CSS + JS puro, sem build) para o
Banho e Tosa Pet Peludinho, na Penha, São Paulo.

## Estrutura de arquivos

```
peludinho-site/
├── index.html          → Página inicial (apresentação + galeria de cães)
├── sobre.html           → Página "Contato" (endereço, telefone, Instagram, mapa)
├── css/style.css        → Estilo do site
├── js/script.js         → Menu mobile + efeito de foto ainda não enviada
└── images/
    ├── logo.png          → Logo da empresa (já incluído)
    └── dogs/              → Fotos dos cães (página inicial)
```

## Como adicionar as fotos que faltam

Enquanto uma foto não existir, o site mostra um quadradinho bonito com
"Foto em breve" no lugar dela — nada quebrado aparece para quem visita.
Assim que você adicionar o arquivo com o **nome certo**, a foto real
aparece automaticamente, sem precisar mexer em nenhum código.

**Fotos dos cães** (aparecem em `index.html`) — ✅ já adicionadas em
`images/dogs/` (`dog1.jpg` a `dog7.jpg`). Quer trocar ou adicionar mais?
Basta salvar com esse mesmo padrão de nome (`dog8.jpg`, `dog9.jpg`...) e
copiar mais um bloco `<div class="gallery-item">...</div>` no HTML.

Dicas:
- Pode ser `.jpg`, `.jpeg` ou `.png` — só ajuste a extensão no nome do
  arquivo (ex: se salvar `dog1.png`, troque `dog1.jpg` por `dog1.png`
  dentro do `index.html`, na tag `<img src="...">`).
- Se quiser mais ou menos fotos do que 6 em alguma galeria, copie ou
  apague o bloco `<div class="gallery-item">...</div>` correspondente
  no HTML.
- Fotos na horizontal e bem iluminadas costumam ficar melhores na
  galeria (o layout corta a imagem em formato quadrado).

## O que eu preenchi com informações-modelo (revise antes de publicar)

Como você ainda não tinha me passado esses detalhes, usei valores
de exemplo — procure e ajuste à vontade em `index.html` e `sobre.html`:

- **Horário de funcionamento** (segunda a sexta 8h–18h, sábado 8h–14h)
- **Lista de serviços** (banho, tosa higiênica, tosa na tesoura,
  hidratação, corte de unhas, limpeza de ouvidos) — inclua preços se
  quiser
- **Textos/slogans** da página inicial

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `peludinho-site`).
2. Suba todos os arquivos desta pasta para a raiz do repositório
   (mantendo a estrutura de pastas `css/`, `js/`, `images/`).
3. No repositório, vá em **Settings → Pages**.
4. Em **Source**, selecione a branch `main` e a pasta `/ (root)`.
5. Salve e aguarde alguns minutos — o GitHub vai te dar um link tipo
   `https://seuusuario.github.io/peludinho-site/`.

Se preferir usar o Git pelo terminal:

```bash
cd peludinho-site
git init
git add .
git commit -m "Site Banho e Tosa Pet Peludinho"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/peludinho-site.git
git push -u origin main
```

Depois é só ativar o GitHub Pages como no passo a passo acima.
