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
    let count = 0;
    const { relativeToCanvasPosition } = this.getObjInfo(this.activeObj);
    if (relativeToCanvasPosition.objLeftToCanvasLeft !== coords.x) count++;
    if (relativeToCanvasPosition.objCenterPointToCanvasLeft !== coords.x) count++;
    if (relativeToCanvasPosition.objRightToCanvasLeft !== coords.x) count++;
    if (count === 3) return;

    this.drawLine(
      coords.x,
      coords.y1 > coords.y2 ? coords.y2 : coords.y1,
      coords.x,
      coords.y2 > coords.y1 ? coords.y2 : coords.y1
    );
  }

  private drawHorizontalLine(coords: HorizontalLineCoords) {
    let count = 0;
    const { relativeToCanvasPosition } = this.getObjInfo(this.activeObj);
    if (relativeToCanvasPosition.objTopToCanvasTop !== coords.y) count++;
    if (relativeToCanvasPosition.objCenterPointToCanvasTop !== coords.y) count++;
    if (relativeToCanvasPosition.objBottomToCanvasTop !== coords.y) count++;
    if (count === 3) return;

    this.drawLine(
      coords.x1 > coords.x2 ? coords.x2 : coords.x1,
      coords.y,
      coords.x2 > coords.x1 ? coords.x2 : coords.x1,
      coords.y
    );
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

    const {
      objLeftToCanvasLeft,
      objRightToCanvasLeft,
      objTopToCanvasTop,
      objBottomToCanvasTop,
      objCenterPointToCanvasTop,
      objCenterPointToCanvasLeft,
    } = relativeToCanvasPosition;

    const objNeedDrawHorizontalSide: Record<string, Record<string, number>> = {
      top: {
        y: objTopToCanvasTop,
      },
      center: {
        y: objCenterPointToCanvasTop,
      },
      bottom: {
        y: objBottomToCanvasTop,
      },
    };

    const objNeedDrawVerticalSide: Record<string, Record<string, number>> = {
      left: {
        x: objLeftToCanvasLeft,
      },
      center: {
        x: objCenterPointToCanvasLeft,
      },
      right: {
        x: objRightToCanvasLeft,
      },
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
      objCenterPointToCanvasLeft,
      objCenterPointToCanvasTop,

      objLeftToCanvasLeft,
      objRightToCanvasLeft,

      objTopToCanvasTop,
      objBottomToCanvasTop,
    };
  }

  private moveActiveObjToNewPositionByCenterPoint(x: number, y: number, activeObject: fabric.Object) {
    activeObject.setPositionByOrigin(new fabric.Point(x, y), "center", "center");
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
      objCenterPoint: activeObjCenterPoint,
      objNeedDrawHorizontalSide: activeObjNeedDrawHorizontalSide,
      objNeedDrawVerticalSide: activeObjNeedDrawVerticalSide,
    } = this.getObjInfo(activeObject);

    const {
      objLeftToCanvasLeft: activeObjLeftToCanvasLeft,
      objTopToCanvasTop: activeObjTopToCanvasTop,
      objBottomToCanvasTop: activeObjBottomToCanvasTop,
      objCenterPointToCanvasTop: activeObjCenterPointToCanvasTop,
      objCenterPointToCanvasLeft: activeObjCenterPointToCanvasLeft,
    } = activeObjInfoRelativePosition;

    let activeObjNewCenterPointToCanvasTop: number | undefined;

    for (let i = canvasObjects.length; i--; ) {
      if (canvasObjects[i] === activeObject) continue;

      const { objWidth, relativeToCanvasPosition, objNeedDrawHorizontalSide, objNeedDrawVerticalSide } =
        this.getObjInfo(canvasObjects[i]);

      const { objLeftToCanvasLeft, objTopToCanvasTop, objBottomToCanvasTop } = relativeToCanvasPosition;

      for (const activeObjSide in activeObjNeedDrawHorizontalSide) {
        for (const objSide in objNeedDrawHorizontalSide) {
          if (this.isInRange(activeObjNeedDrawHorizontalSide[activeObjSide].y, objNeedDrawHorizontalSide[objSide].y)) {
            let x1: number,
              x2: number,
              y = objNeedDrawHorizontalSide[objSide].y;

            if (activeObjSide === "center") {
              if (activeObjLeftToCanvasLeft > objLeftToCanvasLeft) {
                x1 = objLeftToCanvasLeft;
                x2 = activeObjLeftToCanvasLeft + activeObjectWidth / 2;
              } else {
                x1 = activeObjLeftToCanvasLeft + activeObjectWidth / 2;
                x2 = objLeftToCanvasLeft + objWidth;
              }
            } else {
              if (activeObjLeftToCanvasLeft > objLeftToCanvasLeft) {
                x1 = objLeftToCanvasLeft;
                x2 = activeObjLeftToCanvasLeft + activeObjectWidth;
              } else {
                x1 = activeObjLeftToCanvasLeft;
                x2 = objLeftToCanvasLeft + objWidth;
              }
            }

            this.horizontalLines.push({
              y,
              x1,
              x2,
            });

            if (activeObjSide === "top") {
              activeObjNewCenterPointToCanvasTop = y + activeObjHeight / 2;
              this.moveActiveObjToNewPositionByCenterPoint(
                activeObjCenterPointToCanvasLeft,
                activeObjNewCenterPointToCanvasTop,
                activeObject
              );
            }

            if (activeObjSide === "center") {
              activeObjNewCenterPointToCanvasTop = y;

              this.moveActiveObjToNewPositionByCenterPoint(
                activeObjCenterPointToCanvasLeft,
                activeObjNewCenterPointToCanvasTop,
                activeObject
              );
            }

            if (activeObjSide === "bottom") {
              activeObjNewCenterPointToCanvasTop = y - activeObjHeight / 2;
              this.moveActiveObjToNewPositionByCenterPoint(
                activeObjCenterPoint.x,
                activeObjNewCenterPointToCanvasTop,
                activeObject
              );
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
              y1 =
                activeObjCenterPointToCanvasTop > objTopToCanvasTop
                  ? objTopToCanvasTop
                  : activeObjCenterPointToCanvasTop;
              y2 =
                activeObjCenterPointToCanvasTop > objBottomToCanvasTop
                  ? activeObjCenterPointToCanvasTop
                  : objBottomToCanvasTop;
            } else {
              y1 = activeObjTopToCanvasTop > objTopToCanvasTop ? objTopToCanvasTop : activeObjTopToCanvasTop;
              y2 =
                activeObjBottomToCanvasTop > objBottomToCanvasTop ? activeObjBottomToCanvasTop : objBottomToCanvasTop;
            }

            this.verticalLines.push({
              x,
              y1,
              y2,
            });

            // 确保水平吸附和垂直吸附同时发生时，水平吸附生效
            let newCenterPointToCanvasTop: number =
              typeof activeObjNewCenterPointToCanvasTop === "number"
                ? activeObjNewCenterPointToCanvasTop
                : activeObjCenterPoint.y;

            if (activeObjSide === "left") {
              this.moveActiveObjToNewPositionByCenterPoint(
                x + activeObjectWidth / 2,
                newCenterPointToCanvasTop,
                activeObject
              );
            }

            if (activeObjSide === "center") {
              this.moveActiveObjToNewPositionByCenterPoint(x, newCenterPointToCanvasTop, activeObject);
            }

            if (activeObjSide === "right") {
              this.moveActiveObjToNewPositionByCenterPoint(
                x - activeObjectWidth / 2,
                newCenterPointToCanvasTop,
                activeObject
              );
            }
          }
        }
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
