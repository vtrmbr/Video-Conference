import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import type { ServerConfig } from './config.js';
import { AppError } from './errors.js';
import {
  admissionDecisionSchema,
  createRoomSchema,
  moderationActionSchema,
  participantParamsSchema,
  roomParamsSchema,
  tokenRequestSchema,
} from './schemas.js';
import { LiveKitRoomService, type RoomService } from './services/roomManagement.js';
import { SessionCredentialService } from './services/sessionCredentials.js';
import { LiveKitTokenIssuer, type TokenIssuer } from './services/tokenService.js';

interface BuildAppOptions {
  config: ServerConfig;
  tokenIssuer?: TokenIssuer;
  roomService?: RoomService;
  credentialService?: SessionCredentialService;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions) {
  const { config } = options;
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers.set-cookie',
                '*.participantToken',
              ],
              censor: '[REDACTED]',
            },
          },
    requestIdHeader: 'x-request-id',
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.webOrigins.includes(origin)) callback(null, true);
      else callback(new AppError('Origem não permitida.', 403, 'ORIGIN_NOT_ALLOWED'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
  });

  const credentialService =
    options.credentialService ?? new SessionCredentialService(config.livekitApiSecret);
  const roomService = options.roomService ?? new LiveKitRoomService(config, credentialService);
  const tokenIssuer =
    options.tokenIssuer ?? new LiveKitTokenIssuer(config, roomService, credentialService);

  app.get('/api/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/config', () => ({
    livekitUrl: config.livekitUrl,
    livekitConfigured: config.livekitConfigured,
    meetingMode: config.meetingMode,
    maxParticipants: config.maxParticipants,
    advancedNoiseFilterEnabled: config.advancedNoiseFilterEnabled,
  }));

  app.post(
    '/api/rooms',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!config.livekitConfigured) {
        throw new AppError('LiveKit não está configurado.', 503, 'LIVEKIT_NOT_CONFIGURED');
      }
      const { approvalRequired } = createRoomSchema.parse(request.body);
      const created = credentialService.createRoom(approvalRequired);
      await roomService.initializeRoom(created.roomName, approvalRequired);
      return reply.header('Cache-Control', 'no-store').send(created);
    },
  );

  app.get('/api/rooms/:roomName/status', async (request, reply) => {
    const { roomName } = roomParamsSchema.parse(request.params);
    const status = await roomService.getStatus(roomName);
    return reply.header('Cache-Control', 'no-store').send(status);
  });

  app.get('/api/rooms/:roomName/admissions', async (request, reply) => {
    const { roomName } = roomParamsSchema.parse(request.params);
    const result = await roomService.getAdmissions(
      roomName,
      extractBearer(request.headers.authorization),
    );
    return reply.header('Cache-Control', 'no-store').send(result);
  });

  app.post(
    '/api/rooms/:roomName/admissions/:participantIdentity',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { roomName, participantIdentity } = participantParamsSchema.parse(request.params);
      const { decision } = admissionDecisionSchema.parse(request.body);
      await roomService.decideAdmission(
        roomName,
        participantIdentity,
        decision,
        extractBearer(request.headers.authorization),
      );
      return reply.header('Cache-Control', 'no-store').send({ decision, participantIdentity });
    },
  );

  app.post(
    '/api/rooms/:roomName/participants/:participantIdentity/actions',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { roomName, participantIdentity } = participantParamsSchema.parse(request.params);
      const { action } = moderationActionSchema.parse(request.body);
      const resumeCredential = extractBearer(request.headers.authorization);
      const result = await roomService.moderate(
        roomName,
        participantIdentity,
        action,
        resumeCredential,
      );
      request.log.info(
        { roomName, participantIdentity, action },
        'Participant moderation action completed',
      );
      return reply.header('Cache-Control', 'no-store').send(result);
    },
  );

  app.post(
    '/api/token',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const payload = tokenRequestSchema.parse(request.body);
      const response = await tokenIssuer.issue(payload);
      request.log.info(
        { roomName: payload.roomName, participantIdentity: payload.participantIdentity },
        'LiveKit join token issued',
      );
      return reply.header('Cache-Control', 'no-store').send(response);
    },
  );

  app.setNotFoundHandler(async (_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }),
  );

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Os dados enviados são inválidos.',
          fields: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    request.log.error({ err: error }, 'Request failed');
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
        message:
          statusCode === 429
            ? 'Muitas solicitações. Aguarde um momento.'
            : 'O servidor não conseguiu concluir a solicitação.',
      },
    });
  });

  return app;
}

function extractBearer(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
}
