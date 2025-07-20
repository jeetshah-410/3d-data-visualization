import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Grid } from '@react-three/drei';
import { Fullscreen, Minimize2 } from 'lucide-react';
import { InstancedMesh, Object3D, Color } from 'three';
import * as d3 from 'd3';

// Type definition
interface Point3D {
  x: number;
  y: number;
  z: number;
  colorValue?: string;
  sizeValue?: number;
  [key: string]: any;
}

interface Visualizer3DProps {
  data: Point3D[];
  onBack: () => void;
}

const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

const SpherePoint: React.FC<Point3D & { id: number; scales: any }> = ({ 
  id, x, y, z, colorValue, sizeValue, scales, ...meta 
}) => {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  const color = colorValue ? colorScale(colorValue) : '#00bfff';
  const size = sizeValue ? scales.sizeScale(sizeValue) : 0.1;

  // Transform coordinates using scales
  const scaledX = scales.xScale(x);
  const scaledY = scales.yScale(y);
  const scaledZ = scales.zScale(z);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered ? 1.15 : 1);
    }
  });

  return (
    <group position={[scaledX, scaledY, scaledZ]}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {hovered && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#fff',
          whiteSpace: 'pre-line',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {`ID: ${id}
      Original: (${Number(x).toFixed(2)}, ${Number(y).toFixed(2)}, ${Number(z).toFixed(2)})
      Scaled: (${scaledX.toFixed(2)}, ${scaledY.toFixed(2)}, ${scaledZ.toFixed(2)})
      ${colorValue ? `Color: ${colorValue}` : ''}
      ${sizeValue ? `Size: ${sizeValue}` : ''}`}
        </div>
      </Html>

      )}
    </group>
  );
};

const DynamicAxisLabels: React.FC<{ ranges: any; axisSize: number }> = ({ ranges, axisSize }) => (
  <>
    <Html position={[axisSize + 0.5, 0, 0]} style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '14px' }}>
      X ({ranges.x.min.toFixed(1)} - {ranges.x.max.toFixed(1)})
    </Html>
    <Html position={[0, axisSize + 0.5, 0]} style={{ color: '#51cf66', fontWeight: 'bold', fontSize: '14px' }}>
      Y ({ranges.y.min.toFixed(1)} - {ranges.y.max.toFixed(1)})
    </Html>
    <Html position={[0, 0, axisSize + 0.5]} style={{ color: '#339af0', fontWeight: 'bold', fontSize: '14px' }}>
      Z ({ranges.z.min.toFixed(1)} - {ranges.z.max.toFixed(1)})
    </Html>
  </>
);

const DataStats: React.FC<{ data: Point3D[]; ranges: any }> = ({ data, ranges }) => (
  <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-80 text-white p-4 rounded-lg text-sm font-mono">
    <div className="font-bold mb-2">Data Statistics</div>
    <div>Points: {data.length}</div>
    <div className="mt-2">
      <div>X: {ranges.x.min.toFixed(2)} → {ranges.x.max.toFixed(2)}</div>
      <div>Y: {ranges.y.min.toFixed(2)} → {ranges.y.max.toFixed(2)}</div>
      <div>Z: {ranges.z.min.toFixed(2)} → {ranges.z.max.toFixed(2)}</div>
    </div>
  </div>
);

