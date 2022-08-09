import { fabric } from "fabric";
/**
 * 问题点：
 * 1、自动吸附只有相同的 margin 才会触发，例如顶部只会和顶部自动吸附，左边只会和左边自动吸附
 * 2、自动吸附只会计算 value1(被拖拽的元素) < value2 的情况（已解决）
 */
// ==========================================
// SETUP
// ==========================================

const fabricCanvas = new fabric.Canvas("myCanvas", {
  backgroundColor: "#F5F5F5",
});
const clearGuideline = () =>
  fabricCanvas.clearContext(fabricCanvas.getSelectionContext());

const global: any = {};
global.centerLine_horizontal = "";
global.centerLine_vertical = "";
global.alignmentLines_horizontal = "";
global.alignmentLines_vertical = "";

const ALIGNING_LINE_OFFSET = 5;
const ALIGNING_LINE_MARGIN = 4;
const ALIGNING_LINE_WIDTH = 1;
const ALIGNING_LINE_COLOR = "#F68066";

setupObjects();
updateInfo();

function setupObjects() {
  global.outer = new fabric.Rect({
    width: fabricCanvas.getWidth(),
    height: fabricCanvas.getHeight(),
    top: 20,
    left: 20,
    stroke: "#ffffff",
    evented: false,
    selectable: false,
  });

  global.box1 = new fabric.Rect({
    width: 240,
    height: 100,
    top: 20,
    left: 20,
    fill: "#fff28a",
    myType: "box",
  });

  global.box2 = new fabric.Rect({
    width: 240,
    height: 100,
    top: 140,
    left: 20,
    fill: "#ff8a8a",
    myType: "box",
  });

  global.box3 = new fabric.Rect({
    width: 100,
    height: 160,
    top: 20,
    left: 280,
    fill: "#cf8aff",
    myType: "box",
  });

  fabricCanvas.add(global.outer);
  global.outer.center();

  fabricCanvas.add(global.box1);
  fabricCanvas.add(global.box2);
  fabricCanvas.add(global.box3);
  let allBoxes = new fabric.ActiveSelection(
    fabricCanvas.getObjects().filter((obj) => obj.myType == "box"),
    { canvas: fabricCanvas }
  );
  allBoxes.center();
  allBoxes.destroy();
}

// 用来更新面板上的信息
// 输入发测试
function updateInfo() {
  let info_zoom = document.getElementById("info_zoom");
  let info_vptTop = document.getElementById("info_vptTop");
  let info_vptLeft = document.getElementById("info_vptLeft");
  let info_centerLine_horizontal = document.getElementById(
    "info_centerLine_horizontal"
  );
  let info_centerLine_vertical = document.getElementById(
    "info_centerLine_vertical"
  );
  let info_alignmentLines_horizontal = document.getElementById(
    "info_alignmentLines_horizontal"
  );
  let info_alignmentLines_vertical = document.getElementById(
    "info_alignmentLines_vertical"
  );

  info_zoom.innerHTML = fabricCanvas.getZoom().toFixed(2);
  info_vptTop.innerHTML = Math.round(fabricCanvas.viewportTransform[5]);
  info_vptLeft.innerHTML = Math.round(fabricCanvas.viewportTransform[4]);
  info_centerLine_horizontal.innerHTML = global.centerLine_horizontal;
  info_centerLine_vertical.innerHTML = global.centerLine_vertical;
  info_alignmentLines_horizontal.innerHTML = global.alignmentLines_horizontal;
  info_alignmentLines_vertical.innerHTML = global.alignmentLines_vertical;
}

// ------------------------------------
// Reset
// ------------------------------------
let resetButton = document.getElementById("reset") as any;

resetButton.addEventListener(
  "click",
  function () {
    reset();
  },
  false
);

function reset() {
  fabricCanvas.remove(...fabricCanvas.getObjects());
  setupObjects();
  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  updateInfo();
}

// ------------------------------------

// ==========================================
// MOUSE INTERACTIONS
// ==========================================

