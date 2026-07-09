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
  private readonly senderDomain: string;
  private readonly devRedirect: string | null;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.getOrThrow("RESEND_API_KEY"));
    this.defaultFrom = config.getOrThrow("EMAIL_FROM");
    // Derive the verified sending domain from EMAIL_FROM (e.g.
    // "commerce@notify.sitehaus.dev" → "notify.sitehaus.dev") so per-email
    // From addresses can't drift onto an unverified domain. Handles both a
    // bare address and a "Name <local@domain>" form.
    this.senderDomain = this.defaultFrom.split("@").pop()!.replace(/>\s*$/, "").trim();
    this.devRedirect = config.get<string>("EMAIL_DEV_REDIRECT") ?? null;
  }

  /**
   * Build a From header for order/transactional mail on the verified domain,
   * e.g. orderFrom("Acme Co") → "Acme Co <orders@notify.sitehaus.dev>".
   */
  orderFrom(displayName: string): string {
    return `${displayName} <orders@${this.senderDomain}>`;
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
