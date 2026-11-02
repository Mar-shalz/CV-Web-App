import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass, type ButtonVariant, type Size } from "./button-styles";
import { LinkBody } from "./button-client";

export { buttonClass, type ButtonVariant } from "./button-styles";
export { Button } from "./button-client";

/** A link that looks like a button. It rolls while the page it opens loads (founder round 39). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      <LinkBody size={size}>{children}</LinkBody>
    </Link>
  );
}
