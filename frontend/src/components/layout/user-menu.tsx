"use client";

/**
 * Menú de usuario — avatar + desplegable con "Cerrar sesión".
 *
 * Avatar: inicial en mayúscula del email del usuario en un círculo.
 * Al hacer clic en el avatar, se despliega un menú con "Cerrar sesión".
 * Cerrar sesión usa signOut de next-auth/react con callbackUrl "/login" (RF-AUTH-004).
 *
 * El menú se cierra al hacer clic fuera (useEffect con listener en document).
 */

import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú al hacer clic fuera del contenedor
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = email.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger: avatar + email ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-accent transition-colors"
      >
        {/* Avatar: círculo con la inicial */}
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {initial}
        </span>
        {/* Email truncado */}
        <span className="flex-1 truncate text-sm text-foreground">{email}</span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Desplegable ── */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-full rounded-md border bg-popover shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
