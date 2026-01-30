import React, { createContext, useContext, useState, useCallback } from 'react';
import OnboardingModal, { getOnboardingDone, setOnboardingDone } from '../components/Onboarding/OnboardingModal';

const OnboardingContext = createContext({
  open: () => {},
  close: () => {},
  openIfNewUser: () => {},
});

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

export function OnboardingProvider({ children }) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const openIfNewUser = useCallback(() => {
    if (!getOnboardingDone()) setOpen(true);
  }, []);

  return (
    <OnboardingContext.Provider value={{ open: openModal, close: closeModal, openIfNewUser }}>
      {children}
      <OnboardingModal
        open={open}
        onClose={closeModal}
        markDone={true}
      />
    </OnboardingContext.Provider>
  );
}

export { getOnboardingDone, setOnboardingDone };
