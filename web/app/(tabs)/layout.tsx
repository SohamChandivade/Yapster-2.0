import { BottomNav } from "@/components/ui/BottomNav";

/** Tab screens share the floating bottom nav. Talk and onboarding live outside. */
export default function TabsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
