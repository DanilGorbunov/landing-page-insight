import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Button with minimum 44px touch target (accessibility). Use for primary actions and nav.
 */
const TouchTargetButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function TouchTargetButton({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn("touch-target inline-flex items-center justify-center", className)}
      {...props}
    />
  );
  }
);

export { TouchTargetButton };
