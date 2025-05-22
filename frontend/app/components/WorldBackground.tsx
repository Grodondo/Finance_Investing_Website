import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTheme } from '../contexts/ThemeContext';

const ParticlesEffect = () => {
  const { isDarkMode } = useTheme();
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  useEffect(() => {
    if (!pointsRef.current) return;
    
    // Update particles color based on theme
    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.color.set(isDarkMode ? '#4f46e5' : '#818cf8');
  }, [isDarkMode]);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });
  
  const createGlobe = () => {
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000;
    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i += 3) {
      // Create points on a sphere
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI;
      const radius = 2 + (Math.random() * 0.2);
      
      posArray[i] = Math.sin(angle1) * Math.sin(angle2) * radius;
      posArray[i + 1] = Math.cos(angle2) * radius;
      posArray[i + 2] = Math.cos(angle1) * Math.sin(angle2) * radius;
      
      // Gradient colors with blue-purple theme
      colorsArray[i] = 0.5 + Math.random() * 0.5; // R
      colorsArray[i + 1] = 0.2 + Math.random() * 0.3; // G 
      colorsArray[i + 2] = 0.8 + Math.random() * 0.2; // B
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    
    return (
      <points ref={pointsRef}>
        <bufferGeometry attach="geometry" {...particlesGeometry.toJSON()} />
        <pointsMaterial 
          attach="material"
          size={0.025}
          transparent
          vertexColors
          opacity={0.8}
          sizeAttenuation
        />
      </points>
    );
  };

  const createConnections = () => {
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: isDarkMode ? '#4f46e5' : '#818cf8',
      transparent: true,
      opacity: 0.2
    });
    
    const points = [];
    for (let i = 0; i < 25; i++) {
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI;
      const radius = 2;
      
      const x = Math.sin(angle1) * Math.sin(angle2) * radius;
      const y = Math.cos(angle2) * radius;
      const z = Math.cos(angle1) * Math.sin(angle2) * radius;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    // Connect points
    const lineGeometries = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].distanceTo(points[j]) < 1.5) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([points[i], points[j]]);
          lineGeometries.push(lineGeometry);
        }
      }
    }
    
    return lineGeometries.map((geometry, idx) => (
      <line key={idx}>
        <bufferGeometry attach="geometry" {...geometry.toJSON()} />
        <lineBasicMaterial attach="material" color={lineMaterial.color} transparent opacity={0.2} />
      </line>
    ));
  };

  return (
    <group ref={groupRef}>
      {createGlobe()}
      {createConnections()}
    </group>
  );
};

const WorldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isDarkMode } = useTheme();
  
  return (
    <div 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full z-[-1] opacity-80"
      style={{ pointerEvents: 'none' }}
    >
      <Canvas 
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: false
        }}
      >
        <ambientLight intensity={0.5} />
        <ParticlesEffect />
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          rotateSpeed={0.1} 
          autoRotate
          autoRotateSpeed={0.2}
        />
      </Canvas>
    </div>
  );
};

export default WorldBackground; 