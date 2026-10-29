import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { dailySeries, monthlyEvolution } from "../../shared/analytics";
import { formatDay } from "../goalPresentation";

type DayPoint = ReturnType<typeof dailySeries>[number];
type MonthPoint = ReturnType<typeof monthlyEvolution>[number];
const percent = (value: number | null) =>
  value === null ? "Sem nota" : `${value}%`;

export function ProgressChart({
  data,
  compact = false,
  monthly = false,
}: {
  data: (DayPoint | MonthPoint)[];
  compact?: boolean;
  monthly?: boolean;
}) {
  const points = data.map((item) => ({
    ...item,
    name: formatDay(
      item.date,
      monthly
        ? { month: "short", year: "2-digit" }
        : { day: "numeric", month: "short" },
    ),
    detail:
      "label" in item
        ? item.label
        : item.partial
          ? "Mês parcial"
          : "Mês encerrado",
  }));
  const hasData = points.some((point) => point.percent !== null);
  return (
    <>
      <div
        className={`progress-chart ${compact ? "compact" : ""}`}
        aria-hidden="true"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 500, height: compact ? 160 : 240 }}
        >
          <LineChart
            data={points}
            margin={{ top: 12, right: 15, bottom: 0, left: -12 }}
            accessibilityLayer={false}
          >
            <CartesianGrid
              stroke="#35425A"
              strokeDasharray="4 5"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="#9BA9C1"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              stroke="#9BA9C1"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as
                  (typeof points)[number] | undefined;
                return active && point ? (
                  <div className="analytics-tooltip">
                    <strong>
                      {point.name} · {percent(point.percent)}
                    </strong>
                    <span>
                      {point.done} de {point.total} atingidas
                    </span>
                    <span>{point.detail}</span>
                  </div>
                ) : null;
              }}
            />
            <Line
              type="linear"
              dataKey="percent"
              stroke="var(--personal-light, #A99AFF)"
              strokeWidth={3}
              connectNulls={false}
              dot={
                points.filter((point) => point.percent !== null).length <= 31
                  ? {
                      r: compact ? 3 : 4,
                      fill: "var(--personal-light, #A99AFF)",
                      strokeWidth: 0,
                    }
                  : false
              }
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {!hasData && (
          <span className="chart-no-data">Seus registros aparecerão aqui</span>
        )}
      </div>
      {!compact && (
        <details className="chart-data">
          <summary>Consultar valores do gráfico</summary>
          <div className="table-scroll">
            <table>
              <caption>
                {monthly
                  ? "Cumprimento mensal das metas diárias"
                  : "Cumprimento diário"}
              </caption>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Atingidas / total</th>
                  <th>Cumprimento</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">
                      {formatDay(
                        point.date,
                        monthly
                          ? { month: "long", year: "numeric" }
                          : { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </th>
                    <td>
                      {point.done} / {point.total}
                    </td>
                    <td>{percent(point.percent)}</td>
                    <td>{point.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {compact && (
        <p className="sr-only">
          {points
            .map(
              (point) =>
                `${point.name}: ${percent(point.percent)}, ${point.detail}`,
            )
            .join(". ")}
        </p>
      )}
    </>
  );
}
