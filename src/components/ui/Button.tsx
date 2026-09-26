import { LoaderCircle } from "lucide-react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";
type Size = "lg" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white active:bg-primary-strong",
  secondary: "bg-fill text-fg active:bg-line",
  ghost: "text-fg-muted active:bg-fill",
};

const SIZE: Record<Size, string> = {
  lg: "h-14 rounded-2xl px-5 text-body-lg",
  md: "h-12 rounded-xl px-4 text-label",
};

type StyleProps = { variant?: Variant; size?: Size; block?: boolean };

function buttonClassName({
  variant = "primary",
  size = "lg",
  block = false,
}: StyleProps) {
  return `inline-flex items-center justify-center gap-1.5 font-semibold transition duration-150 select-none touch-manipulation active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none motion-reduce:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${block ? "w-full" : ""}`;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps & { loading?: boolean };

export function Button({
  variant,
  size,
  block,
  loading = false,
  disabled,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClassName({ variant, size, block })} ${className}`}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={20} className="animate-spin" aria-hidden />
      ) : (
        children
      )}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & StyleProps;

// 다른 화면으로 가는 버튼. 모양은 Button과 같고 실제로는 링크다
export function ButtonLink({
  variant,
  size,
  block,
  className = "",
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={`${buttonClassName({ variant, size, block })} ${className}`}
      {...rest}
    />
  );
}
