import { useEffect, useRef, useState } from "react";
import defaultByosenImage from '../byosen/sheet.png';
export type ByosenPoint = { x: number; y: number }; // x,y normalizados 0..1
const VB_W = 100; // ancho lógico; alto se calcula por la relación de la imagen
export default function ByosenSheet({
  points,
  onPointsChange,
  isReadOnly = false,
 src = defaultByosenImage,
}: {
  points: ByosenPoint[];
  onPointsChange?: (pts: ByosenPoint[]) => void;
  isReadOnly?: boolean;
  src?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [vbH, setVbH] = useState<number>(150); // alto lógico (se ajusta al cargar la imagen)

  
  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth;
      setVbH(Math.max(10, ratio * VB_W));
    };
  }, [src]);

  // Convierte el clic a coords del viewBox y normaliza a [0..1]
  const toNormalized = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      // método preciso (independiente de tamaño y zoom)
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { nx: pt.x / VB_W, ny: pt.y / vbH };
    } else {
      // fallback por si getScreenCTM() no está disponible
      const r = svg.getBoundingClientRect();
      const nx = (clientX - r.left) / r.width;
      const ny = (clientY - r.top) / r.height;
      return { nx, ny };
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isReadOnly || !onPointsChange) return;
    const { nx, ny } = toNormalized(e.clientX, e.clientY);

    // si hay un punto cerca, lo quita (toggle)
    const THRESH = 0.035; // ~3.5%
    const idx = points.findIndex((p) => Math.hypot(p.x - nx, p.y - ny) < THRESH);

    if (idx !== -1) {
      const copy = points.slice();
      copy.splice(idx, 1);
      onPointsChange(copy);
    } else {
      onPointsChange([...points, { x: nx, y: ny }]);
    }
  };

  return (
    <div className="my-2">
      <div className="flex justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          className={`w-64 bg-white rounded ${isReadOnly ? "" : "cursor-crosshair"}`}
          style={{ touchAction: "none" }} // ayuda en móviles
        >
          <image href={src} x="0" y="0" width={VB_W} height={vbH} />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x * VB_W}
              cy={p.y * vbH}
              r={2.6}
              fill="red"
              stroke="white"
              strokeWidth={0.7}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
