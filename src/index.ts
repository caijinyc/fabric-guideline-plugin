import { fabric } from "fabric";
/**
 * 问题点：
 * 1、自动吸附只有相同的 margin 才会触发，例如顶部只会和顶部自动吸附，左边只会和左边自动吸附
 * 2、自动吸附只会计算 value1(被拖拽的元素) < value2 的情况（已解决）
 */
// ==========================================
// SETUP
// ==========================================

const canvas = new fabric.Canvas("myCanvas");

canvas.backgroundColor = "#222222";
const lastClientX = 0;
const lastClientY = 0;
const state = "default";
const outer = null;
const box1 = null;
const box2 = null;
const global: any = {};
global.centerLine_horizontal = "";
global.centerLine_vertical = "";
global.alignmentLines_horizontal = "";
global.alignmentLines_vertical = "";

setupObjects();
updateInfo();

fabric.Object.prototype.set({
  //cornerSize: 15,
  //cornerStyle: 'circle',
  // cornerColor: '#ffffff',
  // transparentCorners: true,
  //strokeWidth: 8,
  // cornerlineWidth: 4,
  // borderColor: "pink",
  // borderScaleFactor: 6,
});

// // 修改控制锚点
// function newControls(control, ctx, methodName, left, top) {
//   // console.log("control is: " + control)
//   if (!global.isControlVisible(control)) {
//     return;
//   }
//   var size = global.cornerSize;
//   global.transparentCorners || ctx.clearRect(left, top, size, size);
//   ctx.beginPath();
//   ctx.arc(left + size / 2, top + size / 2, size / 2, 0, 2 * Math.PI, false);
//   ctx.strokeStyle = "#FF0000";
//   ctx.lineWidth = 4;
//   ctx.stroke();
// }
//
// fabric.Object.prototype._drawControl = newControls;
// fabric.Object.prototype.cornerSize = 22;

