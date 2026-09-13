import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link as LinkIcon, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
}

export default function RadialOrbitalTimeline({
  timelineData,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const centerViewOnNode = (nodeId: number) => {
    if (!nodeRefs.current[nodeId]) return;
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) newState[parseInt(key)] = false;
      });
      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: ReturnType<typeof setInterval> | undefined;
    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
      }, 50);
    }
    return () => {
      if (rotationTimer) clearInterval(rotationTimer);
    };
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)),
    );
    return { x, y, zIndex, opacity };
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "text-primary-foreground bg-foreground border-background";
      case "in-progress":
        return "text-background bg-primary border-primary";
      case "pending":
        return "text-foreground bg-background/40 border-foreground/50";
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-[34rem] w-full items-center justify-center overflow-hidden"
      onClick={handleContainerClick}
    >
      <div
        ref={orbitRef}
        className="absolute flex h-[28rem] w-[28rem] items-center justify-center rounded-full border border-foreground/10"
      >
        <div className="absolute h-[26rem] w-[26rem] rounded-full border border-dashed border-foreground/10" />
        <div className="absolute h-[14rem] w-[14rem] rounded-full border border-foreground/5" />
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary via-primary/70 to-accent opacity-90 blur-[1px]" />
        <div className="absolute h-16 w-16 animate-ping rounded-full bg-primary/20" />

        {timelineData.map((item, index) => {
          const position = calculateNodePosition(index, timelineData.length);
          const isExpanded = expandedItems[item.id];
          const isRelated = isRelatedToActive(item.id);
          const isPulsing = pulseEffect[item.id];
          const Icon = item.icon;

          const nodeStyle: React.CSSProperties = {
            transform: `translate(${position.x}px, ${position.y}px)`,
            zIndex: isExpanded ? 200 : position.zIndex,
            opacity: isExpanded ? 1 : position.opacity,
          };

          return (
            <div
              key={item.id}
              ref={(el) => {
                nodeRefs.current[item.id] = el;
              }}
              className="absolute cursor-pointer transition-all duration-700"
              style={nodeStyle}
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
            >
              {isPulsing && (
                <div className="absolute -inset-2 animate-ping rounded-full bg-primary/30" />
              )}
              <div
                className={`relative grid size-12 place-items-center rounded-full border-2 transition-all duration-300 ${
                  isExpanded
                    ? "scale-125 border-primary bg-primary text-primary-foreground shadow-[0_0_20px] shadow-primary/50"
                    : isRelated
                      ? "border-primary/70 bg-primary/20 text-primary"
                      : "border-foreground/30 bg-background/80 text-foreground backdrop-blur-lg"
                }`}
              >
                <Icon className="size-5" />
              </div>

              {!isExpanded && (
                <p className="absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.title}
                </p>
              )}

              {isExpanded && (
                <Card className="absolute left-1/2 top-full z-50 mt-4 w-72 -translate-x-1/2 border-border bg-popover/95 shadow-orbital backdrop-blur-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase ${getStatusStyles(item.status)}`}
                      >
                        {item.status === "completed"
                          ? "Complete"
                          : item.status === "in-progress"
                            ? "In progress"
                            : "Pending"}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.date}
                      </span>
                    </div>
                    <CardTitle className="font-display text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.content}
                    </p>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Zap className="size-3" /> Energy level
                        </span>
                        <span className="font-mono">{item.energy}%</span>
                      </div>
                      <Progress value={item.energy} className="h-1" />
                    </div>

                    {item.relatedIds.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                          <LinkIcon className="size-3" /> Connected nodes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.relatedIds.map((relatedId) => {
                            const relatedItem = timelineData.find((i) => i.id === relatedId);
                            return (
                              <Button
                                key={relatedId}
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleItem(relatedId);
                                }}
                              >
                                {relatedItem?.title}
                                <ArrowRight className="size-3" />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