// MOUSEWHEEL ZOOM
fabricCanvas.on("mouse:wheel", (opt) => {
  let delta = 0;

  // -------------------------------
  // WHEEL RESOLUTION
  let wheelDelta = opt.e.wheelDelta;
  let deltaY = opt.e.deltaY;

  // CHROME WIN/MAC | SAFARI 7 MAC | OPERA WIN/MAC | EDGE
  if (wheelDelta) {
    delta = -wheelDelta / 120;
  }
  // FIREFOX WIN / MAC | IE
  if (deltaY) {
    deltaY > 0 ? (delta = 1) : (delta = -1);
  }
  // -------------------------------

  let pointer = fabricCanvas.getPointer(opt.e);
  let zoom = fabricCanvas.getZoom();
  zoom = zoom - delta / 10;

  // limit zoom in
  if (zoom > 4) zoom = 4;

  // limit zoom out
  if (zoom < 0.2) {
    zoom = 0.2;
  }

  //canvas.zoomToPoint({
  //  x: opt.e.offsetX,
  //  y: opt.e.offsetY
  //}, zoom)

  fabricCanvas.zoomToPoint(
    new fabric.Point(fabricCanvas.width / 2, fabricCanvas.height / 2),
    zoom
  );

  opt.e.preventDefault();
  opt.e.stopPropagation();

  fabricCanvas.renderAll();
  fabricCanvas.calcOffset();

  updateInfo(fabricCanvas);
});

initCenteringGuidelines(fabricCanvas);
// initAligningGuidelines(canvas);

// ==========================================
// CANVAS CENTER SNAPPING & ALIGNMENT GUIDELINES
// ==========================================

// ORIGINAL:
// https://github.com/fabricjs/fabric.js/blob/master/lib/centering_guidelines.js

/**
 * Augments canvas by assigning to `onObjectMove` and `onAfterRender`.
 * This kind of sucks because other code using those methods will stop functioning.
 * Need to fix it by replacing callbacks with pub/sub kind of subscription model.
 * (or maybe use existing fabric.util.fire/observe (if it won't be too slow))
 */
function initCenteringGuidelines(canvas: fabric.Canvas) {
  let canvasWidth = canvas.getWidth(),
    canvasHeight = canvas.getHeight(),
    canvasWidthCenter = canvasWidth / 2,
    canvasHeightCenter = canvasHeight / 2,
    canvasWidthCenterMap: any = {},
    canvasHeightCenterMap: any = {},
    centerLineMargin = 4,
    centerLineColor = "purple",
    centerLineWidth = 2,
    ctx = canvas.getSelectionContext(),
    viewportTransform: number[] = [1, 0, 0, 1, 0, 0];

  for (
    let i = canvasWidthCenter - centerLineMargin,
      len = canvasWidthCenter + centerLineMargin;
    i <= len;
    i++
  ) {
    canvasWidthCenterMap[Math.round(i)] = true;
  }
  for (
    let i = canvasHeightCenter - centerLineMargin,
      len = canvasHeightCenter + centerLineMargin;
    i <= len;
    i++
  ) {
    canvasHeightCenterMap[Math.round(i)] = true;
  }

  function showVerticalCenterLine() {
    showCenterLine(
      // canvasWidthCenter + 0.5,
      canvasWidthCenter,
      0,
      canvasWidthCenter,
      canvasHeight
    );
  }

  function showHorizontalCenterLine() {
    showCenterLine(0, canvasHeightCenter, canvasWidth, canvasHeightCenter);
  }

  function showCenterLine(x1: number, y1: number, x2: number, y2: number) {
    const originXY = fabric.util.transformPoint(
        new fabric.Point(x1, y1),
        canvas.viewportTransform as number[]
      ),
      dimensions = fabric.util.transformPoint(
        new fabric.Point(x2, y2),
        canvas.viewportTransform as number[]
      );
    ctx.save();
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = centerLineWidth;
    ctx.beginPath();

    ctx.moveTo(originXY.x, originXY.y);

    ctx.lineTo(dimensions.x, dimensions.y);
    ctx.stroke();
    ctx.restore();
  }

  let afterRenderActions = [],
    isInVerticalCenter,
    isInHorizontalCenter;

  canvas.on("mouse:down", () => {
    isInVerticalCenter = isInHorizontalCenter = null;
    global.centerLine_horizontal = "";
    global.centerLine_vertical = "";
    updateInfo();
    viewportTransform = canvas.viewportTransform;
  });

  canvas.on("object:moving", function (e) {
    let object = e.target,
      objectCenter = object.getCenterPoint(),
      transform = canvas._currentTransform;

    if (!transform) return;

    (isInVerticalCenter = Math.round(objectCenter.x) in canvasWidthCenterMap),
      (isInHorizontalCenter =
        Math.round(objectCenter.y) in canvasHeightCenterMap);

    if (isInHorizontalCenter || isInVerticalCenter) {
      object.setPositionByOrigin(
        new fabric.Point(
          isInVerticalCenter ? canvasWidthCenter : objectCenter.x,
          isInHorizontalCenter ? canvasHeightCenter : objectCenter.y
        ),
        "center",
        "center"
      );
    }
  });

  canvas.on("before:render", function () {
    canvas.clearContext(canvas.contextTop);
  });

  canvas.on("after:render", () => {
    if (isInVerticalCenter) {
      showVerticalCenterLine();
      global.centerLine_horizontal = "";
      global.centerLine_vertical =
        canvasWidthCenter +
        0.5 +
        ", " +
        0 +
        ", " +
        (canvasWidthCenter + 0.5) +
        ", " +
        canvasHeight;
    }

    if (isInHorizontalCenter) {
      showHorizontalCenterLine();
      global.centerLine_horizontal =
        canvasWidthCenter +
        0.5 +
        ", " +
        0 +
        ", " +
        (canvasWidthCenter + 0.5) +
        ", " +
        canvasHeight;
      global.centerLine_vertical = "";
    }

    updateInfo();
  });

  canvas.on("mouse:up", function () {
    // clear these values, to stop drawing guidelines once mouse is up
    canvas.renderAll();
  });
}

