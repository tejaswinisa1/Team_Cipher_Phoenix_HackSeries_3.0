'use client';

import { useEffect, useRef } from 'react';

export function BlockchainNodeNetwork({ confirming = false }: { confirming?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 500;
    canvas.height = 200;

    const nodes: Array<{
      x: number;
      y: number;
      size: number;
      pulse: number;
      confirmed: boolean;
    }> = [];

    // Create blockchain nodes
    for (let i = 0; i < 8; i++) {
      nodes.push({
        x: (canvas.width / 7) * i + 30,
        y: canvas.height / 2 + (Math.random() - 0.5) * 60,
        size: 8,
        pulse: 0,
        confirmed: false,
      });
    }

    let time = 0;
    let animationFrame: number;

    // Capture as local constants so TypeScript knows they are non-null
    // inside the animate closure (type narrowing doesn't cross function boundaries)
    const ctx = context;
    const cvs = canvas;

    function animate() {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      time += 0.02;

      // Draw connections
      for (let i = 0; i < nodes.length - 1; i++) {
        const current = nodes[i];
        const next = nodes[i + 1];

        // Animated data flow
        if (confirming && current.confirmed) {
          const flowPos = (time * 2) % 1;
          const flowX = current.x + (next.x - current.x) * flowPos;
          const flowY = current.y + (next.y - current.y) * flowPos;

          ctx.beginPath();
          ctx.arc(flowX, flowY, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
          ctx.fill();
        }

        // Connection line
        ctx.beginPath();
        ctx.moveTo(current.x, current.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = confirming
          ? `rgba(16, 185, 129, ${0.3 + current.pulse * 0.4})`
          : 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw nodes
      nodes.forEach((node, index) => {
        // Update confirmation
        if (confirming && index < Math.floor(time) + 1) {
          node.confirmed = true;
          node.pulse = Math.min(1, node.pulse + 0.05);
        } else if (!confirming) {
          node.confirmed = false;
          node.pulse *= 0.95;
        }

        // Pulse ring
        if (node.pulse > 0) {
          const ringSize = node.size + node.pulse * 20;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringSize, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(16, 185, 129, ${node.pulse * 0.5})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Node glow
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.size * 3
        );
        gradient.addColorStop(
          0,
          node.confirmed
            ? `rgba(16, 185, 129, ${0.6 + node.pulse * 0.4})`
            : 'rgba(59, 130, 246, 0.4)'
        );
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fillStyle = node.confirmed
          ? `rgba(16, 185, 129, ${0.8 + node.pulse * 0.2})`
          : 'rgba(59, 130, 246, 0.6)';
        ctx.fill();

        // Checkmark for confirmed
        if (node.confirmed && node.pulse > 0.5) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', node.x, node.y);
        }
      });

      animationFrame = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(animationFrame);
  }, [confirming]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  );
}
