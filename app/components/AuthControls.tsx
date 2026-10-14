import { signOut } from "@/auth";

export default function AuthControls({ login }: { login: string | null }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      aria-label={`Sign out ${login ?? "user"}`}
    >
      <button className="rounded border border-white/20 px-2 py-1 hover:bg-white/10" type="submit">
        Sign out
      </button>
    </form>
  );
}
