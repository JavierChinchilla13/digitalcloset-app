import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lock } from 'lucide-react';

import PasswordInput from '../components/PasswordInput';

// User feedback, 2026-09-28: every password field in the app (login, signup,
// reset, Settings, admin create-user) should let the user see what they typed.
describe('PasswordInput', () => {
  it('is hidden by default and reveals the value on toggle', async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="hunter2" onChange={() => {}} />);

    const input = screen.getByDisplayValue('hunter2');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));

    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('toggling back hides it again', async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="hunter2" onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /show password/i }));
    await user.click(screen.getByRole('button', { name: /hide password/i }));

    expect(screen.getByDisplayValue('hunter2')).toHaveAttribute('type', 'password');
  });

  it('renders the optional left icon', () => {
    render(<PasswordInput icon={Lock} value="" onChange={() => {}} />);

    expect(document.querySelector('svg.lucide-lock')).toBeInTheDocument();
  });

  it('two instances toggle independently', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PasswordInput value="first" onChange={() => {}} placeholder="first-field" />
        <PasswordInput value="second" onChange={() => {}} placeholder="second-field" />
      </>
    );

    await user.click(screen.getAllByRole('button', { name: /show password/i })[0]);

    expect(screen.getByPlaceholderText('first-field')).toHaveAttribute('type', 'text');
    expect(screen.getByPlaceholderText('second-field')).toHaveAttribute('type', 'password');
  });

  it('the toggle does not submit the form it sits in', () => {
    render(
      <form>
        <PasswordInput value="x" onChange={() => {}} />
      </form>
    );

    expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute('type', 'button');
  });
});
