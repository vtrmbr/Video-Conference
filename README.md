# UFMG Video Conference

Videoconferência profissional em navegador, otimizada para estabilidade e continuidade do áudio. O cliente usa React, TypeScript, Vite, Tailwind e os componentes oficiais do LiveKit; o servidor Fastify emite tokens curtos sem expor o segredo da API.

## Arquitetura

```text
Browser (React) ──HTTPS──> Fastify token API
       │                         │
       │ WSS + WebRTC            │ LiveKit Server SDK
       ▼                         ▼
             LiveKit Cloud SFU
       ICE/UDP → TURN/UDP → ICE/TCP → TURN/TLS
```

O SFU recebe uma publicação de cada participante e encaminha a camada adequada aos assinantes. Isso evita a complexidade de uma malha P2P. A interface pagina miniaturas e assina somente as câmeras visíveis, ficando preparada para até 100 participantes; a capacidade efetiva também depende do plano e das cotas do LiveKit Cloud. O LiveKit Cloud administra SFU, sinalização, seleção de edge e TURN; este repositório não sobe LiveKit self-hosted.

```text
apps/web       React/Vite, lobby, sala e diagnóstico
apps/server    Fastify, validação e emissão segura de tokens
packages/shared tipos e classificador de qualidade testado
packages/config constantes de mídia e persistência
```

## Requisitos

