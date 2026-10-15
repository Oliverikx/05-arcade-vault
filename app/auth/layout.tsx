import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return children;
}
