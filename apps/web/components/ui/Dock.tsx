'use client';

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { Children, cloneElement, useEffect, useMemo, useRef, useState, ReactElement, ReactNode } from 'react';

import './Dock.css';

interface DockItemProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  mousePos: any;
  spring: any;
  distance: number;
  magnification: number;
  baseItemSize: number;
  label?: string;
  direction?: 'horizontal' | 'vertical';
}

function DockItem({ children, className = '', onClick, mousePos, spring, distance, magnification, baseItemSize, label, direction = 'horizontal' }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mousePos, (val: number) => {
    const rect = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      y: 0,
      width: baseItemSize,
      height: baseItemSize
    };
    if (direction === 'vertical') {
      return val - rect.y - baseItemSize / 2;
    }
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size
      }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {Children.map(children, child => cloneElement(child as any, { isHovered }))}
    </motion.div>
  );
}

function DockLabel({ children, className = '', direction = 'horizontal', ...rest }: { children: ReactNode, className?: string, direction?: 'horizontal' | 'vertical', [key: string]: any }) {
  const { isHovered } = rest;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on('change', (latest: number) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  const animationProps = direction === 'vertical' 
    ? {
        initial: { opacity: 0, x: 0 },
        animate: { opacity: 1, x: 10 },
        exit: { opacity: 0, x: 0 }
      }
    : {
        initial: { opacity: 0, y: 0 },
        animate: { opacity: 1, y: -10 },
        exit: { opacity: 0, y: 0 }
      };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          {...animationProps}
          transition={{ duration: 0.2 }}
          className={`dock-label ${direction === 'vertical' ? 'dock-label-vertical' : ''} ${className}`}
          role="tooltip"
          style={direction === 'horizontal' ? { x: '-50%' } : { y: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <div className={`dock-icon ${className}`}>{children}</div>;
}

export interface DockProps {
  items: Array<{
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    className?: string;
  }>;
  className?: string;
  spring?: any;
  magnification?: number;
  distance?: number;
  panelSize?: number;
  dockSize?: number;
  baseItemSize?: number;
  direction?: 'horizontal' | 'vertical';
}

export default function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelSize = 68,
  dockSize = 256,
  baseItemSize = 50,
  direction = 'horizontal'
}: DockProps) {
  const mousePos = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxSize = useMemo(
    () => Math.max(dockSize, magnification + magnification / 2 + 4),
    [magnification, dockSize]
  );
  const sizeRow = useTransform(isHovered, [0, 1], [panelSize, maxSize]);
  const size = useSpring(sizeRow, spring);

  return (
    <motion.div 
      style={{ 
        [direction === 'vertical' ? 'width' : 'height']: size,
        scrollbarWidth: 'none' 
      }} 
      className={`dock-outer ${direction === 'vertical' ? 'dock-outer-vertical' : ''} z-50`}
    >
      <motion.div
        onMouseMove={({ clientX, clientY }) => {
          isHovered.set(1);
          mousePos.set(direction === 'vertical' ? clientY : clientX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mousePos.set(Infinity);
        }}
        className={`dock-panel ${direction === 'vertical' ? 'dock-panel-vertical' : ''} ${className}`}
        style={{ [direction === 'vertical' ? 'width' : 'height']: panelSize }}
        role="toolbar"
        aria-label="Application dock"
      >
        {items.map((item, index) => (
          <DockItem
            key={index}
            onClick={item.onClick}
            className={item.className}
            mousePos={mousePos}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
            direction={direction}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel direction={direction}>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  );
}
