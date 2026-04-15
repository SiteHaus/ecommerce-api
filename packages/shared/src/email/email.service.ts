import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;
  private readonly devRedirect: string | null;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow("RESEND_API_KEY"));
    this.defaultFrom = config.getOrThrow("EMAIL_FROM");
    this.devRedirect = config.get<string>("EMAIL_DEV_REDIRECT") ?? null;
  }

  async send(options: SendEmailOptions): Promise<void> {
    const intended = Array.isArray(options.to) ? options.to : [options.to];
    const recipient = this.devRedirect ? [this.devRedirect] : intended;

    if (this.devRedirect) {
      this.log.warn(`DEV redirect: ${intended.join(", ")} → ${this.devRedirect}`);
    }

    const { error } = await this.resend.emails.send({
      from: options.from ?? this.defaultFrom,
      to: recipient,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      throw new Error(`Email send failed: ${error.message}`);
    }
  }
}
