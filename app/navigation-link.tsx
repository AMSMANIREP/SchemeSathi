'use client';
import type { ComponentProps, KeyboardEvent, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Vinext beta.5's production next/link chunk loses its dynamically imported
 * navigation exports. Use the statically imported router, which also preserves
 * the provider and active conversation while moving between workspace tabs.
 * Keep a real href for keyboard use, new tabs and navigation before hydration.
 */
export default function NavigationLink({
  href,
  onClick,
  onKeyDown,
  children,
  ...props
}: ComponentProps<'a'> & { href: string }) {
  const router = useRouter();
  const navigate = (
    event: MouseEvent<HTMLAnchorElement> | KeyboardEvent<HTMLAnchorElement>,
  ) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target && props.target !== '_self') ||
      props.download !== undefined
    )
      return;
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    event.preventDefault();
    router.push(destination.pathname + destination.search + destination.hash);
  };
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.button > 0) return;
        navigate(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === 'Enter') navigate(event);
      }}
    >
      {children}
    </a>
  );
}
