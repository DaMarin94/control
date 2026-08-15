/**
 * Tests de integración: marca visual pasiva de límites en la card income-expense
 * y en la card by-category de /reportes (P2 — Fase 1, Tramo 2).
 *
 * Recharts está mockeado en report-card.test.tsx (Area/Bar/Tooltip se vuelven
 * no-ops), así que la función de render del `dot`/`content` custom nunca se
 * ejecuta ahí. Estos tests ejercitan directamente las piezas exportadas
 * (`Form1Tooltip`, `Form2Tooltip`, `renderSeriesPointMark`) — funciones puras o
 * componentes chicos sin dependencia de Recharts en sí — para verificar la
 * lógica de marcado sin tener que resolver el layout real de Recharts en jsdom.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LimitConfig } from "@/types/limit";
import type { EvaluatedLimitMark } from "@/lib/limits/evaluate";
import type { ByCategoryMarks } from "@/lib/limits/apply-reports";
import { Form1Tooltip, Form2Tooltip, resolveCartoucheTick, resolveStackedCategoryMark } from "@/components/charts/report-card";
import { renderSeriesPointMark, renderCategoryBandLineMark, makeMonthCartoucheTick } from "@/components/limits/limit-mark";
import type { ReportsMovementsResponse } from "@/types/reports";

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: overrides.id ?? "limit-1",
    enabled: true,
    anchorKey: "reporte.ie.gastoMes",
    temporalScope: "all",
    operator: "gt",
    threshold: 100,
    nature: "passive",
    effect: "dot",
    label: "Gasto anual alto",
    ...overrides,
  };
}

function makeMark(overrides: Partial<EvaluatedLimitMark> = {}): EvaluatedLimitMark {
  return { effect: "dot", matched: [makeLimit()], ...overrides };
}

describe("Form1Tooltip — marca visual pasiva (reporte.ie.*)", () => {
  const basePayload = [
    { dataKey: "incomeCents", value: 50000 },
    { dataKey: "expenseCents", value: 20000 },
  ];

  it("sin marcas no muestra ninguna nota de límite", () => {
    render(
      <Form1Tooltip active payload={basePayload} label="Ene" year={2026} currency="ARS" direction="both" />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("con expenseMarks[0] cruzado, muestra la nota de límite (portador de a11y del punto)", () => {
    const expenseMarks = [makeMark({ matched: [makeLimit({ label: "Gasto anual alto" })] }), null];
    render(
      <Form1Tooltip
        active
        payload={basePayload}
        label="Ene"
        year={2026}
        currency="ARS"
        direction="both"
        expenseMarks={expenseMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: gasto anual alto/i)).toBeInTheDocument();
  });

  it("un mes sin marca (index 1) no muestra la nota", () => {
    const expenseMarks = [makeMark(), null];
    render(
      <Form1Tooltip
        active
        payload={basePayload}
        label="Feb"
        year={2026}
        currency="ARS"
        direction="both"
        expenseMarks={expenseMarks}
      />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });
});

describe("Form2Tooltip — marca visual pasiva (reporte.cat.*)", () => {
  const data: ReportsMovementsResponse = {
    year: 2026,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, "0")}`,
      incomeCents: 0,
      expenseCents: 10000,
    })),
    categories: [
      { categoryId: "cat-1", name: "Comida", color: "#E23B3B", monthlyExpenseCents: Array(12).fill(10000) },
    ],
    availableCategories: [{ categoryId: "cat-1", name: "Comida", color: "#E23B3B", hasExpense: true, hasIncome: false }],
    earliestYear: 2025,
  };

  // Form2Tooltip consume mergedCategories (RF-REP-017) en vez de data.categories directo.
  // Sin toggle de simulados, es la misma info que data.categories con la capa simulada
  // en null (sin aporte) — ver report-card.tsx, buildMergedCategories.
  const mergedCategories = data.categories.map((cat) => ({
    ...cat,
    simulatedMonthlyExpenseCents: Array<number | null>(12).fill(null),
  }));

  it("sin marcas no muestra ninguna nota de límite", () => {
    render(
      <Form2Tooltip
        active
        payload={[{ dataKey: "cat-1", value: 10000 }]}
        label="Ene"
        data={data}
        year={2026}
        currency="ARS"
        mergedCategories={mergedCategories}
        includeSimulated={false}
      />,
    );
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("con la categoría marcada en el mes hovereado, muestra la nota combinada", () => {
    const categoryMarks: ByCategoryMarks = {
      perCategory: new Map([["cat-1", [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesCategoria", label: "Comida cara" })] }), null]]]),
      cartouche: [null, null],
    };
    render(
      <Form2Tooltip
        active
        payload={[{ dataKey: "cat-1", value: 10000 }]}
        label="Ene"
        data={data}
        year={2026}
        currency="ARS"
        mergedCategories={mergedCategories}
        includeSimulated={false}
        categoryMarks={categoryMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: comida cara/i)).toBeInTheDocument();
  });

  it("con el cartucho del mes marcado (total), muestra la nota", () => {
    const categoryMarks: ByCategoryMarks = {
      perCategory: new Map([["cat-1", [null, null]]]),
      cartouche: [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", label: "Total mensual alto" })] }), null],
    };
    render(
      <Form2Tooltip
        active
        payload={[{ dataKey: "cat-1", value: 10000 }]}
        label="Ene"
        data={data}
        year={2026}
        currency="ARS"
        mergedCategories={mergedCategories}
        includeSimulated={false}
        categoryMarks={categoryMarks}
      />,
    );
    expect(screen.getByText(/supera el límite: total mensual alto/i)).toBeInTheDocument();
  });
});

describe("renderSeriesPointMark — marcador de punto de serie (P2 — Tramo 2)", () => {
  it("sin marca devuelve un <g/> vacío (cero impacto)", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, [null]);
    expect(el.type).toBe("g");
  });

  it("con marca 'dot' devuelve un círculo relleno ámbar", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, [makeMark({ effect: "dot" })]);
    const props = el.props as { fill?: string; stroke?: string };
    expect(el.type).toBe("circle");
    expect(props.fill).toBe("var(--warning)");
  });

  it("con marca 'ring' devuelve un círculo sin relleno con stroke ámbar", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, [makeMark({ effect: "ring" })]);
    const props = el.props as { fill?: string; stroke?: string };
    expect(el.type).toBe("circle");
    expect(props.fill).toBe("none");
    expect(props.stroke).toBe("var(--warning)");
  });

  it("sin marks (undefined) devuelve un <g/> vacío", () => {
    const el = renderSeriesPointMark({ cx: 10, cy: 20, index: 0 }, undefined);
    expect(el.type).toBe("g");
  });
});

describe("renderCategoryBandLineMark — vértice de banda de categoría en Línea (P2)", () => {
  it("sin marca devuelve un <g/> vacío (cero impacto)", () => {
    const el = renderCategoryBandLineMark({ cx: 10, cy: 20, index: 0 }, [null]);
    expect(el.type).toBe("g");
  });

  it("con marca devuelve SIEMPRE un ring ámbar, sin importar mark.effect", () => {
    // Único efecto ofrecido por el catálogo para esta key es "ring" (docs/design.md
    // §3), pero el helper lo fuerza de todas formas — defensa ante datos viejos.
    const el = renderCategoryBandLineMark({ cx: 10, cy: 20, index: 0 }, [makeMark({ effect: "glyph" })]);
    const props = el.props as { fill?: string; stroke?: string };
    expect(el.type).toBe("circle");
    expect(props.fill).toBe("none");
    expect(props.stroke).toBe("var(--warning)");
  });
});

describe("resolveStackedCategoryMark — banda de categoría del stack, SIN el total (P2)", () => {
  const catMonthMarks = [makeMark({ matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesCategoria", label: "Comida cara" })] }), null];

  it("devuelve la marca de la categoría cuando no hay aporte simulado ese mes", () => {
    expect(resolveStackedCategoryMark(catMonthMarks, 0, false)).toEqual(catMonthMarks[0]);
  });

  it("un mes sin marca de categoría devuelve null", () => {
    expect(resolveStackedCategoryMark(catMonthMarks, 1, false)).toBeNull();
  });

  it("catMonthMarks undefined (sin límites de categoría) devuelve null", () => {
    expect(resolveStackedCategoryMark(undefined, 0, false)).toBeNull();
  });

  it("caso combinado simulado + marcado: la capa REAL pierde la marca ese mes (se la lleva la simulada)", () => {
    // hasSimulatedAportThisMonth=true → la banda real ya no es el borde exterior
    // de la categoría ese mes (RF-REP-017): la celda/punto real queda SIN marca.
    expect(resolveStackedCategoryMark(catMonthMarks, 0, true)).toBeNull();
    // La capa SIMULADA (que llama con hasSimulatedAportThisMonth=false — nunca
    // se "resta" a sí misma) sí conserva la marca propia de la categoría.
    expect(resolveStackedCategoryMark(catMonthMarks, 0, false)).toEqual(catMonthMarks[0]);
  });
});

describe("resolveCartoucheTick — cero-impacto y activación del cartucho (P2)", () => {
  it("sin ninguna marca en el año, devuelve el objeto de estilo plano (mismo tick de siempre)", () => {
    const tick = resolveCartoucheTick(Array(12).fill(null), false);
    expect(tick).toEqual({ fontSize: 12, fontWeight: 500, fill: "var(--muted)", fontFamily: "var(--ui)" });
  });

  it("marks undefined (sin categoryMarks) también devuelve el objeto de estilo plano", () => {
    const tick = resolveCartoucheTick(undefined, false);
    expect(tick).toEqual({ fontSize: 12, fontWeight: 500, fill: "var(--muted)", fontFamily: "var(--ui)" });
  });

  it("con al menos una marca en el año, devuelve la factory del tick (función)", () => {
    const marks = Array<EvaluatedLimitMark | null>(12).fill(null);
    marks[5] = makeMark();
    const tick = resolveCartoucheTick(marks, false);
    expect(typeof tick).toBe("function");
  });
});

describe("makeMonthCartoucheTick — el cartucho de mes en sí (P2, docs/design.md)", () => {
  const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  it("mes SIN marca: replica el tick default (mismo texto, sin ningún nodo ámbar/aria)", () => {
    const marks: (EvaluatedLimitMark | null)[] = [null];
    const Tick = makeMonthCartoucheTick(marks, monthLabels, false);
    const { container } = render(<svg><Tick x={10} y={20} index={0} /></svg>);
    expect(screen.getByText("Ene")).toBeInTheDocument();
    expect(container.querySelector('[role="img"]')).not.toBeInTheDocument();
    expect(container.querySelector("svg > svg, foreignObject")).not.toBeInTheDocument();
  });

  it("caso testigo del defecto: el total marca el cartucho, independiente de cualquier banda del stack", () => {
    // El cartucho no lee valores de categoría en absoluto — se prueba con el
    // caso testigo (mes donde la categoría más chica del apilado tiene 0):
    // computeByCategoryMarks (apply-reports.test.ts) ya prueba que ese mes SÍ
    // llega con marca acá; este test prueba que, llegando la marca, el
    // cartucho SIEMPRE la renderiza — nunca depende de si hay bandas.
    const marks: (EvaluatedLimitMark | null)[] = [
      makeMark({ effect: "glyph", matched: [makeLimit({ anchorKey: "reporte.cat.gastoMesTotal", label: "Total mensual alto" })] }),
    ];
    const Tick = makeMonthCartoucheTick(marks, monthLabels, false);
    render(<svg><Tick x={10} y={20} index={0} /></svg>);
    const node = screen.getByRole("img");
    expect(node).toHaveAttribute("aria-label", expect.stringContaining("Total mensual alto"));
  });

  it("efecto 'glyph' (default/quiet): AlertTriangle a la izquierda del rótulo, SIN chip", () => {
    const marks: (EvaluatedLimitMark | null)[] = [makeMark({ effect: "glyph" })];
    const Tick = makeMonthCartoucheTick(marks, monthLabels, false);
    const { container } = render(<svg><Tick x={10} y={20} index={0} /></svg>);
    expect(screen.getByText("Ene")).toBeInTheDocument();
    expect(container.querySelector(".bg-warning-soft")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument(); // AlertTriangle
  });

  it("efecto 'badge': el rótulo se sirve como chip ámbar con el nombre del mes (no 'Límite')", () => {
    const marks: (EvaluatedLimitMark | null)[] = [makeMark({ effect: "badge" })];
    const Tick = makeMonthCartoucheTick(marks, monthLabels, false);
    const { container } = render(<svg><Tick x={10} y={20} index={0} /></svg>);
    const chip = container.querySelector(".bg-warning-soft");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("Ene");
    expect(screen.queryByText(/^Límite$/)).not.toBeInTheDocument();
  });

  it("efecto 'ring': mismo chip del badge + anillo (se distingue del badge por su clase de contorno)", () => {
    const marks: (EvaluatedLimitMark | null)[] = [makeMark({ effect: "ring" })];
    const Tick = makeMonthCartoucheTick(marks, monthLabels, false);
    const { container } = render(<svg><Tick x={10} y={20} index={0} /></svg>);
    const chip = container.querySelector(".bg-warning-soft");
    expect(chip).toBeInTheDocument();
    expect(chip?.className).toContain("shadow-[0_0_0_1.5px_var(--warning)]");
  });

  it("los tres efectos producen marcado distinto entre sí con el mismo umbral", () => {
    const renderEffect = (effect: EvaluatedLimitMark["effect"]) => {
      const Tick = makeMonthCartoucheTick([makeMark({ effect })], monthLabels, false);
      const { container } = render(<svg><Tick x={10} y={20} index={0} /></svg>);
      return container.querySelector(".bg-warning-soft")?.className ?? null;
    };
    const glyphChip = renderEffect("glyph"); // sin chip
    const badgeChip = renderEffect("badge");
    const ringChip = renderEffect("ring");
    expect(glyphChip).toBeNull();
    expect(badgeChip).not.toBeNull();
    expect(ringChip).not.toBeNull();
    expect(ringChip).not.toBe(badgeChip); // el ring suma la clase de sombra
  });

  it("en régimen compacto (isCompact), sirve SIEMPRE la forma quiet (sin chip) aunque el efecto sea badge/ring", () => {
    const marks: (EvaluatedLimitMark | null)[] = [makeMark({ effect: "ring" })];
    const Tick = makeMonthCartoucheTick(marks, monthLabels, true);
    const { container } = render(<svg><Tick x={10} y={20} index={0} /></svg>);
    expect(container.querySelector(".bg-warning-soft")).not.toBeInTheDocument();
    expect(screen.getByText("Ene")).toBeInTheDocument();
  });

  describe("geometría de borde — el cartucho no excede el área de trazado (fix QA visual)", () => {
    // Marca en los 12 meses: ejercita el clamp en ambos extremos a la vez sin
    // depender de qué mes en particular haya cruzado el límite.
    const allMarked: (EvaluatedLimitMark | null)[] = Array.from({ length: 12 }, () => makeMark({ effect: "badge" }));

    function foreignObjectBox(container: HTMLElement) {
      const node = container.querySelector("foreignObject");
      expect(node).toBeInTheDocument();
      const x = Number(node!.getAttribute("x"));
      const width = Number(node!.getAttribute("width"));
      return { x, left: x, right: x + width, width };
    }

    it.each([false, true])("primer mes (Ene, index 0): el borde izquierdo del cartucho no cruza a la izquierda del tick (isCompact=%s)", (isCompact) => {
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, isCompact);
      // Tick pegado al borde IZQUIERDO del área de trazado (caso real reportado en QA).
      const tickX = 8;
      const { container } = render(<svg><Tick x={tickX} y={20} index={0} /></svg>);
      const { left } = foreignObjectBox(container);
      expect(left).toBeGreaterThanOrEqual(tickX);
    });

    it.each([false, true])("último mes (Dic, index 11): el borde derecho del cartucho no cruza a la derecha del tick (isCompact=%s)", (isCompact) => {
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, isCompact);
      // Tick pegado al borde DERECHO del área de trazado (caso reportado en QA:
      // "el foreignObject de Dic va centrado en el tick y el tick está pegado
      // al borde derecho, así que la mitad del cartucho queda afuera").
      const tickX = 892;
      const { container } = render(<svg><Tick x={tickX} y={20} index={11} /></svg>);
      const { right } = foreignObjectBox(container);
      expect(right).toBeLessThanOrEqual(tickX);
    });

    it("un mes intermedio con margen de sobra (Jun, index 5) sigue centrado en el tick", () => {
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, false);
      const tickX = 450;
      const { container } = render(<svg><Tick x={tickX} y={20} index={5} /></svg>);
      const { x, width } = foreignObjectBox(container);
      expect(x).toBe(tickX - width / 2);
    });

    describe("mes intermedio CERCA del borde (defecto QA visual 660px — el clamp no era solo de los extremos)", () => {
      // Geometría real de un carril angosto (régimen compacto, ~247px de SVG,
      // área de trazado 64→243, 12 meses espaciados ~16.27px): con la caja
      // vieja (sin clamp fuera de índice 0/11), el mes PENÚLTIMO (index 10)
      // ya se salía del área de trazado — exactamente lo que reportó el QA
      // como `svg.recharts-surface` más ancho que su contenedor.
      const PLOT_LEFT = 64;
      const PLOT_RIGHT = 243;
      const SPACING = (PLOT_RIGHT - PLOT_LEFT) / 11;

      it("penúltimo mes (index 10), régimen compacto: el borde derecho del cartucho no cruza el borde derecho del área de trazado", () => {
        const Tick = makeMonthCartoucheTick(allMarked, monthLabels, true);
        const tickX = PLOT_LEFT + 10 * SPACING;
        const { container } = render(<svg><Tick x={tickX} y={20} index={10} /></svg>);
        const { right } = foreignObjectBox(container);
        // Tolerancia de punto flotante (la derivación de plotRight arrastra
        // divisiones/multiplicaciones): el borde no puede cruzar de forma
        // perceptible, no exactamente a la unidad de punto flotante.
        expect(right).toBeLessThanOrEqual(PLOT_RIGHT + 0.01);
      });

      it("penúltimo mes (index 10), régimen compacto: el contenido se ancla al borde derecho (justify-end), no queda centrado en la caja desplazada", () => {
        const Tick = makeMonthCartoucheTick(allMarked, monthLabels, true);
        const tickX = PLOT_LEFT + 10 * SPACING;
        const { container } = render(<svg><Tick x={tickX} y={20} index={10} /></svg>);
        const wrapper = container.querySelector('[role="img"]') as HTMLElement;
        expect(wrapper.style.justifyContent).toBe("flex-end");
      });

      it("segundo mes (index 1), régimen compacto: el borde izquierdo del cartucho no cruza el borde izquierdo del área de trazado", () => {
        const Tick = makeMonthCartoucheTick(allMarked, monthLabels, true);
        const tickX = PLOT_LEFT + 1 * SPACING;
        const { container } = render(<svg><Tick x={tickX} y={20} index={1} /></svg>);
        const { left } = foreignObjectBox(container);
        expect(left).toBeGreaterThanOrEqual(PLOT_LEFT);
      });

      it("mes central (index 5) en el mismo carril angosto sigue centrado — el clamp no se activa sin necesidad", () => {
        const Tick = makeMonthCartoucheTick(allMarked, monthLabels, true);
        const tickX = PLOT_LEFT + 5 * SPACING;
        const { container } = render(<svg><Tick x={tickX} y={20} index={5} /></svg>);
        const { x, width } = foreignObjectBox(container);
        expect(x).toBe(tickX - width / 2);
      });
    });
  });

  describe("contenido visible anclado al tick en los extremos (fix defecto QA — colisión con el rótulo vecino)", () => {
    // La caja (foreignObject) mide 150/100px pero el chip/cluster visible es
    // mucho más chico y va centrado adentro por flexbox — clampear la CAJA no
    // alcanza si el CONTENIDO sigue centrado en ella (queda corrido hacia el
    // rótulo vecino). Estos tests miden el `justify-content` del wrapper
    // flex, que es lo que efectivamente decide dónde cae el chip visible.
    const allMarked: (EvaluatedLimitMark | null)[] = Array.from({ length: 12 }, () => makeMark({ effect: "badge" }));

    function wrapperJustify(container: HTMLElement) {
      const wrapper = container.querySelector('[role="img"]') as HTMLElement | null;
      expect(wrapper).toBeInTheDocument();
      return wrapper!.style.justifyContent;
    }

    it("primer mes (Ene, index 0): el contenido se ancla al borde IZQUIERDO (justify-start) — no se corre hacia Feb", () => {
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, false);
      const { container } = render(<svg><Tick x={8} y={20} index={0} /></svg>);
      expect(wrapperJustify(container)).toBe("flex-start");
    });

    it("último mes (Dic, index 11): el contenido se ancla al borde DERECHO (justify-end) — no se corre hacia Nov", () => {
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, false);
      const { container } = render(<svg><Tick x={892} y={20} index={11} /></svg>);
      expect(wrapperJustify(container)).toBe("flex-end");
    });

    it("mes intermedio (Jun, index 5): el contenido sigue centrado (justify-center) — sin cambios fuera de los extremos", () => {
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, false);
      const { container } = render(<svg><Tick x={450} y={20} index={5} /></svg>);
      expect(wrapperJustify(container)).toBe("center");
    });

    it("regresión geométrica: con el clamp de borde, anclar el contenido al mismo borde de la caja evita que el centro del chip caiga sobre el tick del mes vecino", () => {
      // Reconstruye la geometría reportada en el QA (SVG real, modo Línea,
      // 1280px): último mes con caja clampeada [boxX, boxX+width] donde
      // boxX+width === tick real (index 11). Con justify-end, el borde
      // DERECHO del contenido coincide con boxX+width (el tick) y el
      // contenido se extiende hacia la izquierda desde ahí — nunca hacia el
      // centro de la caja, que es donde vivía la colisión con "Nov".
      const Tick = makeMonthCartoucheTick(allMarked, monthLabels, false);
      const tickX = 887; // tick real de "Dic" (boxX + width del caso QA)
      const { container } = render(<svg><Tick x={tickX} y={20} index={11} /></svg>);
      const node = container.querySelector("foreignObject")!;
      const boxX = Number(node.getAttribute("x"));
      const width = Number(node.getAttribute("width"));
      const boxCenter = boxX + width / 2;
      // El centro geométrico de la caja NO es donde debe caer el contenido
      // (ahí es donde colisionaba con Nov): confirma que justify-end aleja el
      // contenido del centro, hacia el borde derecho (el tick).
      expect(wrapperJustify(container)).toBe("flex-end");
      expect(boxCenter).toBeLessThan(tickX);
    });
  });
});
