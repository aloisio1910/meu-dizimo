# app/ — rotas (Expo Router)

Cada arquivo `.tsx` aqui dentro vira uma tela, e o caminho do arquivo é o endereço dela.
`_layout.tsx` define a navegação (pilha, abas) de uma pasta.
Pastas entre parênteses, como `(membro)`, são **grupos**: organizam e permitem um layout
e uma regra de acesso próprios, mas **não aparecem no endereço**.

Aqui ficam só as telas. Lógica, componentes e acesso a dados ficam fora de `app/`.
