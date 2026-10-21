# i18n/ — traduções

`index.ts` liga o i18next ao app. `locales/` tem um arquivo JSON por idioma,
começando por `pt-BR.json`. Nas telas, use `const { t } = useTranslation()` e
`t('chave')`; nunca escreva texto direto no componente.
Chaves inexistentes dão erro no TypeScript (ver `i18next.d.ts`).
