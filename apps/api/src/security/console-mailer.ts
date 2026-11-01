import { Inject, Injectable, Logger } from '@nestjs/common'

import { AUTH_CONFIG } from '../auth/auth.constants'
import type { AppConfig } from '../config/app-config'

export interface MailMessage {
  to: string
  subject: string
  lines: string[]
  /** Absolute URL the recipient must open; logged in plain text. */
  actionUrl: string
  actionLabel: string
}

/**
 * Outbound mail for account one-time links. The only transport today writes a
 * structured record to the API log: local development has no SMTP server, and
 * a real provider must be added before anything reaches production inboxes.
 */
@Injectable()
export class ConsoleMailer {
  private readonly logger = new Logger('Mailer')

  constructor(@Inject(AUTH_CONFIG) private readonly config: AppConfig) {}

  send(message: MailMessage): void {
    if (this.config.mailDriver !== 'console') return
    this.logger.log(
      [
        `MAIL to=${message.to} subject="${message.subject}"`,
        message.lines.join(' | '),
        `${message.actionLabel}: ${message.actionUrl}`,
        '(MAIL_DRIVER=console; configure a real provider before production.)',
      ].join('\n  '),
    )
  }
}
