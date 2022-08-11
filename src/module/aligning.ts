import { fabric } from "fabric";
import { Keys } from "./util";

type VerticalLineCoords = {
  x: number;
  y1: number;
  y2: number;
};

type HorizontalLineCoords = {
  y: number;
  x1: number;
  x2: number;
};

type IgnoreObjTypes = { key: string; value: any }[];

type NewCoords = NonNullable<fabric.Object["aCoords"]> & {
  c: fabric.Point;
};

export class AlignGuidelines {
  aligningLineMargin = 4;
  aligningLineWidth = 1;
  aligningLineColor = "#F68066";
  ignoreObjTypes: IgnoreObjTypes = [];
  pickObjTypes: IgnoreObjTypes = [];

  canvas: fabric.Canvas;
  ctx: CanvasRenderingContext2D;
  viewportTransform: any;
  verticalLines: VerticalLineCoords[] = [];
  horizontalLines: HorizontalLineCoords[] = [];
  activeObj: fabric.Object = new fabric.Object();

  constructor({
    canvas,
    aligningOptions,
    ignoreObjTypes,
    pickObjTypes,
  }: {
    canvas: fabric.Canvas;
    ignoreObjTypes?: IgnoreObjTypes;
    pickObjTypes?: IgnoreObjTypes;
    aligningOptions?: {
      lineMargin?: number;
      lineWidth?: number;
      lineColor?: string;
    };
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getSelectionContext();
    this.ignoreObjTypes = ignoreObjTypes || [];
    this.pickObjTypes = pickObjTypes || [];

    if (aligningOptions) {
      this.aligningLineMargin = aligningOptions.lineMargin || this.aligningLineMargin;
      this.aligningLineWidth = aligningOptions.lineWidth || this.aligningLineWidth;
      this.aligningLineColor = aligningOptions.lineColor || this.aligningLineColor;
    }
  }

  private drawSign(x: number, y: number) {
    const ctx = this.ctx;

    ctx.lineWidth = 1;
    ctx.strokeStyle = this.aligningLineColor;
    ctx.beginPath();

    const size = 2;
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number) {
    const ctx = this.ctx;
    const point1 = fabric.util.transformPoint(new fabric.Point(x1, y1), this.canvas.viewportTransform as any);
    const point2 = fabric.util.transformPoint(new fabric.Point(x2, y2), this.canvas.viewportTransform as any);

    // use origin canvas api to draw guideline
    ctx.save();
    ctx.lineWidth = this.aligningLineWidth;
    ctx.strokeStyle = this.aligningLineColor;
    ctx.beginPath();

    ctx.moveTo(point1.x, point1.y);
    ctx.lineTo(point2.x, point2.y);

    ctx.stroke();

    this.drawSign(point1.x, point1.y);
    this.drawSign(point2.x, point2.y);

    // 恢复这两玩意
    // ctx.lineWidth = aligningLineWidth
    // ctx.strokeStyle = aligningLineColor
    ctx.restore();
  }

  private drawVerticalLine(coords: VerticalLineCoords) {
    const movingCoords = this.getObjMovingCoords(this.activeObj);
    if (!Keys(movingCoords).some((key) => Math.abs(movingCoords[key].x - coords.x) < 1)) return;
    this.drawLine(coords.x, Math.min(coords.y1, coords.y2), coords.x, Math.max(coords.y1, coords.y2));
  }

  private drawHorizontalLine(coords: HorizontalLineCoords) {
    const movingCoords = this.getObjMovingCoords(this.activeObj);
    if (!Keys(movingCoords).some((key) => Math.abs(movingCoords[key].y - coords.y) < 1)) return;
    this.drawLine(Math.min(coords.x1, coords.x2), coords.y, Math.max(coords.x1, coords.x2), coords.y);
  }

  private isInRange(value1: number, value2: number) {
    return Math.abs(Math.round(value1) - Math.round(value2)) <= this.aligningLineMargin;
  }

  private watchMouseDown() {
    this.canvas.on("mouse:down", () => {
      this.clearLinesMeta();
      this.viewportTransform = this.canvas.viewportTransform as number[];
    });
  }

  private watchMouseUp() {
    this.canvas.on("mouse:up", () => {
      this.clearLinesMeta();
      this.canvas.renderAll();
    });
  }

  private watchMouseWheel() {
    this.canvas.on("mouse:wheel", () => {
      this.clearLinesMeta();
    });
  }

  private clearLinesMeta() {
    this.verticalLines.length = this.horizontalLines.length = 0;
  }

  private watchObjectMoving() {
    this.canvas.on("object:moving", (e) => {
      this.clearLinesMeta();
      const activeObject = e.target as fabric.Object;
      this.activeObj = activeObject;
      const canvasObjects = this.canvas.getObjects().filter((obj) => {
        if (this.ignoreObjTypes.length) {
          return !this.ignoreObjTypes.some((item) => (obj as any)[item.key] === item.value);
        }
        if (this.pickObjTypes.length) {
          return this.pickObjTypes.some((item) => (obj as any)[item.key] === item.value);
        }
        return true;
      });
      // @ts-ignore
      const transform = this.canvas._currentTransform;
      if (!transform) return;
      this.traversAllObjects(activeObject, canvasObjects);
    });
  }

  private getObjMovingCoords(activeObject: fabric.Object) {
    const aCoords = activeObject.aCoords as NonNullable<fabric.Object["aCoords"]>;
    const centerPoint = new fabric.Point((aCoords.tl.x + aCoords.br.x) / 2, (aCoords.tl.y + aCoords.br.y) / 2);

    const offsetX = centerPoint.x - activeObject.getCenterPoint().x;
    const offsetY = centerPoint.y - activeObject.getCenterPoint().y;

    return Keys(aCoords).reduce(
      (acc, key) => {
        return {
          ...acc,
          [key]: {
            x: aCoords[key].x - offsetX,
            y: aCoords[key].y - offsetY,
          },
        };
      },
      {
        c: activeObject.getCenterPoint(),
      } as NewCoords
    );
  }

  private traversAllObjects(activeObject: fabric.Object, canvasObjects: fabric.Object[]) {
    const movingCoords = this.getObjMovingCoords(activeObject);

    const snapXPoints: number[] = [];
    const snapYPoints: number[] = [];

    for (let i = canvasObjects.length; i--; ) {
      if (canvasObjects[i] === activeObject) continue;

      const objCoords = {
        ...canvasObjects[i].aCoords,
        c: canvasObjects[i].getCenterPoint(),
      } as NewCoords;

      Keys(movingCoords).forEach((activeObjPoint) => {
        let newCoords = objCoords;
        if (canvasObjects[i].angle !== 0) {
          // 当对象被旋转时，需要忽略一些坐标，只取最上、下边的坐标（参考 figma）
          let t: [keyof NewCoords, fabric.Point] = ["tl", objCoords.tl];
          let b: [keyof NewCoords, fabric.Point] = ["tl", objCoords.tl];
          Keys(objCoords).forEach((key) => {
            if (objCoords[key].y < t[1].y) {
              t = [key, objCoords[key]];
            }
            if (objCoords[key].y > b[1].y) {
              b = [key, objCoords[key]];
            }
          });
          newCoords = {
            [t[0]]: t[1],
            [b[0]]: b[1],
            c: objCoords.c,
          } as any;
        }
        Keys(newCoords).forEach((objPoint) => {
          if (this.isInRange(movingCoords[activeObjPoint].y, objCoords[objPoint].y)) {
            const y = objCoords[objPoint].y;
            let x1: number, x2: number;
            x1 = Math.min(objCoords[objPoint].x, movingCoords[activeObjPoint].x);
            x2 = Math.max(objCoords[objPoint].x, movingCoords[activeObjPoint].x);
            this.horizontalLines.push({ y, x1, x2 });
            const offset = movingCoords[activeObjPoint].y - y;
            snapYPoints.push(movingCoords.c.y - offset);
          }
        });
      });

      Keys(movingCoords).forEach((activeObjPoint) => {
        let newCoords = objCoords;
        if (canvasObjects[i].angle !== 0) {
          // 当对象被旋转时，需要忽略一些坐标，只取最上、下边的坐标
          let l: [keyof NewCoords, fabric.Point] = ["tl", objCoords.tl];
          let r: [keyof NewCoords, fabric.Point] = ["tl", objCoords.tl];

          Keys(objCoords).forEach((key) => {
            if (objCoords[key].x < l[1].x) {
              l = [key, objCoords[key]];
            }
            if (objCoords[key].x > r[1].x) {
              r = [key, objCoords[key]];
            }
          });

          newCoords = {
            [l[0]]: l[1],
            [r[0]]: r[1],
            c: objCoords.c,
          } as any;
        }

        Keys(newCoords).forEach((objPoint) => {
          if (this.isInRange(movingCoords[activeObjPoint].x, objCoords[objPoint].x)) {
            const x = objCoords[objPoint].x;
            let y1: number, y2: number;

            y1 = Math.min(objCoords[objPoint].y, movingCoords[activeObjPoint].y);
            y2 = Math.max(objCoords[objPoint].y, movingCoords[activeObjPoint].y);

            this.verticalLines.push({ x, y1, y2 });

            const offset = movingCoords[activeObjPoint].x - x;

            snapXPoints.push(movingCoords.c.x - offset);
          }
        });
      });

      if (snapXPoints.length || snapYPoints.length) {
        const sortPoints = (list: number[], originPoint: number) => {
          if (!list.length) return originPoint;
          return list
            .map((val) => ({
              abs: Math.abs(originPoint - val),
              val,
            }))
            .sort((a, b) => a.abs - b.abs)[0].val;
        };
        activeObject.setPositionByOrigin(
          // auto snap nearest object, record all the snap points, and then find the nearest one
          new fabric.Point(sortPoints(snapXPoints, movingCoords.c.x), sortPoints(snapYPoints, movingCoords.c.y)),
          "center",
          "center"
        );
      }
    }
  }

  clearGuideline() {
    this.canvas.clearContext(this.ctx);
  }

  watchRender() {
    this.canvas.on("before:render", () => {
      this.clearGuideline();
    });

    this.canvas.on("after:render", () => {
      for (let i = this.verticalLines.length; i--; ) {
        this.drawVerticalLine(this.verticalLines[i]);
      }
      for (let i = this.horizontalLines.length; i--; ) {
        this.drawHorizontalLine(this.horizontalLines[i]);
      }
      this.canvas.calcOffset();
    });
  }

  init() {
    this.watchObjectMoving();
    this.watchRender();
    this.watchMouseDown();
    this.watchMouseUp();
    this.watchMouseWheel();
  }
}
