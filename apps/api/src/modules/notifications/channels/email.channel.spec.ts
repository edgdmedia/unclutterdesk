import { describe, expect, it, vi } from 'vitest';
import { EmailChannel } from './email.channel';

function make() {
  const mail: any = { sendMail: vi.fn().mockResolvedValue({ sent: true, messageId: 'm1' }) };
  return { channel: new EmailChannel(mail), mail };
}

const html = (mail: any) => mail.sendMail.mock.calls[0][2] as string;

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
    const second = mail.sendMail.mock.calls[1][2] as string;
    expect(second).toContain('INVITE CODE');
    expect(second).not.toContain('VERIFICATION CODE');
  });
});