// Helper function to create sign-preserving scale with padding
const createSignPreservingScale = (values: number[], targetRange: number) => {
  if (values.length === 0) {
    return d3.scaleLinear().domain([0, 1]).range([-targetRange, targetRange]);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  // If all values are the same
  if (min === max) {
    const center = min === 0 ? 0 : min;
    return d3.scaleLinear()
      .domain([center - 1, center + 1])
      .range([-targetRange, targetRange]);
  }

  // If range spans zero (has both positive and negative values)
  if (min < 0 && max > 0) {
    // Calculate proportional ranges for negative and positive sides
    const negativeRange = Math.abs(min);
    const positiveRange = max;
    const totalRange = negativeRange + positiveRange;
    
    // Add 10% padding to each side
    const negativeWithPadding = negativeRange * 1.1;
    const positiveWithPadding = positiveRange * 1.1;
    const totalWithPadding = negativeWithPadding + positiveWithPadding;
    
    // Proportionally allocate the target range
    const negativeTargetRange = (negativeWithPadding / totalWithPadding) * (targetRange * 2);
    const positiveTargetRange = (positiveWithPadding / totalWithPadding) * (targetRange * 2);
    
    return d3.scaleLinear()
      .domain([-negativeWithPadding, positiveWithPadding])
      .range([-negativeTargetRange, positiveTargetRange]);
  }
  // All values are positive
  else if (min >= 0) {
    const range = max - min;
    const padding = range * 0.1;
    // Ensure domain starts at 0 or positive value
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;
    
    return d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([0, targetRange]);
  }
  // All values are negative
  else {
    const range = max - min;
    const padding = range * 0.1;
    // Ensure domain ends at 0 or negative value
    const domainMin = min - padding;
    const domainMax = Math.min(0, max + padding);
    
    return d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([-targetRange, 0]);
  }
};

const Visualizer3D: React.FC<Visualizer3DProps> = ({ data, onBack }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate data ranges and create scales
  const { ranges, scales, axisSize } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        ranges: { x: { min: 0, max: 1 }, y: { min: 0, max: 1 }, z: { min: 0, max: 1 } },
        scales: {
          xScale: d3.scaleLinear().domain([0, 1]).range([-5, 5]),
          yScale: d3.scaleLinear().domain([0, 1]).range([-5, 5]),
          zScale: d3.scaleLinear().domain([0, 1]).range([-5, 5]),
          sizeScale: d3.scaleLinear().domain([0, 100]).range([0.05, 0.3])
        },
        axisSize: 5
      };
    }

    // Calculate ranges for each dimension
    const xValues = data.map(d => Number(d.x)).filter(v => !isNaN(v)) as number[];
    const yValues = data.map(d => Number(d.y)).filter(v => !isNaN(v)) as number[];
    const zValues = data.map(d => Number(d.z)).filter(v => !isNaN(v)) as number[];
    const sizeValues = data.map(d => d.sizeValue !== undefined ? Number(d.sizeValue) : undefined).filter(v => v !== undefined && !isNaN(v)) as number[];

    const xExtent = d3.extent(xValues) as [number, number];
    const yExtent = d3.extent(yValues) as [number, number];
    const zExtent = d3.extent(zValues) as [number, number];
    
    // Safely get sizeExtent with fallback
    let sizeExtentRaw = d3.extent(sizeValues);
    let sizeExtent: [number, number];
    if (!sizeExtentRaw || sizeExtentRaw[0] === undefined || sizeExtentRaw[1] === undefined) {
      sizeExtent = [0, 100];
    } else {
      sizeExtent = [sizeExtentRaw[0], sizeExtentRaw[1]];
    }

    // Determine appropriate axis size based on data spread
    const maxRange = Math.max(
      xExtent[1] - xExtent[0],
      yExtent[1] - yExtent[0],
      zExtent[1] - zExtent[0]
    );
    const dynamicAxisSize = Math.max(5, Math.min(15, maxRange / 2));

    const ranges = {
      x: { min: xExtent[0], max: xExtent[1] },
      y: { min: yExtent[0], max: yExtent[1] },
      z: { min: zExtent[0], max: zExtent[1] }
    };

    // Create sign-preserving scales
    const scales = {
      xScale: createSignPreservingScale(xValues, dynamicAxisSize),
      yScale: createSignPreservingScale(yValues, dynamicAxisSize),
      zScale: createSignPreservingScale(zValues, dynamicAxisSize),
      sizeScale: d3.scaleLinear()
        .domain(sizeExtent[0] === sizeExtent[1] ? [sizeExtent[0] - 1, sizeExtent[1] + 1] : sizeExtent)
        .range([0.05, 0.4])
    };

    return { ranges, scales, axisSize: dynamicAxisSize };
  }, [data]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // Calculate optimal camera position based on axis size
  const cameraDistance = axisSize * 1.8;

  return (
    <div ref={containerRef} className="w-full h-screen relative bg-black">
      <Canvas
        gl={{ antialias: true }}
        style={{ background: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)', position: 'absolute', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4444ff" />
        
        <PerspectiveCamera 
          makeDefault 
          position={[cameraDistance, cameraDistance, cameraDistance]} 
          fov={60}
        />
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          maxDistance={axisSize * 5}
          minDistance={axisSize * 0.5}
        />

        <Grid 
          args={[axisSize * 4, axisSize * 4]} 
          cellSize={axisSize / 5} 
          sectionSize={axisSize} 
          sectionColor="#404040" 
          cellColor="#252525" 
        />

        
        <axesHelper args={[axisSize]} />
        <DynamicAxisLabels ranges={ranges} axisSize={axisSize} />

        {data.map((point, index) => (
          <SpherePoint key={index} id={index} scales={scales} {...point} />
        ))}
      </Canvas>

      <div className="absolute top-4 left-4 z-10 space-x-2">
        <button
          onClick={onBack}
          className="bg-white bg-opacity-90 text-black px-4 py-2 rounded hover:bg-opacity-100 transition-all shadow-lg"
        >
          ⬅️ Back
        </button>
        <button
          onClick={toggleFullscreen}
          className="bg-white bg-opacity-90 text-black px-4 py-2 rounded hover:bg-opacity-100 transition-all shadow-lg flex items-center gap-2"
        >
          {fullscreen ? <Minimize2 size={16} /> : <Fullscreen size={16} />}
          {fullscreen ? 'Exit' : 'Full'}
        </button>
      </div>

      <DataStats data={data} ranges={ranges} />
    </div>
  );
};

export default Visualizer3D;