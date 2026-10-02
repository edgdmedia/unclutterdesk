import { describe, expect, it, vi } from 'vitest';
import { EmailChannel } from './email.channel';

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
});

