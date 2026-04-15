'use client';

import { useEffect, useRef } from 'react';

export function NeuralNetworkViz({ active = false }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 400;
    canvas.height = 300;

    const nodes: Array<{
      x: number;
      y: number;
      layer: number;
      activation: number;
      targetActivation: number;
    }> = [];

    // Create neural network layers
    const layers = [4, 6, 6, 3];
    const layerSpacing = canvas.width / (layers.length + 1);

    layers.forEach((nodeCount, layerIndex) => {
      const x = layerSpacing * (layerIndex + 1);
      const nodeSpacing = canvas.height / (nodeCount + 1);

      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x,
          y: nodeSpacing * (i + 1),
          layer: layerIndex,
          activation: 0,
          targetActivation: Math.random(),
        });
      }
    });

    let animationFrame: number;

    // Capture as local constants so TypeScript knows they are non-null
    // inside the animate closure (type narrowing doesn't cross function boundaries)
    const ctx = context;
    const cvs = canvas;

    function animate() {
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Draw connections
      nodes.forEach((node, i) => {
        nodes.forEach((other, j) => {
          if (i >= j) return;
          if (Math.abs(node.layer - other.layer) !== 1) return;

          const opacity = active ? 0.2 + (node.activation * 0.3) : 0.1;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
          ctx.lineWidth = active ? 1.5 : 1;
          ctx.stroke();
        });
      });

      // Draw nodes
      nodes.forEach((node) => {
        // Animate activation
        if (active) {
          node.activation += (node.targetActivation - node.activation) * 0.1;
          if (Math.abs(node.activation - node.targetActivation) < 0.01) {
            node.targetActivation = Math.random();
          }
        } else {
          node.activation *= 0.95;
        }

        // Node glow
        const glowSize = 8 + node.activation * 8;
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          glowSize
        );
        gradient.addColorStop(0, `rgba(139, 92, 246, ${0.6 + node.activation * 0.4})`);
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = active
          ? `rgba(139, 92, 246, ${0.8 + node.activation * 0.2})`
          : 'rgba(139, 92, 246, 0.4)';
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(animationFrame);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ opacity: active ? 1 : 0.5 }}
    />
  );
}
