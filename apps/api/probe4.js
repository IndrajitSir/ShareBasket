process.env.NODE_ENV='test'
process.env.AUTH_SECRET='test-only-security-secret-at-least-32-chars'
process.env.PUBLIC_WEB_URL='http://localhost:3001'
process.env.SESSION_COOKIE_SECURE='false'
const { Test } = require('@nestjs/testing')
const { TypeOrmModule } = require('@nestjs/typeorm')
const request = require('supertest')
const { configureApp } = require('./dist/app.setup')
const { entities, migrations } = require('./dist/database/database-options')
const { AuthModule } = require('./dist/auth/auth.module')
const { SecurityModule } = require('./dist/security/security.module')
;(async () => {
  const captured = []
  const realWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = (chunk) => { captured.push(String(chunk)); return realWrite(chunk) }
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', entities, migrations, migrationsRun: true, synchronize: false, retryAttempts: 0 }),
      AuthModule, SecurityModule,
    ],
  }).compile()
  const app = moduleRef.createNestApplication()
  configureApp(app, { corsOrigins: ['http://localhost:3001'] })
  await app.init()
  const r = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ name: 'Pat Person', email: 'p@example.com', password: 'right-pass-123' })
  realWrite('STATUS=' + r.status + '\n')
  const mails = captured.filter((l) => l.includes('MAIL'))
  realWrite('MAIL LINES=' + mails.length + '\n' + mails.join('~~~~').slice(0, 800) + '\n')
  process.exit(0)
})().catch((e) => { process.stderr.write('ERR ' + e.stack + '\n'); process.exit(1) })
