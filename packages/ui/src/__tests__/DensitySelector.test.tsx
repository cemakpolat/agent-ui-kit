import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DensitySelector } from '../components/primitives/DensitySelector';
import { useUIStore } from '@hari/core';

// Reset Zustand UI store between tests
beforeEach(() => {
  useUIStore.setState({ densityOverride: null, hypotheticalMode: false, hypotheticalQuery: null });
});

describe('DensitySelector', () => {
  it('renders buttons for all three density modes', () => {
    render(<DensitySelector agentRecommended="operator" />);
    expect(screen.getByText('Executive')).toBeDefined();
    expect(screen.getByText('Operator')).toBeDefined();
    expect(screen.getByText('Expert')).toBeDefined();
  });

  it('selecting a density updates the Zustand store', () => {
    render(<DensitySelector agentRecommended="operator" />);
    fireEvent.click(screen.getByText('Executive'));
    expect(useUIStore.getState().densityOverride).toBe('executive');
  });

  it('clicking the active density again clears the override (toggle)', () => {
    render(<DensitySelector agentRecommended="operator" />);
    const btn = screen.getByText('Expert');
    fireEvent.click(btn); // set override to expert
    expect(useUIStore.getState().densityOverride).toBe('expert');
    fireEvent.click(btn); // click same button again — should clear
    expect(useUIStore.getState().densityOverride).toBeNull();
  });

  it('shows a reset button when a density override is active', () => {
    render(<DensitySelector agentRecommended="operator" />);
    expect(screen.queryByText('reset')).toBeNull(); // not visible yet
    fireEvent.click(screen.getByText('Executive'));
    expect(screen.getByText('reset')).toBeDefined();
  });

  it('reset button clears the density override', () => {
    render(<DensitySelector agentRecommended="operator" />);
    fireEvent.click(screen.getByText('Executive'));
    expect(useUIStore.getState().densityOverride).toBe('executive');
    fireEvent.click(screen.getByText('reset'));
    expect(useUIStore.getState().densityOverride).toBeNull();
  });

  it('does not show reset button when no override is set', () => {
    render(<DensitySelector agentRecommended="operator" />);
    expect(screen.queryByText('reset')).toBeNull();
  });
});
