import { afterEach, describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../test/renderWithApp';
import { SocialLinksField } from '../practice/profile/SocialLinksField';
import { linkLabel } from '../practice/profile/socialPlatform';

function Harness({ start = [] as string[] }) {
  const [links, setLinks] = useState(start);
  return (
    <>
      <SocialLinksField value={links} onChange={setLinks} />
      <output data-testid="value">{JSON.stringify(links)}</output>
    </>
  );
}

afterEach(cleanup);

describe('links on the profile', () => {
  it('recognises the site as you type, and calls anything else your website', () => {
    expect(linkLabel('https://www.instagram.com/folake')).toBe('Instagram');
    expect(linkLabel('https://wa.me/234800')).toBe('WhatsApp');
    expect(linkLabel('https://folake.ng/about')).toBe('Website · folake.ng');
    expect(linkLabel('http://folake.ng')).toBeNull();
    expect(linkLabel('folake')).toBeNull();
  });

  it('adds, edits and removes links, up to 8', () => {
    renderWithApp(<Harness />);
    fireEvent.change(screen.getByLabelText('Link 1'), { target: { value: 'https://linkedin.com/in/f' } });
    expect(screen.getByText('LinkedIn')).toBeTruthy();
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: /Add a link/ }));
    expect(screen.getAllByRole('textbox')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /Add a link/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(JSON.parse(screen.getByTestId('value').textContent!)).toHaveLength(7);
  });

  it('says when a link is not a full https link', () => {
    renderWithApp(<Harness start={['instagram.com/f']} />);
    expect(screen.getByText('Use a full link starting with https://')).toBeTruthy();
  });
});