- Node.js 22 ou superior e npm 10 ou superior;
- conta e projeto no [LiveKit Cloud](https://cloud.livekit.io/);
- Chrome, Edge, Firefox ou Safari moderno;
- HTTPS em produção. `localhost` é aceito como contexto seguro durante o desenvolvimento;
- Docker 24+ apenas se desejar a execução em contêineres.

## Configuração do LiveKit Cloud

1. Crie um projeto no LiveKit Cloud.
2. Em **Project settings**, copie a Project URL (`wss://...livekit.cloud`).
3. Crie uma API key/secret para o backend.
4. Copie `.env.example` para `.env` e preencha:

```dotenv
LIVEKIT_URL=wss://seu-projeto.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
WEB_ORIGIN=http://localhost:5173
PORT=3001
VITE_API_URL=http://localhost:3001
```

`LIVEKIT_API_SECRET` nunca usa o prefixo `VITE_` e nunca é incluído no bundle do navegador.

## Instalação e execução local

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`, crie uma sala e abra o link em dois navegadores ou perfis diferentes. Para entrar diretamente:

```text
http://localhost:5173/join/7F3K9Q
```

Comandos úteis:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run dev:web
npm run dev:server
```

## Fluxo e confiabilidade

O lobby abre automaticamente a confirmação de câmera e microfone quando algum deles está habilitado, mantém um botão de nova tentativa se o navegador bloquear a solicitação e permite participação sem câmera ou somente para ouvir. Nome, dispositivos e estados de mídia ficam salvos localmente. Antes da conexão, todo `MediaStreamTrack` do preview é encerrado. O preflight mede três RTTs HTTP; RTT WebRTC, jitter, perda, upload disponível e transporte ICE são exibidos somente depois que `RTCStatsReport` ou o LiveKit fornecem dados reais.

Na sala, o SDK nativo controla reconexão. A UI escuta `Reconnecting`, `Reconnected` e `Disconnected`; não existe um loop concorrente de reconexão da aplicação. A coleta de estatísticas roda a cada 1,5 segundo, impede execuções sobrepostas e limpa o intervalo ao desmontar. Abra o painel com **Ctrl + Shift + D**.

Uma sessão ativa guarda identidade, preferências e uma credencial de retomada assinada. Ao atualizar `/join/:room`, o frontend solicita um token novo e volta automaticamente; uma saída explícita desativa essa retomada. Na página inicial, a última chamada só é recomendada quando a API confirma que ainda existe alguém conectado. Salas são criadas com 60 segundos de tolerância após a última saída, permitindo uma reconexão breve; terminado esse prazo, o LiveKit encerra a sala vazia e seus recursos.

Ao criar a sala, o criador pode exigir aprovação administrativa. Nesse modo, o pedido mantém uma identidade estável, inclusive após F5, e o lobby aguarda sem receber credenciais de entrada. Administradores veem um contador de solicitações no botão **Gerenciar**, podem aceitar ou recusar cada pessoa e, após a aceitação, o convidado entra automaticamente. A fila expira pedidos abandonados depois de 30 minutos e é limitada a 100 itens.

O painel **Dispositivos** também personaliza as miniaturas: topo, base, esquerda ou direita; tamanhos pequeno, médio e grande; sobrepostas ou reservando espaço próprio. A barra pode ser recolhida. Para salas grandes, a paginação limita a 20, 12 ou 8 miniaturas montadas de cada vez e câmeras fora da página são desassinadas, preservando áudio e compartilhamentos.

### Áudio

- Opus com preset de fala, mono, echo cancellation, noise suppression e automatic gain control do navegador;
- Audio RED habilitado para faixas mono e DTX em silêncio;
- o áudio remoto é renderizado pelo `RoomAudioRenderer` oficial, inclusive áudio da tela;
- falha de câmera não derruba uma chamada já conectada em áudio;
- `ENABLE_ADVANCED_NOISE_FILTER` prepara a sinalização pública de feature flag. A instalação de um processador Krisp deve ser feita somente com a integração licenciada/compatível escolhida; o MVP não simula esse processamento.

### Vídeo e compartilhamento

- 720p/30 por padrão no modo `high-reliability`;
- opção manual de 1080p/30 quando hardware e rede suportarem;
- VP8 como padrão pragmático por estabilidade entre Chrome, Edge, Firefox e Safari;
- simulcast com camadas 180p, 360p e publicação principal 720p;
- adaptive stream reduz a recepção conforme o tamanho/visibilidade do elemento;
- dynacast pausa camadas que ninguém consome;
- câmera usa `maintain-framerate`, degradando resolução primeiro;
- tela usa 1080p/15 e presets de baixa taxa para preservar legibilidade.

VP9 e AV1 podem economizar banda, mas suporte, aceleração de hardware e custo de CPU ainda variam. H.264 é uma alternativa importante em ecossistemas Apple/hardware específico. Para esta reunião, VP8 reduz surpresas; codecs avançados devem entrar por teste controlado, não por detecção nominal de navegador.

## Classificação de rede

O algoritmo central em `packages/shared/src/index.ts` combina limiares operacionais de perda, RTT, jitter, bitrate de saída e qualidade nativa LiveKit. O pior sinal limita a média para que, por exemplo, 12% de perda não seja escondido por bitrate alto. Os limiares têm testes unitários e a UI usa `unknown` quando não há medições.

## Segurança

- Zod valida tamanho, formato e caracteres de sala, nome e identidade;
- tokens expiram por padrão em 10 minutos e só concedem join, publish, subscribe e data na sala solicitada;
- grants administrativos do navegador ficam explicitamente desabilitados; toda moderação usa a API autenticada do backend;
- respostas de token usam `Cache-Control: no-store`;
- rate limit global e limite mais estrito em `/api/token`;
- CORS aceita somente origens de `WEB_ORIGIN` (lista separada por vírgulas);
- Helmet, erros globais sem stack trace e logs Pino estruturados com request ID;
- token, cookies e authorization são redigidos dos logs;
- identidade opaca é gerada com `crypto.randomUUID()` e não contém PII;
- emissão verifica participantes ativos, lotação e mantém uma reserva curta em memória contra corridas/reemissão imediata;
- retomada de uma identidade duplicada exige sua credencial HMAC assinada e limitada àquela sala/identidade;
- o segredo do criador não entra no link compartilhado; admins e banidos ficam nos metadados da sala LiveKit enquanto ela existir;
- criadores e admins delegados podem silenciar, desligar câmera, remover e banir convidados pela API; um admin delegado não pode moderar o criador;
- em salas protegidas, nenhum token de convidado é emitido antes da aprovação; consultar e decidir pedidos exige a credencial administrativa assinada e um admin conectado;
- `RESERVED_ROOMS=true` e `ALLOWED_ROOMS=A1B2C3,D4E5F6` restringem salas conhecidas.

Este MVP deliberadamente não tem contas nem banco. Em produção, autorização real deve validar um convite assinado ou uma sessão antes de emitir o token. Reservas e rate limits em memória devem migrar para um armazenamento compartilhado (por exemplo, Redis) se houver mais de uma instância do backend. Para revogação forte, controle de agenda, auditoria e convites de uso único, adicione um serviço de identidade e persistência. Não coloque nomes, e-mails ou telefones em `participantIdentity` ou `roomName`, pois esses identificadores aparecem em logs de infraestrutura.

## API

```text
GET  /api/health                                      status do backend
GET  /api/config                                      configuração pública e segura
POST /api/rooms                                       cria código e credencial privada do criador
GET  /api/rooms/:room/status                          confirma participantes ativos
GET  /api/rooms/:room/admissions                      lista pedidos pendentes (admin)
POST /api/rooms/:room/admissions/:id                  aceita ou recusa um pedido (admin)
POST /api/token                                       emite token LiveKit e credencial de retomada
POST /api/rooms/:room/participants/:id/actions        executa moderação autenticada
```

Exemplo:

```bash
curl -X POST http://localhost:3001/api/token \
  -H "Content-Type: application/json" \
  -d '{"roomName":"7F3K9Q","participantName":"Guest","participantIdentity":"guest_12345678"}'
```

## Testes e revisão

Vitest cobre token/grants/expiração, credenciais adulteradas, retomada após F5, timeout de sala, moderação, banimento, validação, erros, rate limiting, classificador de rede, preflight e UX de reconexão. O TypeScript está em modo estrito e a build usa Vite.

```bash
npm run typecheck
npm run test:run
npm run build
```

## Docker

O Compose contém apenas web e API; a mídia continua no LiveKit Cloud.

```bash
cp .env.example .env
# preencha as credenciais
docker compose up --build
```

Abra `http://localhost:8080`. Em um domínio real, termine TLS no load balancer/reverse proxy e ajuste `WEB_ORIGIN` e `VITE_API_URL` para URLs HTTPS públicas.

## Deploy recomendado: Vercel + Render + LiveKit Cloud

O caminho mais previsível para esta arquitetura é:

```text
Vercel (React/Vite estático) ──HTTPS──> Render (Fastify/token API)
           │                                  │
           └──────────── WSS/WebRTC ──────────┴──> LiveKit Cloud
```

A mídia não passa pela Vercel nem pelo Render: o navegador conecta diretamente ao LiveKit. O backend só valida a sala e emite tokens. O arquivo `vercel.json` já configura build do monorepo, saída `apps/web/dist`, headers de segurança e fallback de SPA para links `/join/...`. O `render.yaml` já descreve a API Node, health check e variáveis obrigatórias. O plano `starter` foi escolhido no blueprint para evitar suspensão e cold start antes de uma chamada; altere conscientemente se preferir outro plano.

### 1. Publicar o repositório

Este diretório precisa estar em um repositório Git acessível pela Vercel e pelo Render:

```bash
git init
git add .
git commit -m "Prepare production deployment"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Não versione `.env`. Ele já está ignorado; as credenciais serão cadastradas nos painéis dos provedores.

### 2. Subir a API no Render

1. No Render, escolha **New → Blueprint** e conecte o repositório. O serviço será criado pelo `render.yaml`.
2. Preencha os secrets `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET`.
3. Em `WEB_ORIGIN`, informe a futura origem exata da Vercel, por exemplo `https://ufmg-video.vercel.app`. É possível informar várias origens separadas por vírgula.
4. Confirme o deploy e teste `https://SEU_BACKEND.onrender.com/api/health`.

O serviço precisa continuar na raiz do monorepo porque usa o lockfile e `packages/shared`. O Render exige bind em `0.0.0.0`; `HOST` e o health check já estão configurados. Consulte a documentação oficial de [Web Services](https://render.com/docs/web-services) e [monorepos](https://render.com/docs/monorepo-support).

### 3. Subir o frontend na Vercel

1. Na Vercel, escolha **Add New → Project**, importe o mesmo repositório e mantenha a **Root Directory** na raiz.
2. O `vercel.json` define `npm run build:web` e `apps/web/dist`; não sobrescreva esses campos no painel.
3. Cadastre `VITE_API_URL=https://SEU_BACKEND.onrender.com` nos ambientes Production e Preview.
4. Faça o deploy. Depois copie o domínio definitivo da Vercel para `WEB_ORIGIN` no Render e redeploye a API caso tenha usado um endereço temporário.
5. Abra diretamente `https://SEU_SITE.vercel.app/join/TEST1234` para confirmar o fallback de SPA, crie uma sala e teste em dois navegadores.

`VITE_API_URL` é incorporada no build, portanto qualquer alteração exige novo deploy do frontend. As chaves secretas do LiveKit permanecem apenas no Render. A configuração segue a documentação oficial de [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [builds de monorepo](https://vercel.com/docs/monorepos) e [configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json).

Em produção:

- frontend e backend precisam de HTTPS;
- `LIVEKIT_URL` precisa usar `wss://`;
- use a origem exata do frontend no CORS; não use `*` para a API de tokens;
- não faça proxy do tráfego de mídia pelo backend;
- valide as cotas do plano LiveKit antes de uma reunião com dezenas de pessoas;
- libere os destinos/portas descritos no [guia de firewall do LiveKit Cloud](https://docs.livekit.io/deploy/admin/firewall/).

O LiveKit tenta, nessa ordem geral, ICE/UDP, TURN/UDP, ICE/TCP e TURN/TLS. O último fallback é importante em redes corporativas restritas. Consulte também a documentação oficial de [conexão e reconexão](https://docs.livekit.io/intro/basics/connect/), [tokens e grants](https://docs.livekit.io/frontends/reference/tokens-grants/) e [SDK JS](https://docs.livekit.io/reference/client-sdk-js/).

## Troubleshooting

**Câmera/microfone bloqueados:** use o ícone de permissão do navegador, feche outros aplicativos que estejam usando o dispositivo e recarregue. No macOS/Windows, confirme também a permissão do sistema.

**Sem áudio remoto:** clique em “Ativar áudio da chamada”. Safari e outros navegadores podem bloquear autoplay antes de um gesto.

**Funciona em uma rede e falha em outra:** teste sem VPN. Em firewall corporativo, permita WSS/TCP 443 para `*.livekit.cloud`, TURN/TLS TCP 443 e, idealmente, UDP conforme o guia oficial.

**Qualidade ruim:** abra Ctrl + Shift + D. Perda alta sugere Wi-Fi/interferência; RTT alto sugere rota/VPN/distância; TURN/TCP pode indicar bloqueio de UDP. Reduza para 720p ou desligue a câmera antes de comprometer o áudio.

**Token expirado:** volte ao lobby e entre novamente. A expiração limita a conexão inicial; o LiveKit mantém os mecanismos próprios de reconexão de uma sessão ativa.

**Sala cheia:** `MAX_PARTICIPANTS` aceita de 2 a 100 e usa 100 por padrão. Ao atingir o limite, a API retorna `ROOM_FULL`. Identidade já ativa retorna `DUPLICATE_IDENTITY`.

## Production Meeting Checklist

- use Ethernet em vez de Wi-Fi;
- deixe um hotspot 4G/5G testado como reserva;
- mantenha um segundo notebook conectado, com câmera e microfone desligados;
- faça um teste completo 30 minutos antes;
- tenha Meet ou Teams preparado como fallback externo;
- conecte os equipamentos à tomada;
- atualize o navegador com antecedência, não minutos antes;
- reinicie a máquina antes da reunião importante;
- feche downloads, torrents, cloud sync e streaming;
- desabilite VPN se ela não for necessária;
- confirme câmera, microfone, caixas de som e compartilhamento;
- deixe o painel de diagnóstico acessível e registre o horário de qualquer incidente.

Software não elimina uma queda física total. A combinação de Ethernet, link móvel reserva, segundo equipamento e um serviço externo alternativo é parte da confiabilidade operacional.
