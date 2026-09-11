'use client';
import { useRouter } from 'next/navigation';
import { useApp } from '../providers';
import { Landing } from '../landing';
import { VoiceControls } from '../voice-controls';

/**
 * The landing is a real route, not a conditional render inside the shell.
 * Branching the page structure on localStorage would make the server render
 * one tree and the client another; the pathname is identical on both.
 */
export default function Welcome() {
  const { signIn } = useApp();
  const router = useRouter();
  return (
    <>
      <Landing
        onEnter={(name) => {
          signIn(name);
          router.push('/profile');
        }}
      />
      <VoiceControls />
    </>
  );
}
