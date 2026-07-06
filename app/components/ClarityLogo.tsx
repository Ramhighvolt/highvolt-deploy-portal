type ClarityLogoProps = {
  className?: string;
};

export default function ClarityLogo({ className }: ClarityLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 2.5L21.5 19.5H2.5L12 2.5Z" fill="#5EB0FF" />
      <path d="M12 2.5L21.5 19.5H12V2.5Z" fill="#0078D4" />
      <path d="M12 2.5L2.5 19.5H12V2.5Z" fill="#004578" />
    </svg>
  );
}
