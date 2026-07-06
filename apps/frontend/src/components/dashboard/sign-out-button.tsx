import { signOutAction } from "@/app/dashboard/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Sign out
      </button>
    </form>
  );
}
