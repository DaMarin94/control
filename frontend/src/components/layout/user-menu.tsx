"use client";

/**
 * Menú de usuario — bloque .me del sidebar del DS "Precise Ledger".
 *
 * Avatar: inicial en mayúscula del email en un círculo con gradiente de acento.
 * Al hacer clic, desplegable con "Cerrar sesión".
 * Cerrar sesión usa signOut de next-auth/react con callbackUrl "/login".
 *
 * Re-estilado en Fase 3 con tokens del DS.
 */

import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";

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
      {/* ── Trigger: bloque .me ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-[10px] rounded-ctl p-2 text-left transition-colors duration-[140ms] hover:bg-panel-2"
      >
        {/* Avatar: gradiente de acento con la inicial */}
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white"
          style={{
            background:
              "linear-gradient(140deg, oklch(0.7 0.1 264), oklch(0.55 0.13 304))",
          }}
        >
          {initial}
        </span>
        {/* Email truncado */}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink leading-tight">
            {initial}
          </span>
          <span className="block truncate text-[12px] text-muted leading-tight">{email}</span>
        </div>
        {/* Chevron */}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-[140ms] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Desplegable ── */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-full rounded-ctl border border-line bg-panel shadow-[var(--shadow-md)] overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink"
          >
            <LogOut size={14} aria-hidden="true" className="shrink-0 opacity-70" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
