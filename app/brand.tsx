import Image from 'next/image';
/** The person and open hand represent everyday people gaining access to support. */
export function Brand({ companion }: { companion: string }) {
  return (
    <>
      <Image
        className="brand-mark"
        src="/brand/scheme-sathi-logo.png"
        unoptimized
        width={40}
        height={40}
        alt=""
        aria-hidden="true"
      />
      <span>
        <b>Scheme Sathi</b>
        <small>{companion}</small>
      </span>
    </>
  );
}
