import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler,
  type ChartConfiguration,
  type Plugin,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Filler);

export interface TelemetryPoint {
  distance: number;
  speed: number;
}

export interface DriverTrace {
  name: string;
  color: string;
  points: TelemetryPoint[];
}

export interface SectorMarker {
  label: string;
  distance: number;
}

export interface SpeedChartData {
  drivers: DriverTrace[];
  sectors: SectorMarker[];
  maxDistance?: number;
  maxSpeed?: number;
}

const crosshairPlugin: Plugin = {
  id: "crosshair",
  afterDraw(chart) {
    const tooltip = chart.tooltip;
    if (!tooltip || !tooltip.getActiveElements().length) return;

    const ctx = chart.ctx;
    const activePoint = tooltip.getActiveElements()[0];
    const x = activePoint.element.x;
    const topY = chart.scales["y"].top;
    const bottomY = chart.scales["y"].bottom;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff4444";
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(crosshairPlugin);

class SpeedChartComponent extends HTMLElement {
  private chart: Chart | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private chartData: SpeedChartData | null = null;

  static get observedAttributes(): string[] {
    return ["data"];
  }

  connectedCallback(): void {
    this.setupDOM();
  }

  disconnectedCallback(): void {
    this.chart?.destroy();
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ): void {
    if (name === "data" && newValue) {
      try {
        this.chartData = JSON.parse(newValue) as SpeedChartData;
      } catch {
        console.error("speed-chart: Invalid JSON data attribute");
        return;
      }
      if (this.canvas) {
        this.renderChart();
      }
    }
  }

  private setupDOM(): void {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "background:#1a1d2e;border-radius:8px;padding:16px;position:relative;width:100%;";

    this.canvas = document.createElement("canvas");
    wrapper.appendChild(this.canvas);
    this.appendChild(wrapper);

    if (this.chartData) {
      this.renderChart();
    }
  }

  private renderChart(): void {
    if (!this.canvas || !this.chartData) return;

    this.chart?.destroy();

    const { drivers, sectors, maxSpeed } = this.chartData;
    const allDistances = drivers.flatMap((d) => d.points.map((p) => p.distance));
    const allSpeeds = drivers.flatMap((d) => d.points.map((p) => p.speed));
    const computedMaxDistance =
      this.chartData.maxDistance || Math.max(...allDistances);
    const computedMaxSpeed = maxSpeed || Math.ceil(Math.max(...allSpeeds) / 5) * 5;

    const sectorAnnotations = sectors.map((s) => ({
      distance: s.distance,
      label: s.label,
    }));

    const datasets = drivers.map((driver) => ({
      label: driver.name,
      data: driver.points.map((p) => ({ x: p.distance, y: p.speed })),
      borderColor: driver.color,
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: "transparent",
      pointHoverBorderColor: driver.color,
      pointHoverBorderWidth: 2,
      tension: 0.3,
    }));

    const sectorLinePlugin: Plugin = {
      id: "sectorLines",
      afterDraw(chart) {
        const ctx = chart.ctx;
        const xScale = chart.scales["x"];
        const yScale = chart.scales["y"];

        sectorAnnotations.forEach((sector) => {
          const x = xScale.getPixelForValue(sector.distance);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          const labelSize = window.innerWidth < 600 ? 10 : 12;
          ctx.fillStyle = "#00e5ff";
          ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(sector.label, x, yScale.bottom + 20);
          ctx.restore();
        });
      },
    };

    const isMobile = window.innerWidth < 600;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            type: "linear",
            min: 0,
            max: computedMaxDistance,
            title: {
              display: false,
            },
            grid: {
              color: "rgba(255,255,255,0.06)",
            },
            ticks: {
              display: false,
            },
            border: {
              color: "rgba(255,255,255,0.1)",
            },
          },
          y: {
            type: "linear",
            min: 0,
            max: computedMaxSpeed,
            title: {
              display: !isMobile,
              text: "Speed km/h",
              color: "#ccc",
              font: { size: isMobile ? 10 : 14, family: "system-ui, sans-serif" },
            },
            grid: {
              color: "rgba(255,255,255,0.06)",
            },
            ticks: {
              color: "#aaa",
              font: { size: isMobile ? 9 : 11 },
              maxTicksLimit: isMobile ? 4 : 8,
            },
            border: {
              color: "rgba(255,255,255,0.1)",
            },
          },
        },
        plugins: {
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.85)",
            titleColor: "#fff",
            bodyFont: { size: isMobile ? 11 : 13 },
            titleFont: { size: isMobile ? 11 : 13 },
            padding: isMobile ? 8 : 12,
            cornerRadius: 6,
            displayColors: false,
            callbacks: {
              title(items) {
                if (!items.length) return "";
                const dist = items[0].parsed.x;
                return `Distance: ${dist}m`;
              },
              label(item) {
                const y = item.parsed.y ?? 0;
                return `${item.dataset.label}: ${y.toFixed(2)}`;
              },
              labelTextColor(item) {
                return item.dataset.borderColor as string;
              },
            },
          },
          legend: {
            display: false,
          },
        },
        layout: {
          padding: { bottom: isMobile ? 16 : 24, left: isMobile ? 0 : 8 },
        },
      },
      plugins: [sectorLinePlugin],
    };

    const wrapper = this.canvas.parentElement!;
    const height = this.getAttribute("height") || "400";
    wrapper.style.height = height + "px";
    wrapper.style.maxWidth = "100%";

    this.chart = new Chart(this.canvas, config);
  }
}

customElements.define("speed-chart", SpeedChartComponent);