function setupObjects() {
  global.outer = new fabric.Rect({
    width: canvas.getWidth(),
    height: canvas.getHeight(),
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

  canvas.add(global.outer);
  global.outer.center();

  canvas.add(global.box1);
  canvas.add(global.box2);
  canvas.add(global.box3);
  let allBoxes = new fabric.ActiveSelection(
    canvas.getObjects().filter((obj) => obj.myType == "box"),
    { canvas: canvas }
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

  info_zoom.innerHTML = canvas.getZoom().toFixed(2);
  info_vptTop.innerHTML = Math.round(canvas.viewportTransform[5]);
  info_vptLeft.innerHTML = Math.round(canvas.viewportTransform[4]);
  info_centerLine_horizontal.innerHTML = global.centerLine_horizontal;
  info_centerLine_vertical.innerHTML = global.centerLine_vertical;
  info_alignmentLines_horizontal.innerHTML = global.alignmentLines_horizontal;
  info_alignmentLines_vertical.innerHTML = global.alignmentLines_vertical;
}

// ------------------------------------
// Reset
// ------------------------------------
let resetButton = document.getElementById("reset");

resetButton.addEventListener(
  "click",
  function () {
    reset();
  },
  false
);

function reset() {
  canvas.remove(...canvas.getObjects());
  setupObjects();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  updateInfo();
}

// ------------------------------------

// ==========================================
// MOUSE INTERACTIONS
// ==========================================

// MOUSEWHEEL ZOOM
canvas.on("mouse:wheel", (opt) => {
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

  let pointer = canvas.getPointer(opt.e);
  let zoom = canvas.getZoom();
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

  canvas.zoomToPoint(
    new fabric.Point(canvas.width / 2, canvas.height / 2),
    zoom
  );

  opt.e.preventDefault();
  opt.e.stopPropagation();

  canvas.renderAll();
  canvas.calcOffset();

  updateInfo(canvas);
});

initCenteringGuidelines(canvas);
initAligningGuidelines(canvas);

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
      canvasWidthCenter + 0.5,
      0,
      canvasWidthCenter + 0.5,
      canvasHeight
    );
  }

  function showHorizontalCenterLine() {
    showCenterLine(
      0,
      canvasHeightCenter + 0.5,
      canvasWidth,
      canvasHeightCenter + 0.5
    );
  }

  function showCenterLine(x1: number, y1: number, x2: number, y2: number) {
    const originXY = fabric.util.transformPoint(
        new fabric.Point(x1, y1),
        canvas.viewportTransform
      ),
      dimmensions = fabric.util.transformPoint(
        new fabric.Point(x2, y2),
        canvas.viewportTransform
      );
    ctx.save();
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = centerLineWidth;
    ctx.beginPath();

    ctx.moveTo(originXY.x, originXY.y);

    ctx.lineTo(dimmensions.x, dimmensions.y);
    ctx.stroke();
    ctx.restore();

    /*
        ctx.save()
        ctx.strokeStyle = centerLineColor
        ctx.lineWidth = centerLineWidth
        ctx.beginPath()
        ctx.moveTo(x1 * viewportTransform[0], y1 * viewportTransform[3])
        ctx.lineTo(x2 * viewportTransform[0], y2 * viewportTransform[3])
        ctx.stroke()
        ctx.restore() */
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

// Original author:
/**
 * Should objects be aligned by a bounding box?
 * [Bug] Scaled objects sometimes can not be aligned by edges
 *
 */
function initAligningGuidelines(canvas: fabric.Canvas) {
  let ctx = canvas.getSelectionContext(),
    aligningLineOffset = 5,
    aligningLineMargin = 4,
    aligningLineWidth = 2,
    aligningLineColor = "lime",
    viewportTransform = [1, 0, 0, 1, 0, 0],
    zoom = null,
    verticalLines: VerticalLineCoords[] = [],
    horizontalLines: HorizontalLineCoords[] = [],
    canvasContainer: HTMLCanvasElement = document.getElementById(
      "myCanvas"
    ) as HTMLCanvasElement,
    containerWidth = canvasContainer.offsetWidth,
    containerHeight = canvasContainer.offsetHeight;

  function drawVerticalLine(coords: VerticalLineCoords) {
    drawLine(
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

  function drawHorizontalLine(coords: HorizontalLineCoords) {
    drawLine(
      coords.x1 > coords.x2 ? coords.x2 : coords.x1,
      coords.y + 0.5,
      coords.x2 > coords.x1 ? coords.x2 : coords.x1,
      coords.y + 0.5
    );
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    /**
     *
     * originXY 是原点的左上角坐标
     */
    const originXY = fabric.util.transformPoint(
        new fabric.Point(x1, y1),
        canvas.viewportTransform
      ),
      dimensions = fabric.util.transformPoint(
        new fabric.Point(x2, y2),
        canvas.viewportTransform
      );

    // 这部分代码就是使用 canvas 的 api 用来绘制辅助线
    ctx.save();
    ctx.lineWidth = aligningLineWidth;
    ctx.strokeStyle = aligningLineColor;
    ctx.beginPath();

    ctx.moveTo(originXY.x, originXY.y);
    ctx.lineTo(dimensions.x, dimensions.y);
    // 绘制
    ctx.stroke();

    // 恢复这两玩意
    // ctx.lineWidth = aligningLineWidth
    // ctx.strokeStyle = aligningLineColor
    ctx.restore();
  }

  // 如果 value1 和 value2 的四舍五入后的距离小于等于定义的校准距离，那么返回 true
  function isInRange(value1: number, value2: number) {
    value1 = Math.round(value1);
    value2 = Math.round(value2);
    // 两个值的距离小于等于定义的校准距离，那么就返回 true 进行校准
    if (Math.abs(value1 - value2) <= aligningLineMargin) return true;
    return false;
  }

  canvas.on("mouse:down", function () {
    verticalLines.length = horizontalLines.length = 0;
    viewportTransform = canvas.viewportTransform;
    zoom = canvas.getZoom();
  });

  canvas.on("object:moving", (e) => {
    console.log("object:moving");

    verticalLines.length = horizontalLines.length = 0;

    let activeObject = e.target as fabric.Object;

    let canvasObjects = canvas.getObjects(),
      // .filter((obj) => obj.myType === "box"),
      activeObjCenterPoint = activeObject.getCenterPoint(),
      // 左侧的距离
      activeObjCenterPointToCanvasLeft = activeObjCenterPoint.x,
      // 顶部的距离
      activeObjCenterPointToCanvasTop = activeObjCenterPoint.y,
      activeObjectBoundingRect = activeObject.getBoundingRect(),
      // 宽高
      activeObjectHeight =
        activeObjectBoundingRect.height / viewportTransform[3],
      activeObjectWidth = activeObjectBoundingRect.width / viewportTransform[0],
      /**
       * 通过中心点的位置和宽高就能计算出所有信息
       */
      horizontalInTheRange = false,
      verticalInTheRange = false,
      transform = canvas._currentTransform;

    const activeObjLeftToCanvasLeft =
      activeObjCenterPointToCanvasLeft - activeObjectWidth / 2;
    const activeObjRightToCanvasLeft =
      activeObjCenterPointToCanvasLeft + activeObjectWidth / 2;

    const activeObjTopToCanvasTop =
      activeObjCenterPointToCanvasTop - activeObjectHeight / 2;
    const activeObjBottomToCanvasTop =
      activeObjCenterPointToCanvasTop + activeObjectHeight / 2;

    const activeObjNeedDrawHorizontalSide = {
      top: {
        y: activeObjTopToCanvasTop,
      },
      center: {
        y: activeObjCenterPointToCanvasTop,
      },
      bottom: {
        y: activeObjBottomToCanvasTop,
      },
    };

    const activeObjNeedDrwVerticalSide = {
      left: {
        x: activeObjLeftToCanvasLeft,
      },
      center: {
        x: activeObjCenterPointToCanvasLeft,
      },
      right: {
        x: activeObjRightToCanvasLeft,
      },
    };

    /**
     * 现在使用的是 activeObjectCenterLeft - activeObjectWidth / 2 来计算 left 距离
     * 不直接使用 activeObjectBoundingRect.left 的原因是因为 e 触发的过程中，activeObjectBoundingRect.left 是不会发生变化的，只有重新触发事件才会发生变化
     */

    if (!transform) return;

    // It should be trivial to DRY this up by encapsulating (repeating) creation of x1, x2, y1, and y2 into functions,
    // but we're not doing it here for perf. reasons -- as this a function that's invoked on every mouse move

    // 开始遍例所有节点
    for (let i = canvasObjects.length; i--; ) {
      if (canvasObjects[i] === activeObject) continue;

      let objectCenter = canvasObjects[i].getCenterPoint(),
        objCenterToCanvasLeft = objectCenter.x,
        objCenterToCanvasTop = objectCenter.y,
        objBoundingRect = canvasObjects[i].getBoundingRect(),
        objHeight = objBoundingRect.height / viewportTransform[3],
        objWidth = objBoundingRect.width / viewportTransform[0];

      // object left side to the canvas left
      const objLeftToCanvasLeft = objCenterToCanvasLeft - objWidth / 2;
      // object right side to the left
      const objRightToCanvasLeft = objCenterToCanvasLeft + objWidth / 2;

      const objTopToCanvasTop = objCenterToCanvasTop - objHeight / 2;
      const objBottomToCanvasTop = objCenterToCanvasTop + objHeight / 2;

      const objNeedDrawHorizontalSide = {
        top: {
          y: objTopToCanvasTop,
        },
        center: {
          y: objCenterToCanvasTop,
        },
        bottom: {
          y: objBottomToCanvasTop,
        },
      };

      const objNeedDrawVerticalSide = {
        left: {
          x: objLeftToCanvasLeft,
        },
        center: {
          x: objCenterToCanvasLeft,
        },
        right: {
          x: objRightToCanvasLeft,
        },
      };

      for (const key in activeObjNeedDrawHorizontalSide) {
        for (const key2 in objNeedDrawHorizontalSide) {
          if (
            isInRange(
              activeObjNeedDrawHorizontalSide[key].y,
              objNeedDrawHorizontalSide[key2].y
            )
          ) {
            horizontalInTheRange = true;

            if (key === "center") {
              let x1, x2;

              if (activeObjLeftToCanvasLeft > objLeftToCanvasLeft) {
                x1 = objLeftToCanvasLeft;
                x2 = activeObjLeftToCanvasLeft + activeObjectWidth / 2;
              } else {
                x1 = activeObjLeftToCanvasLeft + activeObjectWidth / 2;
                x2 = objLeftToCanvasLeft + objWidth;
              }
              horizontalLines.push({
                y: objNeedDrawHorizontalSide[key2].y,
                x1,
                x2,
              });
            } else {
              let x1, x2;

              if (activeObjLeftToCanvasLeft > objLeftToCanvasLeft) {
                x1 = objLeftToCanvasLeft;
                x2 = activeObjLeftToCanvasLeft + activeObjectWidth;
              } else {
                x1 = activeObjLeftToCanvasLeft;
                x2 = objLeftToCanvasLeft + objWidth;
              }

              horizontalLines.push({
                y: objNeedDrawHorizontalSide[key2].y,
                x1,
                x2,
              });
            }

            if (key === "top") {
              activeObject.setPositionByOrigin(
                new fabric.Point(
                  activeObjCenterPointToCanvasLeft,
                  objNeedDrawHorizontalSide[key2].y + activeObjectHeight / 2
                ),
                "center",
                "center"
              );
            }

            if (key === "center") {
              activeObject.setPositionByOrigin(
                new fabric.Point(
                  activeObjCenterPointToCanvasLeft,
                  objNeedDrawHorizontalSide[key2].y
                ),
                "center",
                "center"
              );
            }

            if (key === "bottom") {
              activeObject.setPositionByOrigin(
                new fabric.Point(
                  activeObjCenterPointToCanvasLeft,
                  objNeedDrawHorizontalSide[key2].y - activeObjectHeight / 2
                ),
                "center",
                "center"
              );
            }
          }
        }
      }

      for (const key in activeObjNeedDrwVerticalSide) {
        for (const key2 in objNeedDrawVerticalSide) {
          if (
            isInRange(
              activeObjNeedDrwVerticalSide[key].x,
              objNeedDrawVerticalSide[key2].x
            )
          ) {
            verticalInTheRange = true;
            verticalLines.push({
              x: activeObjNeedDrwVerticalSide[key].x,
              y1:
                activeObjTopToCanvasTop > objTopToCanvasTop
                  ? activeObjTopToCanvasTop
                  : objTopToCanvasTop,
              y2:
                activeObjTopToCanvasTop > objTopToCanvasTop
                  ? objTopToCanvasTop
                  : activeObjTopToCanvasTop,
            });
          }
        }
      }

      // // snap by the horizontal center line
      // if (isInRange(objCenterToCanvasLeft, activeObjCenterPointToCanvasLeft)) {
      //   verticalInTheRange = true
      //   // 用来绘制辅助线
      //   verticalLines.push({
      //     x: objCenterToCanvasLeft,
      //     y1: (objCenterToCanvasTop < activeObjCenterPointToCanvasTop)
      //       ? (objTopToCanvasTop - aligningLineOffset)
      //       : (objBottomToCanvasTop + aligningLineOffset),
      //     y2: (activeObjCenterPointToCanvasTop > objCenterToCanvasTop)
      //       ? (activeObjBottomToCanvasTop + aligningLineOffset)
      //       : (activeObjTopToCanvasTop - aligningLineOffset)
      //   })
      //   activeObject.setPositionByOrigin(new fabric.Point(objCenterToCanvasLeft, activeObjCenterPointToCanvasTop), 'center', 'center');
      // }
      //
      // // snap by the left edge
      // if (isInRange(objLeftToCanvasLeft, activeObjLeftToCanvasLeft)) {
      //   verticalInTheRange = true
      //   verticalLines.push({
      //     x: objLeftToCanvasLeft,
      //     y1: (objCenterToCanvasTop < activeObjCenterPointToCanvasTop)
      //       ? (objTopToCanvasTop - aligningLineOffset)
      //       : (objBottomToCanvasTop + aligningLineOffset),
      //     y2: (activeObjCenterPointToCanvasTop > objCenterToCanvasTop)
      //       ? (activeObjBottomToCanvasTop + aligningLineOffset)
      //       : (activeObjTopToCanvasTop - aligningLineOffset)
      //   })
      //   activeObject.setPositionByOrigin(new fabric.Point(objLeftToCanvasLeft + activeObjectWidth / 2, activeObjCenterPointToCanvasTop), 'center', 'center')
      // }
      //
      // // snap by the right edge
      // if (isInRange(objRightToCanvasLeft, activeObjRightToCanvasLeft)) {
      //   verticalInTheRange = true
      //   verticalLines.push({
      //     x: objRightToCanvasLeft,
      //     y1: (objCenterToCanvasTop < activeObjCenterPointToCanvasTop)
      //       ? (objTopToCanvasTop - aligningLineOffset)
      //       : (objBottomToCanvasTop + aligningLineOffset),
      //     y2: (activeObjCenterPointToCanvasTop > objCenterToCanvasTop)
      //       ? (activeObjBottomToCanvasTop + aligningLineOffset)
      //       : (activeObjTopToCanvasTop - aligningLineOffset)
      //   })
      //   activeObject.setPositionByOrigin(new fabric.Point(objRightToCanvasLeft - activeObjectWidth / 2, activeObjCenterPointToCanvasTop), 'center', 'center')
      // }
      //
      // // snap by the vertical center line
      // if (isInRange(objCenterToCanvasTop, activeObjCenterPointToCanvasTop)) {
      //   horizontalInTheRange = true;
      //   horizontalLines.push({
      //     y: objCenterToCanvasTop,
      //     x1: (objCenterToCanvasLeft < activeObjCenterPointToCanvasLeft)
      //       ? (objLeftToCanvasLeft - aligningLineOffset)
      //       : (objRightToCanvasLeft + aligningLineOffset),
      //     x2: (activeObjCenterPointToCanvasLeft > objCenterToCanvasLeft)
      //       ? (activeObjRightToCanvasLeft + aligningLineOffset)
      //       : (activeObjLeftToCanvasLeft - aligningLineOffset)
      //   })
      //   activeObject.setPositionByOrigin(new fabric.Point(activeObjCenterPointToCanvasLeft, objCenterToCanvasTop), 'center', 'center')
      // }
      //
      // // snap by the top edge
      // if (isInRange(objTopToCanvasTop, activeObjTopToCanvasTop)) {
      //   horizontalInTheRange = true
      //   horizontalLines.push({
      //     y: objTopToCanvasTop,
      //     x1: (objCenterToCanvasLeft < activeObjCenterPointToCanvasLeft)
      //       ? (objLeftToCanvasLeft - aligningLineOffset)
      //       : (objRightToCanvasLeft + aligningLineOffset),
      //     x2: (activeObjCenterPointToCanvasLeft > objCenterToCanvasLeft)
      //       ? (activeObjRightToCanvasLeft + aligningLineOffset)
      //       : (activeObjLeftToCanvasLeft - aligningLineOffset)
      //   })
      //   activeObject.setPositionByOrigin(new fabric.Point(activeObjCenterPointToCanvasLeft, objTopToCanvasTop + activeObjectHeight / 2), 'center', 'center');
      // }
      //
      // // snap by the bottom edge
      // if (isInRange(objBottomToCanvasTop, activeObjBottomToCanvasTop)) {
      //   horizontalInTheRange = true
      //   horizontalLines.push({
      //     y: objBottomToCanvasTop,
      //     x1: (objCenterToCanvasLeft < activeObjCenterPointToCanvasLeft)
      //       ? (objLeftToCanvasLeft - aligningLineOffset)
      //       : (objRightToCanvasLeft + aligningLineOffset),
      //     x2: (activeObjCenterPointToCanvasLeft > objCenterToCanvasLeft)
      //       ? (activeObjRightToCanvasLeft + aligningLineOffset)
      //       : (activeObjLeftToCanvasLeft - aligningLineOffset)
      //   })
      //   activeObject.setPositionByOrigin(new fabric.Point(activeObjCenterPointToCanvasLeft, objBottomToCanvasTop - activeObjectHeight / 2), 'center', 'center')
      // }
    }

    if (!horizontalInTheRange) {
      horizontalLines.length = 0;
    }

    if (!verticalInTheRange) {
      verticalLines.length = 0;
    }
  });

  canvas.on("mouse:wheel", (opt) => {
    verticalLines.length = horizontalLines.length = 0;
  });

  canvas.on("before:render", function () {
    canvas.clearContext(canvas.contextTop);
  });

  canvas.on("after:render", () => {
    for (let i = verticalLines.length; i--; ) {
      drawVerticalLine(verticalLines[i]);
    }
    for (let i = horizontalLines.length; i--; ) {
      drawHorizontalLine(horizontalLines[i]);
    }

    global.alignmentLines_horizontal = JSON.stringify(horizontalLines, null, 4);
    global.alignmentLines_vertical = JSON.stringify(verticalLines, null, 4);
    updateInfo();

    // console.log("activeObject left edge x is: " + canvas.getActiveObject().left)

    //verticalLines.length = horizontalLines.length = 0

    canvas.calcOffset();
  });

  canvas.on("mouse:up", () => {
    console.log("after:render");

    verticalLines.length = horizontalLines.length = 0;
    canvas.renderAll();
    //global.alignmentLines_horizontal = horizontalLines
    //global.alignmentLines_vertical = verticalLines
    updateInfo();
  });
}

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
