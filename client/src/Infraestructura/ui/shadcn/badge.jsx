// Primitivo Badge de shadcn/ui, convertido a JSX
import { cva } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground"
    }
  },
  defaultVariants: { variant: "default" }
});

export const Badge = ({ className, variant, ...props }) => <div className={cn(badgeVariants({ variant }), className)} {...props} />;
