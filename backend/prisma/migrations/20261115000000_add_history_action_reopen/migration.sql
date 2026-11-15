-- Reapertura de un fijo terminado (RF-MF-008): nueva operación "reabierto" del historial.
-- Escrita a mano (equivale al diff automático): simple ADD VALUE sobre el enum.
ALTER TYPE "HistoryAction" ADD VALUE 'REOPEN';
