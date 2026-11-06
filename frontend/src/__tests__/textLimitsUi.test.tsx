import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryPicker from '../components/CategoryPicker';

// Audit H7: the name fields stop at the limits the API enforces (100 characters for names).
describe('text limits in the UI', () => {
  it('the new-category name field stops at 100 characters', async () => {
    const user = userEvent.setup();
    render(
      <CategoryPicker
        collections={[]}
        selectedIds={[]}
        onToggle={vi.fn()}
        isCreating
        onStartCreating={vi.fn()}
        newName=""
        onNewNameChange={vi.fn()}
        onConfirmCreate={vi.fn()}
        onCancelCreate={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /no category/i }));

    expect(screen.getByPlaceholderText('CATEGORY NAME')).toHaveAttribute('maxLength', '100');
  });
});
