import { signOutAction } from "@/app/actions/auth";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className = "" }: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={`btn-hv-secondary rounded-lg px-3 py-1.5 text-xs font-medium ${className}`}
      >
        Sign out
      </button>
    </form>
  );
}
