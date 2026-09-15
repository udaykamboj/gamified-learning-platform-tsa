import { useSession } from "next-auth/react";

export function useUserRole() {
  const { data: session, status } = useSession();
  
  if (status === "loading" || !session?.user) {
    return { role: "loading", isLoading: true };
  }

  // Assuming role 1 and 2 have dashboard.action_access = true, role 4 is student
  // Or check the user role directly if available in the session object
  const user = session.user as any;
  const isAdmin = user.dashboard?.action_access === true || user.role === 1 || user.role === 2;
  
  return {
    role: isAdmin ? "admin" : "student",
    isLoading: false
  };
}
