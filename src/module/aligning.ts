import { fabric } from "fabric";

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

    // 恢复这两玩意
    // ctx.lineWidth = aligningLineWidth
    // ctx.strokeStyle = aligningLineColor
    ctx.restore();
  }

  private drawVerticalLine(coords: VerticalLineCoords) {
    const {
      relativeToCanvasPosition: { ll: ll, cl: cl, rl: rl },
    } = this.getObjInfo(this.activeObj);
    if (ll !== coords.x && cl !== coords.x && rl !== coords.x) return;
    this.drawLine(coords.x, Math.min(coords.y1, coords.y2), coords.x, Math.max(coords.y1, coords.y2));
  }

  private drawHorizontalLine(coords: HorizontalLineCoords) {
    const {
      relativeToCanvasPosition: { tt: tt, ct: ct, bt: bt },
    } = this.getObjInfo(this.activeObj);
    if (tt !== coords.y && ct !== coords.y && bt !== coords.y) return;
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

  private getObjSize(obj: fabric.Object) {
    const objBoundingRect = obj.getBoundingRect();
    return {
      objHeight: objBoundingRect.height / this.viewportTransform[3],
      objWidth: objBoundingRect.width / this.viewportTransform[0],
    };
  }

  private getObjInfo(obj: fabric.Object) {
    const objCenterPoint = obj.getCenterPoint();
    const objBoundingRect = obj.getBoundingRect();
    const relativeToCanvasPosition = this.calcObjRelativePositionToCanvas(obj);

    const { ll, rl, tt, bt, ct, cl } = relativeToCanvasPosition;

    const objNeedDrawHorizontalSide: Record<string, Record<string, number>> = {
      top: { y: tt },
      center: { y: ct },
      bottom: { y: bt },
    };

    const objNeedDrawVerticalSide: Record<string, Record<string, number>> = {
      left: { x: ll },
      center: { x: cl },
      right: { x: rl },
    };

    return {
      ...this.getObjSize(obj),
      objCenterPoint,
      objBoundingRect,
      relativeToCanvasPosition,
      objNeedDrawVerticalSide,
      objNeedDrawHorizontalSide,
    };
  }

  private calcObjRelativePositionToCanvas(obj: fabric.Object) {
    const objCenterPoint = obj.getCenterPoint();
    const { objWidth, objHeight } = this.getObjSize(obj);

    const objCenterPointToCanvasLeft = objCenterPoint.x;
    const objCenterPointToCanvasTop = objCenterPoint.y;

    const objLeftToCanvasLeft = objCenterPointToCanvasLeft - objWidth / 2;
    const objRightToCanvasLeft = objLeftToCanvasLeft + objWidth;

    const objTopToCanvasTop = objCenterPointToCanvasTop - objHeight / 2;
    const objBottomToCanvasTop = objCenterPointToCanvasTop + objHeight / 2;

    return {
      cl: objCenterPointToCanvasLeft,
      ct: objCenterPointToCanvasTop,

      ll: objLeftToCanvasLeft,
      rl: objRightToCanvasLeft,

      tt: objTopToCanvasTop,
      bt: objBottomToCanvasTop,
    };
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

  private traversAllObjects(activeObject: fabric.Object, canvasObjects: fabric.Object[]) {
    const {
      objHeight: activeObjHeight,
      objWidth: activeObjectWidth,
      relativeToCanvasPosition: activeObjInfoRelativePosition,
      objNeedDrawHorizontalSide: activeObjNeedDrawHorizontalSide,
      objNeedDrawVerticalSide: activeObjNeedDrawVerticalSide,
    } = this.getObjInfo(activeObject);

    const {
      ll: activeObjLL,
      rl: activeObjRL,
      tt: activeObjTT,
      bt: activeObjBT,
      ct: activeObjCT,
      cl: activeObjCL,
    } = activeObjInfoRelativePosition;

    const snapXPoints: number[] = [];
    const snapYPoints: number[] = [];

    for (let i = canvasObjects.length; i--; ) {
      if (canvasObjects[i] === activeObject) continue;

      const { relativeToCanvasPosition, objNeedDrawHorizontalSide, objNeedDrawVerticalSide } = this.getObjInfo(
        canvasObjects[i]
      );

      const { ll: objLL, rl: objRL, tt: objTT, bt: objBT } = relativeToCanvasPosition;

      for (const activeObjSide in activeObjNeedDrawHorizontalSide) {
        for (const objSide in objNeedDrawHorizontalSide) {
          if (this.isInRange(activeObjNeedDrawHorizontalSide[activeObjSide].y, objNeedDrawHorizontalSide[objSide].y)) {
            const y = objNeedDrawHorizontalSide[objSide].y;
            let x1: number, x2: number;

            if (activeObjSide === "center") {
              x1 = Math.min(activeObjCL, objLL, objRL);
              x2 = Math.max(activeObjCL, objLL, objRL);
            } else {
              x1 = Math.min(objLL, activeObjLL);
              x2 = Math.max(objRL, activeObjRL);
            }
            this.horizontalLines.push({ y, x1, x2 });

            if (activeObjSide === "top") {
              snapYPoints.push(y + activeObjHeight / 2);
            } else if (activeObjSide === "center") {
              snapYPoints.push(y);
            } else if (activeObjSide === "bottom") {
              snapYPoints.push(y - activeObjHeight / 2);
            }
          }
        }
      }

      for (const activeObjSide in activeObjNeedDrawVerticalSide) {
        for (const objSide in objNeedDrawVerticalSide) {
          if (this.isInRange(activeObjNeedDrawVerticalSide[activeObjSide].x, objNeedDrawVerticalSide[objSide].x)) {
            const x = objNeedDrawVerticalSide[objSide].x;
            let y1: number, y2: number;
            if (activeObjSide === "center") {
              y1 = Math.min(activeObjCT, objTT);
              y2 = Math.max(activeObjCT, objBT);
            } else {
              y1 = Math.min(objTT, activeObjTT);
              y2 = Math.max(objBT, activeObjBT);
            }
            this.verticalLines.push({ x, y1, y2 });

            if (activeObjSide === "left") {
              snapXPoints.push(x + activeObjectWidth / 2);
            } else if (activeObjSide === "center") {
              snapXPoints.push(x);
            } else if (activeObjSide === "right") {
              snapXPoints.push(x - activeObjectWidth / 2);
            }
          }
        }
      }

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
          new fabric.Point(sortPoints(snapXPoints, activeObjCL), sortPoints(snapYPoints, activeObjCT)),
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
