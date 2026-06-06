# Mobile (React Native CLI)

Scaffold mínimo navegável do app PalpiteTodoDia, compartilhando tipos/schemas via
o pacote `shared`. Contém: navegação (stack + bottom tabs), auth via Supabase
(persistida no AsyncStorage) e 3 telas reais — Login, Início e Palpites.

## Estado atual

Este pacote tem **apenas o código JS/TS e as configs**. As pastas nativas
`ios/` e `android/` ainda **não existem** — elas são geradas pelo CLI do React
Native e não podem ser escritas à mão de forma confiável.

## Como tornar o app executável

1. Gere um projeto RN temporário com a **mesma versão** (`0.76.6`) e copie as
   pastas nativas para cá:

   ```bash
   npx @react-native-community/cli@latest init Tmp --version 0.76.6
   # copie Tmp/ios e Tmp/android para packages/mobile/, depois apague Tmp
   ```

   Ajuste o nome do app em `ios`/`android` para casar com `app.json`
   (`name: "mobile"`).

2. Instale as dependências a partir da raiz do monorepo:

   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:

   ```bash
   cp packages/mobile/.env.example packages/mobile/.env
   # preencha SUPABASE_URL e SUPABASE_ANON_KEY (anon, nunca service_role)
   ```

4. Rode:

   ```bash
   npm run android -w mobile     # Android (funciona no Windows/Linux/Mac)
   npm run ios -w mobile         # iOS — requer macOS + Xcode + `pod install`
   ```

> **iOS só compila em macOS.** No Windows, use o lado Android.

## O que falta para a paridade com a web

As demais áreas (notícias, academia, casas de apostas, ranking, dashboard,
admin, freelancer), o dark mode e o push (React Native Firebase) ainda não
foram implementados — este é um ponto de partida, não o app completo.
