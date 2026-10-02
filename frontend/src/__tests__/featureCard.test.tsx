import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shirt } from 'lucide-react';

import FeatureCard from '../components/FeatureCard';

// Landing page feature tiles: hover/tap reveals a clip of the feature, and a
// tile whose clip is missing quietly has no preview (the persona / main-outfit
// clips are dropped in later with no code change).
describe('FeatureCard', () => {
  const overlay = () => screen.getByAltText(/in action/i).parentElement!;

  it('reveals the clip on hover and hides it again on leave', async () => {
    const user = userEvent.setup();
    render(<FeatureCard icon={Shirt} title="OUTFIT BUILDER" desc="d" media="/marketing/x.gif" />);

    expect(overlay()).toHaveClass('opacity-0');
    await user.hover(screen.getByTestId('feature-card'));
    expect(overlay()).toHaveClass('opacity-100');
    await user.unhover(screen.getByTestId('feature-card'));
    expect(overlay()).toHaveClass('opacity-0');
  });

  it('a tap (hover then click) leaves the clip open instead of toggling it shut', async () => {
    const user = userEvent.setup();
    render(<FeatureCard icon={Shirt} title="OUTFIT BUILDER" desc="d" media="/marketing/x.gif" />);

    await user.click(screen.getByTestId('feature-card'));
    expect(overlay()).toHaveClass('opacity-100');
  });

  it('has no preview and no hint when there is no clip', () => {
    render(<FeatureCard icon={Shirt} title="MAIN OUTFIT" desc="d" />);

    expect(screen.queryByAltText(/in action/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hover to preview/i)).not.toBeInTheDocument();
  });

  it('drops the preview and hint when the clip fails to load', () => {
    render(<FeatureCard icon={Shirt} title="PERSONA TECH" desc="d" media="/marketing/missing.gif" />);

    expect(screen.getByText(/hover to preview/i)).toBeInTheDocument();
    fireEvent.error(screen.getByAltText(/in action/i));
    expect(screen.queryByAltText(/in action/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hover to preview/i)).not.toBeInTheDocument();
  });
});
