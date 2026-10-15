import { Suspense, useState, type ReactNode } from 'react';

interface MountOnFirstOpenProps {
  open: boolean;
  children: ReactNode;
}

// Task 100: renders its children only after `open` has been true once. Used with React.lazy modals
// (the upload flow, the garment editor): their code is not downloaded until the first time they are
// shown, and after that they stay mounted so closing animations and state behave as before.
// The Suspense fallback is empty: the modal appears as soon as its code arrives.
const MountOnFirstOpen = ({ open, children }: MountOnFirstOpenProps) => {
  const [everOpened, setEverOpened] = useState(open);
  if (open && !everOpened) setEverOpened(true);
  if (!everOpened) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
};

export default MountOnFirstOpen;
