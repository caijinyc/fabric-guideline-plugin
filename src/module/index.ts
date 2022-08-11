import { fabric } from "fabric";
import { AlignGuidelines } from "./aligning";
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
const clearGuideline = () => fabricCanvas.clearContext(fabricCanvas.getSelectionContext());

const global: any = {};
global.centerLine_horizontal = "";
global.centerLine_vertical = "";
global.alignmentLines_horizontal = "";
global.alignmentLines_vertical = "";

setupObjects();

function setupObjects() {
  global.outer = new fabric.Rect({
    width: fabricCanvas.getWidth(),
    height: fabricCanvas.getHeight(),
    top: 20,
    left: 20,
    stroke: "#ffffff",
    evented: false,
    fill: "#f3f3f3",
    selectable: false,
  });

  global.box1 = new fabric.Rect({
    name: "box1",
    width: 240,
    height: 100,
    top: 20,
    left: 20,
    fill: "#fff28a",
    myType: "box",
  });

  global.box2 = new fabric.Rect({
    name: "box2",
    width: 240,
    height: 100,
    top: 140,
    left: 20,
    fill: "#ff8a8a",
    myType: "box",
  });

  global.box3 = new fabric.Rect({
    name: "box3",
    width: 100,
    height: 160,
    top: 20,
    left: 280,
    fill: "#cf8aff",
    myType: "box",
  });

  const genRect = () =>
    new fabric.Rect({
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

  fabricCanvas.zoomToPoint(new fabric.Point(fabricCanvas.width / 2, fabricCanvas.height / 2), zoom);

  opt.e.preventDefault();
  opt.e.stopPropagation();

  fabricCanvas.renderAll();
  fabricCanvas.calcOffset();
});

// initCenteringGuidelines(fabricCanvas);
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
    centerLineWidth = 1,
    ctx = canvas.getSelectionContext(),
    viewportTransform: number[] = [1, 0, 0, 1, 0, 0];

  for (let i = canvasWidthCenter - centerLineMargin, len = canvasWidthCenter + centerLineMargin; i <= len; i++) {
    canvasWidthCenterMap[Math.round(i)] = true;
  }
  for (let i = canvasHeightCenter - centerLineMargin, len = canvasHeightCenter + centerLineMargin; i <= len; i++) {
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
    const originXY = fabric.util.transformPoint(new fabric.Point(x1, y1), canvas.viewportTransform as number[]),
      dimensions = fabric.util.transformPoint(new fabric.Point(x2, y2), canvas.viewportTransform as number[]);
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
    viewportTransform = canvas.viewportTransform;
  });

  canvas.on("object:moving", function (e) {
    let object = e.target,
      objectCenter = object.getCenterPoint(),
      transform = canvas._currentTransform;

    if (!transform) return;

    (isInVerticalCenter = Math.round(objectCenter.x) in canvasWidthCenterMap),
      (isInHorizontalCenter = Math.round(objectCenter.y) in canvasHeightCenterMap);

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
        canvasWidthCenter + 0.5 + ", " + 0 + ", " + (canvasWidthCenter + 0.5) + ", " + canvasHeight;
    }

    if (isInHorizontalCenter) {
      showHorizontalCenterLine();
    }
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

const guideline = new AlignGuidelines({
  canvas: fabricCanvas,
  pickObjTypes: [{ key: "myType", value: "box" }],
  aligningOptions: {
    lineColor: "#32D10A",
    lineWidth: 0.5,
  },
});
guideline.init();