// ===============================================
// OBJECT SNAPPING & ALIGNMENT GUIDELINES
// ===============================================

// ORIGINAL:
// https://github.com/fabricjs/fabric.js/blob/master/lib/aligning_guidelines.js

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

class AlignGuidelines {
  canvas: fabric.Canvas;
  ctx: CanvasRenderingContext2D;
  viewportTransform: any;
  // zoom: number = 1;
  verticalLines: VerticalLineCoords[] = [];
  horizontalLines: HorizontalLineCoords[] = [];

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getSelectionContext();
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number) {
    const ctx = this.ctx;
    const originXY = fabric.util.transformPoint(
        new fabric.Point(x1, y1),
        this.canvas.viewportTransform as any
      ),
      dimensions = fabric.util.transformPoint(
        new fabric.Point(x2, y2),
        this.canvas.viewportTransform as any
      );

    // 使用 canvas 的 api 用来绘制辅助线
    ctx.save();
    ctx.lineWidth = ALIGNING_LINE_WIDTH;
    ctx.strokeStyle = ALIGNING_LINE_COLOR;
    ctx.beginPath();

    ctx.moveTo(originXY.x, originXY.y);
    ctx.lineTo(dimensions.x, dimensions.y);
    ctx.stroke();

    // 恢复这两玩意
    // ctx.lineWidth = aligningLineWidth
    // ctx.strokeStyle = aligningLineColor
    ctx.restore();
  }

  private drawVerticalLine(coords: VerticalLineCoords) {
    this.drawLine(
      // x1 是左边的边界，x2 是右边的边界
      // y1 是上边的边界，y2 是下边的边界
      /**
       * 当绘制 horizontal 的时候，x1 和 x2 是一样的，
       * 当绘制 vertical 的时候，y1 和 y2 是一样的
       */
      coords.x + 0.5,
      coords.y1 > coords.y2 ? coords.y2 : coords.y1,
      coords.x + 0.5,
      coords.y2 > coords.y1 ? coords.y2 : coords.y1
    );
  }

  private drawHorizontalLine(coords: HorizontalLineCoords) {
    this.drawLine(
      coords.x1 > coords.x2 ? coords.x2 : coords.x1,
      coords.y + 0.5,
      coords.x2 > coords.x1 ? coords.x2 : coords.x1,
      coords.y + 0.5
    );
  }

  private isInRange(value1: number, value2: number) {
    return (
      Math.abs(Math.round(value1) - Math.round(value2)) <= ALIGNING_LINE_MARGIN
    );
  }

  private watchMouseDown() {
    this.canvas.on("mouse:down", () => {
      this.clearLinesMeta();
      this.viewportTransform = this.canvas.viewportTransform as number[];
    });
  }

  private watchMouseUp() {
    this.canvas.on("mouse:up", () => {
      global.alignmentLines_horizontal = this.horizontalLines;
      global.alignmentLines_vertical = this.verticalLines;
      updateInfo();

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

  private moveActiveObjToNewPositionByCenterPoint(
    x: number,
    y: number,
    activeObject: fabric.Object
  ) {
    activeObject.setPositionByOrigin(
      new fabric.Point(x, y),
      "center",
      "center"
    );
  }

  private watchObjectMoving() {
    this.canvas.on("object:moving", (e) => {
      this.clearLinesMeta();
      const activeObject = e.target as fabric.Object;
      const canvasObjects = this.canvas
        .getObjects()
        .filter((obj) => obj.myType === "box");
      // @ts-ignore
      const transform = this.canvas._currentTransform;
      if (!transform) return;
      this.traversAllObjects(activeObject, canvasObjects);
    });
  }

  private traversAllObjects(
    activeObject: fabric.Object,
    canvasObjects: fabric.Object[]
  ) {
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

    // 开始遍例所有节点
    for (let i = canvasObjects.length; i--; ) {
      if (canvasObjects[i] === activeObject) continue;

      const {
        objWidth,
        relativeToCanvasPosition,
        objNeedDrawHorizontalSide,
        objNeedDrawVerticalSide,
      } = this.getObjInfo(canvasObjects[i]);

      const { objLeftToCanvasLeft, objTopToCanvasTop, objBottomToCanvasTop } =
        relativeToCanvasPosition;

      for (const activeObjSide in activeObjNeedDrawHorizontalSide) {
        for (const objSide in objNeedDrawHorizontalSide) {
          if (
            this.isInRange(
              activeObjNeedDrawHorizontalSide[activeObjSide].y,
              objNeedDrawHorizontalSide[objSide].y
            )
          ) {
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
          console.log('activeObjNeedDrawVerticalSide[activeObjSide].x', activeObjNeedDrawVerticalSide[activeObjSide].x)
          console.log('objNeedDrawVerticalSide[objSide].x', objNeedDrawVerticalSide[objSide].x)
          if (
            this.isInRange(
              activeObjNeedDrawVerticalSide[activeObjSide].x,
              objNeedDrawVerticalSide[objSide].x
            )
          ) {
            console.log('!!!!!!!!!!!!!!!')
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
              y1 =
                activeObjTopToCanvasTop > objTopToCanvasTop
                  ? objTopToCanvasTop
                  : activeObjTopToCanvasTop;
              y2 =
                activeObjBottomToCanvasTop > objBottomToCanvasTop
                  ? activeObjBottomToCanvasTop
                  : objBottomToCanvasTop;
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
              this.moveActiveObjToNewPositionByCenterPoint(
                x,
                newCenterPointToCanvasTop,
                activeObject
              );
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

      global.alignmentLines_horizontal = JSON.stringify(
        this.horizontalLines,
        null,
        4
      );
      global.alignmentLines_vertical = JSON.stringify(
        this.verticalLines,
        null,
        4
      );
      updateInfo();

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

const drawLine = new AlignGuidelines(fabricCanvas);
drawLine.init();

/**
 * 获取选中的对象
 * 获取选中的对象的上中下坐标，记为 horizontalLines
 *    horizontalLines 内部元素：
 *    {
 *      type: 'top' | 'center' | 'bottom',
 *      // y 坐标位置
 *      y: number,
 *    }
 * 获取选中的对象的左中右坐标，记为 verticalLinesLines
 *    verticalLines 内部元素：
 *    {
 *      type: 'left' | 'center' | 'right',
 *      // x 坐标位置
 *      x: number,
 *    }
 * 获取所有对象
 * 遍历所有对象
 * 如果对象的上中下坐标和 horizontalLines 相等，则记录需要绘制的线
 *     这里需要注意的是，我们需要根据 range 来判断是否需要吸附
 * 如果对象的左中右坐标和 verticalLines 相等，则记录需要绘制的线
 * 绘制辅助线
 */
