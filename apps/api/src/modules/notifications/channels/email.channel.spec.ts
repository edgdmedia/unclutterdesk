import { describe, expect, it, vi } from 'vitest';
import { EmailChannel } from './email.channel';
import { SenderIdentityService } from '../mail/sender-identity.service';

function make() {
  const mail: any = { deliver: vi.fn().mockResolvedValue({ sent: true, messageId: 'm1' }) };
  const identity: any = {
    senderFor: vi.fn(async (i: any) => ({ name: i.practiceName || 'Unclutter Desk', address: 'notifications@notify.unclutterdesk.com', replyTo: i.replyTo || undefined })),
  };
  return { channel: new EmailChannel(mail, identity), mail, identity };
}

const html = (mail: any, call = 0) => mail.deliver.mock.calls[call][0].html as string;

describe('EmailChannel', () => {
  it('shows free text as text, never as markup', async () => {
    const { channel, mail } = make();
    await channel.send(
      { profileId: null, tenantId: null, email: 'a@x.com' },
      {
        type: 't',
        title: 'Hi <b>there</b>',
        message: 'Join us <script>alert(1)</script> & "welcome"',
        brand: { practiceName: 'Calm <Rooms>' } as any,
      },
    );
    const out = html(mail);
    expect(out).not.toContain('<script>');
    expect(out).toContain('Join us &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;welcome&quot;');
    expect(out).toContain('Hi &lt;b&gt;there&lt;/b&gt;');
    expect(out).toContain('Calm &lt;Rooms&gt;');
  });

  // A session recap: formatted, built from the cleaned document, every word escaped.
  it('lays out a formatted body after the message, in the HTML and the plain text', async () => {
    const { channel, mail } = make();
    await channel.send(
      { profileId: null, tenantId: null, email: 'a@x.com' },
      {
        type: 'bookings.session_recap',
        title: 'Your recap',
        message: 'Here is your recap.',
        richBody: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Next <steps>' }] },
            { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Day 1' }] }] }] },
          ],
        },
      },
    );
    const out = html(mail);
    expect(out).toContain('Next &lt;steps&gt;</h2>');
    expect(out).not.toContain('<steps>');
    expect(out.indexOf('Here is your recap.')).toBeLessThan(out.indexOf('Next &lt;steps&gt;'));
    expect(mail.deliver.mock.calls[0][0].text).toBe('Here is your recap.\n\nNext <steps>\n[ ] Day 1');
  });

  it('keeps a link inside its attribute', async () => {
    const { channel, mail } = make();
    await channel.send(
      { profileId: null, tenantId: null, email: 'a@x.com' },
      { type: 't', title: 'T', message: 'M', link: 'https://app.x/y?a=1&b="2"', actionLabel: 'Open' },
    );
    expect(html(mail)).toContain('href="https://app.x/y?a=1&amp;b=&quot;2&quot;"');
  });

  it('labels the code box as a verification code unless told otherwise', async () => {
    const { channel, mail } = make();
    await channel.send({ profileId: null, tenantId: null, email: 'a@x.com' }, { type: 't', title: 'T', message: 'M', code: '123456' });
    expect(html(mail)).toContain('VERIFICATION CODE');

    await channel.send(
      { profileId: null, tenantId: null, email: 'a@x.com' },
      { type: 't', title: 'T', message: 'M', code: 'DESK-AB12-CD34', codeLabel: 'Invite code' },
    );
    const second = html(mail, 1);
    expect(second).toContain('INVITE CODE');
    expect(second).not.toContain('VERIFICATION CODE');
  });

  it('packages the email with the sender from the one sender function (practice name, practice reply-to)', async () => {
    const { channel, mail, identity } = make();
    await channel.send(
      { profileId: 4n, tenantId: 7n, email: 'c@x.ng' },
      { type: 't', title: 'Your session is booked', message: 'See you soon', brand: { practiceName: 'Smith Therapy', publicEmail: 'hello@smith.ng' } as any },
    );
    expect(identity.senderFor).toHaveBeenCalledWith({ tenantId: 7n, practiceName: 'Smith Therapy', replyTo: 'hello@smith.ng' });
    expect(mail.deliver.mock.calls[0][0]).toMatchObject({
      to: 'c@x.ng',
      subject: 'Your session is booked',
      text: 'See you soon',
      from: { name: 'Smith Therapy', address: 'notifications@notify.unclutterdesk.com' },
      replyTo: 'hello@smith.ng',
    });
  });

  it('sends platform mail (no practice) as Unclutter Desk', async () => {
    const { channel, mail } = make();
    await channel.send({ profileId: null, tenantId: null, email: 'a@x.com' }, { type: 't', title: 'Reset your password', message: 'M' });
    expect(mail.deliver.mock.calls[0][0].from).toEqual({ name: 'Unclutter Desk', address: 'notifications@notify.unclutterdesk.com' });
  });

  it('turns an in-app path into a full address, so the email link opens', async () => {
    process.env.APP_URL = 'https://app.unclutterdesk.com';
    const { channel, mail } = make();
    await channel.send({ profileId: 4n, tenantId: 7n, email: 's@x.ng' }, { type: 't', title: 'New booking', message: 'M', link: '/dashboard/sessions/8', actionLabel: 'Open session' });
    expect(html(mail)).toContain('href="https://app.unclutterdesk.com/dashboard/sessions/8"');
    expect(html(mail)).not.toContain('href="/dashboard');
    delete process.env.APP_URL;
  });

  it('lays out details as labelled rows and extra links as a list, in the HTML and the plain text', async () => {
    const { channel, mail } = make();
    await channel.send(
      { profileId: 4n, tenantId: 7n, email: 'c@x.ng' },
      {
        type: 't',
        title: 'Your session is booked',
        message: 'Smith Therapy has confirmed your session.',
        details: [{ label: 'With', value: 'Jane <Smith>' }, { label: 'When', value: 'Tuesday 6 October, 11:30' }],
        links: [{ label: 'Client intake (5 min)', url: 'https://smith.unclutterdesk.com/forms/3?booking=8' }],
      },
    );
    const out = html(mail);
    expect(out).toContain('With</td>');
    expect(out).toContain('Jane &lt;Smith&gt;');
    expect(out).toContain('href="https://smith.unclutterdesk.com/forms/3?booking=8"');
    const text = mail.deliver.mock.calls[0][0].text as string;
    expect(text).toContain('With: Jane <Smith>');
    expect(text).toContain('Client intake (5 min): https://smith.unclutterdesk.com/forms/3?booking=8');
  });

  // A password reset is about the person's own Desk account, not a message from
  // their practice: it comes from the platform, even for someone in a practice.
  describe('account emails (auth.*)', () => {
    function withRealIdentity() {
      vi.stubEnv('MAIL_FROM', 'Therapysts Desk <no-reply@notify.therapysts.com>');
      vi.stubEnv('MAIL_FROM_NAME', '');
      const mail: any = { deliver: vi.fn().mockResolvedValue({ sent: true }), canSignForDomains: () => true };
      // The practice has its own verified sending domain; account mail must not use it.
      const prisma: any = {
        tenantSendingDomain: { findUnique: vi.fn().mockResolvedValue({ domain: 'calm.ng', status: 'VERIFIED', fromLocalPart: 'hello' }) },
      };
      return { channel: new EmailChannel(mail, new SenderIdentityService(mail, prisma)), mail };
    }
    const practice = { practiceName: 'Calm Rooms', publicEmail: 'hello@calm.ng', publicPhone: '+2340000', logoUrl: 'https://api.x/v1/tenant/7/logo' };

    it.each(['auth.password_reset', 'auth.email_verification', 'auth.welcome', 'auth.unverified_release_warning'])(
      '%s comes from the platform, with none of the practice in it',
      async (type) => {
        const { channel, mail } = withRealIdentity();
        await channel.send({ profileId: 4n, tenantId: 7n, email: 'me@x.ng' }, { type, title: 'Reset your password', message: 'M', brand: practice as any });
        const sent = mail.deliver.mock.calls[0][0];
        expect(sent.from).toEqual({ name: 'Therapysts Desk', address: 'no-reply@notify.therapysts.com' });
        expect(sent.replyTo).toBeUndefined();
        expect(sent.html).toContain('Therapysts Desk');
        for (const bit of ['Calm Rooms', 'hello@calm.ng', '+2340000', 'tenant/7/logo']) expect(sent.html).not.toContain(bit);
        vi.unstubAllEnvs();
      },
    );

    it('practice mail still comes from the practice', async () => {
      const { channel, mail } = withRealIdentity();
      await channel.send({ profileId: 4n, tenantId: 7n, email: 'c@x.ng' }, { type: 'bookings.confirmed', title: 'Booked', message: 'M', brand: practice as any });
      const sent = mail.deliver.mock.calls[0][0];
      expect(sent.from).toEqual({ name: 'Calm Rooms', address: 'hello@calm.ng' });
      expect(sent.replyTo).toBe('hello@calm.ng');
      expect(sent.html).toContain('Calm Rooms');
      vi.unstubAllEnvs();
    });
  });
});
