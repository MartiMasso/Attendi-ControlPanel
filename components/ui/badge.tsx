import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  color?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const colorMap: Record<NonNullable<BadgeProps["color"]>, string> = {
  neutral: "bg-surface-muted text-text-muted",
  success: "bg-[#e6f5ed] text-success",
  warning: "bg-[#fff2e1] text-warning",
  danger: "bg-[#fdebed] text-danger",
  info: "bg-[#e5f0ff] text-primary"
};

export function Badge({ children, color = "neutral", className }: BadgeProps) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", colorMap[color], className)}>{children}</span>;
}
